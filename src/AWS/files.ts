import { File } from '../sync/AbstractManager';
import { LogLevel, CloudSyncSettings } from '../sync/types';
import { CacheManager } from '../sync/CacheManager';
import { App } from 'obsidian';
import { LogManager } from '../LogManager';
import { AWSSigning } from './signing';
import { CloudPathHandler } from '../sync/CloudPathHandler';
import { CloudFiles } from '../sync/utils/CloudFiles';

interface S3RequestConfig {
    method: string;
    path: string;
    queryParams?: Record<string, string>;
    contentType?: string;
    body?: Uint8Array;
}

interface S3Response {
    status: number;
    headers: Record<string, string>;
    text: () => Promise<string>;
    arrayBuffer: () => Promise<ArrayBuffer>;
    ok: boolean;
}

export class AWSFiles extends CloudFiles {
    private static readonly DEFAULT_CONTENT_TYPE = 'application/octet-stream';
    private readonly cacheManager: CacheManager;
    private virtualHostUrl = '';

    constructor(
        bucket: string,
        private readonly endpoint: string,
        private readonly signing: AWSSigning,
        paths: CloudPathHandler,
        settings: CloudSyncSettings
    ) {
        super(bucket, paths);
        const app = (settings as any).app as App;
        if (!app) {
            throw new Error('App instance not available in settings');
        }
        const vaultPath = app.vault.configDir;
        const cachePath = `${vaultPath}/plugins/cloudsync/cloudsync-aws.json`;
        this.cacheManager = CacheManager.getInstance(cachePath, app);
    }

    setVirtualHostUrl(url: string): void {
        this.virtualHostUrl = url;
        LogManager.log(LogLevel.Debug, 'Set virtual host URL', { url });
    }

