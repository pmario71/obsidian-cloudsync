import { File } from "../sync/AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { CloudPathHandler } from "../sync/CloudPathHandler";
import { GCPAuth } from "./auth";
import { CloudFiles } from "../sync/utils/CloudFiles";
import { requestUrl, RequestUrlResponse } from "obsidian";

export class GCPFiles extends CloudFiles {
    constructor(
        bucket: string,
        paths: CloudPathHandler,
        private readonly auth: GCPAuth
    ) {
        super(bucket, paths);
    }

    private isRequestUrlResponse(response: any): response is RequestUrlResponse {
        return 'text' in response;
    }

    private async parseGCPError(response: Response | RequestUrlResponse): Promise<string> {
        const text = this.isRequestUrlResponse(response) ? response.text : await response.text();
        const errorMessage = await this.parseXMLError(text);
        return errorMessage !== 'Unknown error occurred' ? errorMessage : `HTTP error! status: ${response.status}`;
    }

    async readFile(file: File): Promise<Uint8Array> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from GCP`);

        if (this.shouldSkipDirectoryOperation(file)) {
            return new Uint8Array(0);
        }

        const remotePath = file.remoteName || file.name;
        const fullPath = this.paths.addVaultPrefix(remotePath);
        const url = this.paths.getObjectUrl(this.bucket, fullPath);
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
        const url = this.paths.getObjectUrl(this.bucket, fullPath);
        this.logFileOperation('Writing', file, fullPath);

        return this.retryOperation(async () => {
            const headers = await this.auth.getHeaders();
            const response = await fetch(url, {
                method: 'PUT',
                body: content,
                headers: {
                    ...headers,
                    'Content-Length': content.length.toString()
                }
            });

            if (response.status < 200 || response.status >= 300) {
                const errorMessage = await this.parseGCPError(response);
                throw new Error(`Remote write failed: ${errorMessage}`);
            }

            LogManager.log(LogLevel.Trace, `Successfully wrote ${file.name} to GCP`);
        }, 'write');
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Trace, `Deleting ${file.name} from GCP`);

        if (this.shouldSkipDirectoryOperation(file)) {
            return;
        }

        const remotePath = file.remoteName || file.name;
        const fullPath = this.paths.addVaultPrefix(remotePath);
        const url = this.paths.getObjectUrl(this.bucket, fullPath);
        this.logFileOperation('Deleting', file, fullPath);

        return this.retryOperation(async () => {
            const headers = await this.auth.getHeaders();
            const response = await requestUrl({
                url: url.toString(),
                method: 'DELETE',
                headers
            });

            // GCP returns 404 for already deleted files, which is fine
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

                    const rawName = this.paths.removeVaultPrefix(key);
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

            if (files.length === 0 && prefix === '/') {
                LogManager.log(LogLevel.Debug, 'No files found in GCP bucket, returning root directory');
                return [this.createRootDirectoryFile()];
            }

            LogManager.log(LogLevel.Trace, `Found ${files.length} files in GCP bucket`);
            return files;
        }, 'list');
    }
}
