import { File } from '../sync/AbstractManager';
import { LogLevel } from '../sync/types';
import { LogManager } from '../LogManager';
import { AWSSigning } from './signing';
import { AWSPaths } from './paths';
import { encodeURIPath } from './encoding';
import * as xml2js from 'xml2js';

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

            const errorXml = await xml2js.parseStringPromise(text);
            if (errorXml.Error) {
                const code = errorXml.Error.Code?.[0];
                const message = errorXml.Error.Message?.[0];
                return `${code}: ${message}`;
            }
        } catch (e) {
            LogManager.log(LogLevel.Debug, 'Failed to parse error response', e);
        }
        return `HTTP error! status: ${response.status}`;
    }

    async readFile(file: File): Promise<Buffer> {
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
            const buffer = Buffer.from(arrayBuffer);

            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to read ${file.name} from S3`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to S3 (${content.length} bytes)`);

        try {
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
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to write ${file.name} to S3`, error);
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

            const queryString = Object.entries(queryParams)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');

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

            const data = await response.text();
            const result = await xml2js.parseStringPromise(data);
            const items = result.ListBucketResult?.Contents || [];

            if (!items || items.length === 0) {
                LogManager.log(LogLevel.Debug, 'No files found in S3 bucket');
                return [];
            }

            const processedFiles: File[] = items.map((item: any) => {
                const key = item.Key[0];
                const lastModified = new Date(item.LastModified[0]);
                const eTag = item.ETag[0];
                const size = Number(item.Size[0]);

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
