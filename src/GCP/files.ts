import { File } from "../sync/AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel, CloudSyncSettings } from "../sync/types";
import { CloudPathHandler } from "../sync/CloudPathHandler";
import { GCPAuth } from "./auth";
import { CloudFiles } from "../sync/utils/CloudFiles";
import { requestUrl, RequestUrlResponse } from "obsidian";
import { CacheManagerService } from "../sync/utils/cacheUtils";

export class GCPFiles extends CloudFiles {
    private readonly cacheService: CacheManagerService;

    constructor(
        bucket: string,
        paths: CloudPathHandler,
        private readonly auth: GCPAuth,
        private readonly settings: CloudSyncSettings
    ) {
        super(bucket, paths);
        if (!settings.app) {
            throw new Error('App instance not available in settings');
        }
        this.cacheService = CacheManagerService.getInstance();
    }

    private async clearCache(): Promise<void> {
        try {
            const cachePath = `${this.settings.app?.vault.configDir}/plugins/cloudsync/cloudsync-gcp.json`;
            await this.cacheService.invalidateCache(cachePath);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to clear GCP cache, attempting recovery', error);
        }
    }

    private isRequestUrlResponse(response: Response | RequestUrlResponse): response is RequestUrlResponse {
        return 'text' in response;
    }

    private async parseGCPError(response: Response | RequestUrlResponse): Promise<string> {
        const text = this.isRequestUrlResponse(response) ? response.text : await response.text();
        const errorMessage = await this.parseXMLError(text);
        return errorMessage !== 'Unknown error occurred' ? errorMessage : `HTTP error! status: ${response.status}`;
    }

    private encodePathForUrl(path: string): string {
        const segments = path.split('/');
        return segments
            .map(segment => {
                if (!segment) return '';
                return encodeURIComponent(segment)
                    .replace(/%20/g, ' ')
                    .replace(/!/g, '%21')
                    .replace(/'/g, '%27')
                    .replace(/\(/g, '%28')
                    .replace(/\)/g, '%29')
                    .replace(/\*/g, '%2A')
                    .replace(/~/g, '%7E');
            })
            .join('/');
    }

    private decodePathFromUrl(path: string): string {
        const segments = path.split('/');
        return segments
            .map(segment => {
                if (!segment) return '';
                return decodeURIComponent(segment.replace(/ /g, '%20'));
            })
            .join('/');
    }

    async readFile(file: File): Promise<Uint8Array> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from GCP`);

        if (this.shouldSkipDirectoryOperation(file)) {
            return new Uint8Array(0);
        }

        const remotePath = file.remoteName || file.name;
        const fullPath = this.paths.addVaultPrefix(remotePath);
        const encodedPath = this.encodePathForUrl(fullPath);
        const url = this.paths.getObjectUrl(this.bucket, encodedPath);
        this.logFileOperation('Reading', file, fullPath);

        return this.retryOperation(async () => {
            const headers = await this.auth.getHeaders();
            const response = await requestUrl({
                url: url.toString(),
                headers,
                method: 'GET'
            });

            if (response.status < 200 || response.status >= 300) {
                const errorMessage = await this.parseGCPError(response);
                throw new Error(`Remote read failed: ${errorMessage}`);
            }

            const buffer = new Uint8Array(response.arrayBuffer);
            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        }, 'read');
    }

    async writeFile(file: File, content: Uint8Array): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to GCP (${content.length} bytes)`);

        if (this.shouldSkipDirectoryOperation(file)) {
            return;
        }

        const remotePath = file.remoteName || file.name;
        const fullPath = this.paths.addVaultPrefix(remotePath);
        const encodedPath = this.encodePathForUrl(fullPath);
        const url = this.paths.getObjectUrl(this.bucket, encodedPath);

        LogManager.log(LogLevel.Debug, 'Writing file:', {
            path: fullPath,
            url: url.toString()
        });

