import { File } from "../sync/AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { GCPPaths } from "./paths";
import { GCPAuth } from "./auth";

export class GCPFiles {
    constructor(
        private readonly bucket: string,
        private readonly paths: GCPPaths,
        private readonly auth: GCPAuth
    ) {}

    private async parseGCPError(response: Response): Promise<string> {
        try {
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const errorElement = xmlDoc.getElementsByTagName('Error')[0];

            if (errorElement) {
                const code = errorElement.getElementsByTagName('Code')[0]?.textContent ?? 'UnknownError';
                const message = errorElement.getElementsByTagName('Message')[0]?.textContent ?? 'Unknown error occurred';
                return `${code}: ${message}`;
            }
        } catch (error) {
            LogManager.log(LogLevel.Debug, 'Failed to parse GCP error response', error);
        }
        return `HTTP error! status: ${response.status}`;
    }

    private isDirectoryPath(path: string): boolean {
        return path === '/' || path.endsWith('/') || path.includes('/.') || path.includes('/./') || path.includes('/../');
    }

    async readFile(file: File): Promise<Uint8Array> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from GCP`);

        if (file.isDirectory || this.isDirectoryPath(file.name)) {
            LogManager.log(LogLevel.Debug, 'Skipping read for directory', { name: file.name });
            return new Uint8Array(0);
        }

        const remotePath = file.remoteName || file.name;
        if (this.isDirectoryPath(remotePath)) {
            LogManager.log(LogLevel.Debug, 'Skipping read for directory path', { path: remotePath });
            return new Uint8Array(0);
        }
        const fullPath = this.paths.addVaultPrefix(remotePath);
        const url = this.paths.getObjectUrl(this.bucket, fullPath);
        LogManager.log(LogLevel.Debug, 'Reading file:', {
            originalName: file.name,
            remoteName: file.remoteName,
            remotePath,
            fullPath,
            url
        });

        let retryCount = 0;
        const maxRetries = 3;
        const baseDelay = 1000;

        while (true) {
            try {
                const headers = await this.auth.getHeaders();
                const response = await fetch(url, { headers });

                if (!response.ok) {
                    const errorMessage = await this.parseGCPError(response);
                    throw new Error(`Remote read failed: ${errorMessage}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
                return buffer;
            } catch (error) {
                if (retryCount >= maxRetries) {
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, retryCount);
                LogManager.log(LogLevel.Debug, 'Retrying read operation', {
                    attempt: retryCount + 1,
                    delay,
                    error: error.message
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
            }
        }
    }

    async writeFile(file: File, content: Uint8Array): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to GCP (${content.length} bytes)`);

        if (file.isDirectory || this.isDirectoryPath(file.name)) {
            LogManager.log(LogLevel.Debug, 'Skipping write for directory', { name: file.name });
            return;
        }

        const remotePath = file.remoteName || file.name;
        if (this.isDirectoryPath(remotePath)) {
            LogManager.log(LogLevel.Debug, 'Skipping write for directory path', { path: remotePath });
            return;
        }
        const fullPath = this.paths.addVaultPrefix(remotePath);
        const url = this.paths.getObjectUrl(this.bucket, fullPath);
        LogManager.log(LogLevel.Debug, 'Writing file:', {
            originalName: file.name,
            remoteName: file.remoteName,
            remotePath,
            fullPath,
            url
        });

        let retryCount = 0;
        const maxRetries = 3;
        const baseDelay = 1000;

        while (true) {
            try {
                const headers = await this.auth.getHeaders();
                const response = await fetch(url, {
                    method: 'PUT',
                    body: content,
                    headers: {
                        ...headers,
                        'Content-Length': content.length.toString()
                    }
                });

                if (!response.ok) {
                    const errorMessage = await this.parseGCPError(response);
                    throw new Error(`Remote write failed: ${errorMessage}`);
                }

                LogManager.log(LogLevel.Trace, `Successfully wrote ${file.name} to GCP`);
                return;
            } catch (error) {
                if (retryCount >= maxRetries) {
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, retryCount);
                LogManager.log(LogLevel.Debug, 'Retrying write operation', {
                    attempt: retryCount + 1,
                    delay,
                    error: error.message
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
            }
        }
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Trace, `Deleting ${file.name} from GCP`);

        if (file.isDirectory || this.isDirectoryPath(file.name)) {
            LogManager.log(LogLevel.Debug, 'Skipping delete for directory', { name: file.name });
            return;
        }

        const remotePath = file.remoteName || file.name;
        if (this.isDirectoryPath(remotePath)) {
            LogManager.log(LogLevel.Debug, 'Skipping delete for directory path', { path: remotePath });
            return;
        }
        const fullPath = this.paths.addVaultPrefix(remotePath);
        const url = this.paths.getObjectUrl(this.bucket, fullPath);
        LogManager.log(LogLevel.Debug, 'Deleting file:', {
            originalName: file.name,
            remoteName: file.remoteName,
            remotePath,
            fullPath,
            url
        });

        let retryCount = 0;
        const maxRetries = 3;
        const baseDelay = 1000;

        while (true) {
            try {
                const headers = await this.auth.getHeaders();
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers
                });

                // GCP returns 404 for already deleted files, which is fine
                if (!response.ok && response.status !== 404) {
                    const errorMessage = await this.parseGCPError(response);
                    throw new Error(`Remote delete failed: ${errorMessage}`);
                }

                LogManager.log(LogLevel.Trace, `Successfully deleted ${file.name} from GCP`);
                return;
            } catch (error) {
                if (retryCount >= maxRetries) {
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, retryCount);
                LogManager.log(LogLevel.Debug, 'Retrying delete operation', {
                    attempt: retryCount + 1,
                    delay,
                    error: error.message
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
            }
        }
    }

    async getFiles(): Promise<File[]> {
        LogManager.log(LogLevel.Trace, 'Listing files in GCP bucket');
        const prefix = this.paths.getVaultPrefix();
        const url = new URL(this.paths.getBucketUrl(this.bucket));

        url.searchParams.append('prefix', prefix === '/' ? '' : prefix + '/');
        LogManager.log(LogLevel.Debug, 'List URL:', { url: url.toString(), prefix });

        let retryCount = 0;
        const maxRetries = 3;
        const baseDelay = 1000;

        while (true) {
            try {
                const headers = await this.auth.getHeaders();
                const response = await fetch(url, { headers });

                if (!response.ok) {
                    const errorMessage = await this.parseGCPError(response);
                    throw new Error(`Remote list failed: ${errorMessage}`);
                }

                const text = await response.text();
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
                    return [{
                        name: '/',
                        localName: '/',
                        remoteName: '/',
                        mime: 'application/octet-stream',
                        lastModified: new Date(),
                        size: 0,
                        md5: '',
                        isDirectory: true
                    }];
                }

                LogManager.log(LogLevel.Trace, `Found ${files.length} files in GCP bucket`);
                return files;
            } catch (error) {
                if (retryCount >= maxRetries) {
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, retryCount);
                LogManager.log(LogLevel.Debug, 'Retrying list operation', {
                    attempt: retryCount + 1,
                    delay,
                    error: error.message
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
            }
        }
    }
}
