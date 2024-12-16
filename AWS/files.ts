import { File } from '../sync/AbstractManager';
import { LogLevel } from '../sync/types';
import { LogManager } from '../LogManager';
import { AWSSigning } from './signing';
import { AWSPaths } from './paths';
import { encodeURIPath } from './encoding';

const MAX_RETRIES = 3;

export class AWSFiles {
    constructor(
        private readonly bucket: string,
        private readonly endpoint: string,
        private readonly signing: AWSSigning,
        private readonly paths: AWSPaths
    ) {}

    private getResponseHeaders(response: Response): Record<string, string> {
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });
        return headers;
    }

    private async parseErrorResponse(response: Response): Promise<string> {
        try {
            const text = await response.text();
            LogManager.log(LogLevel.Debug, 'Parsing error response', { text });

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const errorElement = xmlDoc.getElementsByTagName('Error')[0];

            if (errorElement) {
                const code = errorElement.getElementsByTagName('Code')[0]?.textContent;
                const message = errorElement.getElementsByTagName('Message')[0]?.textContent;
                return `${code}: ${message}`;
            }
        } catch (e) {
            LogManager.log(LogLevel.Debug, 'Failed to parse error response', e);
        }
        return `HTTP error! status: ${response.status}`;
    }

    private isRateLimitError(error: Error): boolean {
        return error.message.includes('SlowDown');
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private getRetryDelay(retryCount: number): number {
        if (retryCount <= 2) return (retryCount + 1) * 1000;
        return 3000;
    }

    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        retryCount = 0
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (!(error instanceof Error) || !this.isRateLimitError(error) || retryCount >= MAX_RETRIES) {
                throw error;
            }

            const delayMs = this.getRetryDelay(retryCount);
            LogManager.log(LogLevel.Debug, `Rate limit hit, retrying in ${delayMs}ms`, {
                attempt: retryCount + 1,
                maxRetries: MAX_RETRIES
            });

            await this.delay(delayMs);
            return this.retryWithBackoff(operation, retryCount + 1);
        }
    }

    async readFile(file: File): Promise<Uint8Array> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from S3`);
        try {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));
            const encodedPath = encodeURIPath(prefixedPath);

            LogManager.log(LogLevel.Debug, 'Prepared S3 path', {
                original: file.name,
                prefixedPath,
                encodedPath
            });

            const headers = await this.signing.signRequest({
                method: 'GET',
                path: `/${this.bucket}/${encodedPath}`,
                queryParams: {},
                host: new URL(this.endpoint).host,
                amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
                contentType: 'application/octet-stream'
            });

            const url = `${this.endpoint}/${this.bucket}/${encodedPath}`;
            LogManager.log(LogLevel.Debug, 'Constructed S3 URL', { url });

            const response = await fetch(url, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                const errorMessage = await this.parseErrorResponse(response);
                throw new Error(errorMessage);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);

            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to read ${file.name} from S3`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Uint8Array): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to S3 (${content.length} bytes)`);

        const operation = async () => {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));
            const encodedPath = encodeURIPath(prefixedPath);

            LogManager.log(LogLevel.Debug, 'Prepared S3 path', {
                original: file.name,
                prefixedPath,
                encodedPath
            });

            const headers = await this.signing.signRequest({
                method: 'PUT',
                path: `/${this.bucket}/${encodedPath}`,
                queryParams: {},
                host: new URL(this.endpoint).host,
                amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
                contentType: 'application/octet-stream',
                body: content
            });

            const url = `${this.endpoint}/${this.bucket}/${encodedPath}`;
            LogManager.log(LogLevel.Debug, 'Prepared S3 request', {
                url,
                method: 'PUT',
                contentLength: content.length,
                contentType: headers['content-type']
            });

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    ...headers,
                    'Content-Length': content.length.toString()
                },
                body: content
            });

            if (!response.ok) {
                LogManager.log(LogLevel.Debug, 'S3 write response error', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: this.getResponseHeaders(response)
                });
                const errorMessage = await this.parseErrorResponse(response);
                throw new Error(errorMessage);
            }

            LogManager.log(LogLevel.Trace, `Successfully wrote ${file.name} to S3`);
        };

        try {
            await this.retryWithBackoff(operation);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to write ${file.name} to S3 after retries`, error);
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Trace, `Deleting ${file.name} from S3`);
        try {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));
            const encodedPath = encodeURIPath(prefixedPath);

            LogManager.log(LogLevel.Debug, 'Prepared S3 path', {
                original: file.name,
                prefixedPath,
                encodedPath
            });

            const headers = await this.signing.signRequest({
                method: 'DELETE',
                path: `/${this.bucket}/${encodedPath}`,
                queryParams: {},
                host: new URL(this.endpoint).host,
                amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
                contentType: 'application/octet-stream'
            });

            const url = `${this.endpoint}/${this.bucket}/${encodedPath}`;
            LogManager.log(LogLevel.Debug, 'Prepared S3 request', { url });

            const response = await fetch(url, {
                method: 'DELETE',
                headers
            });

            if (response.status !== 204 && !response.ok) {
                LogManager.log(LogLevel.Debug, 'S3 delete response error', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: this.getResponseHeaders(response)
                });
                const errorMessage = await this.parseErrorResponse(response);
                throw new Error(errorMessage);
            }

            LogManager.log(LogLevel.Trace, `Successfully deleted ${file.name} from S3`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete ${file.name} from S3`, error);
            throw error;
        }
    }

    async getFiles(vaultPrefix: string): Promise<File[]> {
        LogManager.log(LogLevel.Trace, 'Listing files in S3 bucket');
        try {
            const queryParams = {
                'list-type': '2',
                'prefix': vaultPrefix + '/'
            };

            const headers = await this.signing.signRequest({
                method: 'GET',
                path: `/${this.bucket}`,
                queryParams,
                host: new URL(this.endpoint).host,
                amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
                contentType: 'application/xml'
            });

            const queryString = new URLSearchParams(queryParams).toString();
            const url = `${this.endpoint}/${this.bucket}?${queryString}`;
            LogManager.log(LogLevel.Debug, 'Prepared S3 list request', { url });

            const response = await fetch(url, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                LogManager.log(LogLevel.Debug, 'S3 list response error', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: this.getResponseHeaders(response)
                });
                const errorMessage = await this.parseErrorResponse(response);
                throw new Error(errorMessage);
            }

            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const contents = xmlDoc.getElementsByTagName('Contents');

            if (!contents || contents.length === 0) {
                LogManager.log(LogLevel.Debug, 'No files found in S3 bucket');
                return [];
            }

            const processedFiles: File[] = Array.from(contents).map(item => {
                const key = item.getElementsByTagName('Key')[0]?.textContent || '';
                const lastModified = new Date(item.getElementsByTagName('LastModified')[0]?.textContent || '');
                const eTag = item.getElementsByTagName('ETag')[0]?.textContent || '';
                const size = Number(item.getElementsByTagName('Size')[0]?.textContent || '0');

                const nameWithoutPrefix = this.paths.removeVaultPrefix(key);
                const localName = this.paths.remoteToLocalName(nameWithoutPrefix);

                return {
                    name: localName,
                    localName: localName,
                    remoteName: key,
                    mime: 'application/octet-stream',
                    lastModified: lastModified,
                    size: size,
                    md5: eTag.replace(/"/g, ''),
                    isDirectory: false
                };
            });

            LogManager.log(LogLevel.Trace, `Found ${processedFiles.length} files in S3 bucket`);
            return processedFiles;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to list files in S3 bucket', error);
            throw error;
        }
    }
}