        return this.retryOperation(async () => {
            const headers = await this.auth.getHeaders();
            try {
                const arrayBuffer = content.slice().buffer;

                const response = await requestUrl({
                    url: url.toString(),
                    method: 'PUT',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/octet-stream',
                    },
                    body: arrayBuffer
                });

                if (response.status < 200 || response.status >= 300) {
                    const errorMessage = await this.parseGCPError(response);
                    throw new Error(`Remote write failed: ${errorMessage} (${response.status})`);
                }

                LogManager.log(LogLevel.Debug, `Successfully wrote ${content.length} bytes to ${file.name}`);
            } catch (error) {
                LogManager.log(LogLevel.Error, 'Write operation failed', {
                    file: file.name,
                    url: url.toString(),
                    bufferSize: content.length,
                    error: error instanceof Error ? error.message : error
                });
                throw error;
            }
        }, 'write');
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Trace, `Deleting ${file.name} from GCP`);

        if (this.shouldSkipDirectoryOperation(file)) {
            return;
        }

        const remotePath = file.remoteName || file.name;
        const fullPath = this.paths.addVaultPrefix(remotePath);
        const encodedPath = this.encodePathForUrl(fullPath);
        const url = this.paths.getObjectUrl(this.bucket, encodedPath);
        this.logFileOperation('Deleting', file, fullPath);

        return this.retryOperation(async () => {
            const headers = await this.auth.getHeaders();
            const response = await requestUrl({
                url: url.toString(),
                method: 'DELETE',
                headers
            });

            if ((response.status < 200 || response.status >= 300) && response.status !== 404) {
                const errorMessage = await this.parseGCPError(response);
                throw new Error(`Remote delete failed: ${errorMessage}`);
            }

            LogManager.log(LogLevel.Trace, `Successfully deleted ${file.name} from GCP`);
        }, 'delete');
    }

    async getFiles(): Promise<File[]> {
        LogManager.log(LogLevel.Trace, 'Listing files in GCP bucket');
        const prefix = this.paths.getVaultPrefix();
        const url = new URL(this.paths.getContainerUrl(this.bucket));

        url.searchParams.append('prefix', prefix === '/' ? '' : prefix + '/');
        LogManager.log(LogLevel.Debug, 'List URL:', { url: url.toString(), prefix });

        return this.retryOperation(async () => {
            const headers = await this.auth.getHeaders();
            const response = await requestUrl({
                url: url.toString(),
                headers,
                method: 'GET'
            });

            if (response.status < 200 || response.status >= 300) {
                const errorMessage = await this.parseGCPError(response);
                throw new Error(`Remote list failed: ${errorMessage}`);
            }

            const text = response.text;
            LogManager.log(LogLevel.Debug, 'GCP response:', { text });
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const files: File[] = [];

            const contents = xmlDoc.getElementsByTagName('Contents');
            if (contents && contents.length > 0) {
                Array.from(contents).forEach(item => {
                    const key = item.getElementsByTagName('Key')[0]?.textContent ?? '';
                    if (!key || key === prefix + '/' || key === '/') return;

                    const size = item.getElementsByTagName('Size')[0]?.textContent ?? '0';
                    const lastModified = item.getElementsByTagName('LastModified')[0]?.textContent ?? '';
                    const eTag = item.getElementsByTagName('ETag')[0]?.textContent ?? '';

                    const rawName = this.decodePathFromUrl(this.paths.removeVaultPrefix(key));
                    LogManager.log(LogLevel.Trace, `Raw name from GCP XML: "${rawName}" (hex: ${[...rawName].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')})`);
                    const normalizedName = this.paths.normalizeCloudPath(rawName);

                    LogManager.log(LogLevel.Debug, 'Processing file:', {
                        key,
                        rawName,
                        normalizedName,
                        size,
                        eTag
                    });

                    files.push({
                        name: normalizedName,
                        localName: normalizedName,
                        remoteName: rawName,
                        mime: 'application/octet-stream',
                        lastModified: new Date(lastModified),
                        size: Number(size),
                        md5: eTag.replace(/"/g, ''),
                        isDirectory: this.isDirectoryPath(normalizedName)
                    });
                });
            }

            if (files.length === 0) {
                LogManager.log(LogLevel.Debug, 'No files found in GCP bucket');
                if (prefix === '/') {
                    LogManager.log(LogLevel.Debug, 'Returning root directory marker');
                    return [this.createRootDirectoryFile()];
                }
                LogManager.log(LogLevel.Debug, 'New GCP prefix detected, invalidating cache');
                await this.clearCache();
                return [];
            }

            LogManager.log(LogLevel.Trace, `Found ${files.length} files in GCP bucket`);
            return files;
        }, 'list');
    }
}