    private async clearCache(): Promise<void> {
        try {
            await this.cacheManager.clearCache();
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
                throw error;
            }
            LogManager.log(LogLevel.Debug, 'Cache file does not exist, skipping delete');
        }
    }

    private convertHeaders(headers: Headers): Record<string, string> {
        const result: Record<string, string> = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    private encodePathForUrl(path: string): string {
        // For S3 URLs, we need to encode the path properly
        const segments = path.split('/');
        const encodedSegments = segments.map(segment => {
            if (!segment) return '';
            return encodeURIComponent(segment)
                .replace(/!/g, '%21')
                .replace(/'/g, '%27')
                .replace(/\(/g, '%28')
                .replace(/\)/g, '%29')
                .replace(/\*/g, '%2A')
                .replace(/~/g, '%7E')
                .replace(/\+/g, '%20');
        });
        return encodedSegments.join('/');
    }

    private buildS3Url(path: string, queryParams: Record<string, string> = {}): string {
        // For S3 URLs, we need to encode the path properly
        const encodedPath = this.encodePathForUrl(path);

        LogManager.log(LogLevel.Debug, 'Building S3 URL', {
            originalPath: path,
            encodedPath,
            queryParams
        });

        // Use virtual host URL if available
        const baseUrl = this.virtualHostUrl
            ? `${this.virtualHostUrl}${encodedPath}`
            : `${this.endpoint}${encodedPath}`;
        const params = new URLSearchParams(queryParams);
        // Ensure consistent encoding of query parameters
        const queryString = params.toString()
            .replace(/\+/g, '%20')
            .replace(/%7E/g, '~');
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }

    private async makeS3Request(config: S3RequestConfig): Promise<S3Response> {
        const { method, path, queryParams = {}, contentType = AWSFiles.DEFAULT_CONTENT_TYPE, body } = config;
        const host = new URL(this.endpoint).host;
        const amzdate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

        // First sign the request with the raw path
        LogManager.log(LogLevel.Debug, 'Signing S3 request', {
            method,
            path,
            queryParams
        });

        const headers = this.signing.signRequest({
            method,
            path, // Use raw path for signing
            queryParams,
            host,
            amzdate,
            contentType,
            body
        });

        // Then build the URL with encoded path
        const url = this.buildS3Url(path, queryParams);
        LogManager.log(LogLevel.Debug, 'Making S3 request', { url, method });

        const requestInit: RequestInit = { method, headers };
        if (body) {
            requestInit.body = body;
            requestInit.headers = {
                ...headers,
                'Content-Length': body.length.toString()
            };
        }

        const response = await fetch(url, requestInit);
        return {
            status: response.status,
            headers: this.convertHeaders(response.headers),
            text: () => response.text(),
            arrayBuffer: () => response.arrayBuffer(),
            ok: response.ok
        };
    }

    private async parseS3Error(response: S3Response): Promise<string> {
        const text = await response.text();
        const errorMessage = await this.parseXMLError(text);
        return errorMessage !== 'Unknown error occurred' ? errorMessage : `HTTP error! status: ${response.status}`;
    }

    private async handleS3Response(response: S3Response, operation: string): Promise<S3Response> {
        if (!response.ok) {
            const errorMessage = await this.parseS3Error(response);
            throw new Error(`S3 ${operation} failed: ${errorMessage}`);
        }
        return response;
    }

    private getS3Path(file: File): string {
        // For operations, we need to:
        // 1. If remoteName exists, it might already have the vault prefix
        // 2. Otherwise convert local name to remote format and add prefix
        let fullPath;
        if (file.remoteName) {
            // Check if remoteName already has the prefix
            if (file.remoteName.startsWith(this.paths.getVaultPrefix())) {
                fullPath = file.remoteName;
            } else {
                fullPath = this.paths.addVaultPrefix(file.remoteName);
            }
        } else {
            const remotePath = this.paths.localToRemoteName(file.name);
            fullPath = this.paths.addVaultPrefix(remotePath);
        }

        LogManager.log(LogLevel.Debug, 'Calculated S3 path', {
            originalName: file.name,
            remoteName: file.remoteName,
            fullPath,
            vaultPrefix: this.paths.getVaultPrefix()
        });

        return fullPath;
    }

    async readFile(file: File): Promise<Uint8Array> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from S3`);

        if (this.shouldSkipDirectoryOperation(file)) {
            return new Uint8Array(0);
        }

        const fullPath = this.getS3Path(file);
        this.logFileOperation('Reading', file, fullPath);

        return this.retryOperation(async () => {
            const response = await this.makeS3Request({
                method: 'GET',
                path: `/${this.bucket}/${fullPath}`
            });

            await this.handleS3Response(response, 'read');
            const buffer = new Uint8Array(await response.arrayBuffer());

            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        }, 'read');
    }

    async writeFile(file: File, content: Uint8Array): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to S3 (${content.length} bytes)`);

        if (this.shouldSkipDirectoryOperation(file)) {
            return;
        }

        const fullPath = this.getS3Path(file);
        this.logFileOperation('Writing', file, fullPath);

        return this.retryOperation(async () => {
            const response = await this.makeS3Request({
                method: 'PUT',
                path: `/${this.bucket}/${fullPath}`,
                body: content
            });

            await this.handleS3Response(response, 'write');
            LogManager.log(LogLevel.Trace, `Successfully wrote ${file.name} to S3`);
        }, 'write');
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Trace, `Deleting ${file.name} from S3`);

        if (this.shouldSkipDirectoryOperation(file)) {
            return;
        }

        const fullPath = this.getS3Path(file);
        this.logFileOperation('Deleting', file, fullPath);

        return this.retryOperation(async () => {
            const response = await this.makeS3Request({
                method: 'DELETE',
                path: `/${this.bucket}/${fullPath}`
            });

            if (response.status !== 204 && !response.ok) {
                await this.handleS3Response(response, 'delete');
            }

            LogManager.log(LogLevel.Trace, `Successfully deleted ${file.name} from S3`);
        }, 'delete');
    }

    async getFiles(): Promise<File[]> {
        LogManager.log(LogLevel.Trace, 'Listing files in S3 bucket');

        return this.retryOperation(async () => {
            const encodedPrefix = this.paths.addVaultPrefix('');
            LogManager.log(LogLevel.Debug, 'Using encoded prefix:', {
                encoded: encodedPrefix
            });

            const response = await this.makeS3Request({
                method: 'GET',
                path: `/${this.bucket}`,
                queryParams: {
                    'list-type': '2',
                    'prefix': `${encodedPrefix}/`
                },
                contentType: 'application/xml'
            });

            await this.handleS3Response(response, 'list');
            const xmlText = await response.text();
            LogManager.log(LogLevel.Debug, 'S3 list response:', { xmlText });

            // Parse the XML to check if we have any files
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const contents = xmlDoc.getElementsByTagName('Contents');

            // If no files found with this prefix
            if (!contents || contents.length === 0) {
                LogManager.log(LogLevel.Debug, 'No files found in S3 bucket');
                // If this is the root prefix, return a root directory marker
                if (encodedPrefix === '/') {
                    LogManager.log(LogLevel.Debug, 'Returning root directory marker');
                    return [this.createRootDirectoryFile()];
                }
                // Otherwise, invalidate cache to force a full sync
                LogManager.log(LogLevel.Debug, 'New S3 prefix detected, invalidating cache');
                await this.clearCache();
                return [];
            }

            return this.parseFileList(xmlText);
        }, 'list');
    }

    private decodeXMLEntities(text: string): string {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    private parseFileList(xmlText: string): File[] {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const contents = xmlDoc.getElementsByTagName('Contents');

        if (!contents || contents.length === 0) {
            LogManager.log(LogLevel.Debug, 'No files found in S3 bucket');
            return [];
        }

        const files = Array.from(contents).map(item => {
            try {
                const keyElement = item.getElementsByTagName('Key')[0];
                if (!keyElement?.textContent) {
                    LogManager.log(LogLevel.Debug, 'Skipping item with no Key');
                    return null;
                }

                // Decode XML entities in the key (e.g., &#x12; -> \x12)
                const rawKey = this.decodeXMLEntities(keyElement.textContent);
                LogManager.log(LogLevel.Debug, 'Decoded S3 key', {
                    original: keyElement.textContent,
                    decoded: rawKey,
                    hex: [...rawKey].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
                });

                const lastModifiedText = item.getElementsByTagName('LastModified')[0]?.textContent;
                let lastModified = new Date();
                if (lastModifiedText) {
                    const parsedDate = new Date(lastModifiedText);
                    if (!isNaN(parsedDate.getTime())) {
                        lastModified = parsedDate;
                    } else {
                        LogManager.log(LogLevel.Debug, 'Invalid LastModified date, using current date', { lastModifiedText });
                    }
                } else {
                    LogManager.log(LogLevel.Debug, 'No LastModified date found, using current date');
                }

                const eTag = (item.getElementsByTagName('ETag')[0]?.textContent ?? '').replace(/"/g, '');
                const size = Number(item.getElementsByTagName('Size')[0]?.textContent ?? '0');

                const nameWithoutPrefix = this.paths.removeVaultPrefix(rawKey);
                const localName = this.paths.remoteToLocalName(nameWithoutPrefix);

                LogManager.log(LogLevel.Debug, 'Processing S3 item', {
                    rawKey,
                    lastModified: lastModified.toISOString(),
                    size,
                    eTag,
                    nameWithoutPrefix,
                    localName
                });

                // Remove vault prefix from remoteName to match local file's remoteName format
                const remoteNameWithoutPrefix = this.paths.removeVaultPrefix(rawKey);
                LogManager.log(LogLevel.Debug, 'Processing remote name', {
                    rawKey,
                    remoteNameWithoutPrefix,
                    localName
                });

                return {
                    name: localName,
                    localName,
                    remoteName: remoteNameWithoutPrefix, // Use name without prefix for consistent comparison
                    mime: AWSFiles.DEFAULT_CONTENT_TYPE,
                    lastModified,
                    size,
                    md5: eTag,
                    isDirectory: false
                };
            } catch (error) {
                LogManager.log(LogLevel.Error, 'Failed to process S3 item', error);
                return null;
            }
        }).filter((file): file is File => file !== null);

        LogManager.log(LogLevel.Trace, `Found ${files.length} valid files in S3 bucket`);
        return files;
    }
}
