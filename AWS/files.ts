import { File } from '../AbstractManager';
import { LogLevel } from '../types';
import { LogManager } from '../LogManager';
import { AWSSigning } from './signing';
import { AWSPaths } from './paths';
import * as xml2js from 'xml2js';

export class AWSFiles {
    constructor(
        private bucket: string,
        private endpoint: string,
        private signing: AWSSigning,
        private paths: AWSPaths
    ) {}

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

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
            this.log(LogLevel.Debug, 'Error response body', { text });

            const errorXml = await xml2js.parseStringPromise(text);
            if (errorXml.Error) {
                const code = errorXml.Error.Code?.[0];
                const message = errorXml.Error.Message?.[0];
                return `${code}: ${message}`;
            }
        } catch (e) {
            this.log(LogLevel.Debug, 'Error parsing error response', e);
        }
        return `HTTP error! status: ${response.status}`;
    }

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, 'AWS Read File - Started', { file: file.remoteName });
        try {
            // Always ensure the path has the vault prefix
            const encodedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));

            this.log(LogLevel.Debug, 'AWS Read File - Path prepared', {
                original: file.remoteName || file.name,
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
            this.log(LogLevel.Debug, 'AWS Read File - URL constructed', {
                endpoint: this.endpoint,
                bucket: this.bucket,
                encodedPath,
                finalUrl: url
            });

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

            this.log(LogLevel.Debug, 'AWS Read File - Success', {
                file: file.remoteName || file.name,
                size: buffer.length
            });
            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Read File - Failed', {
                file: file.remoteName || file.name,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Debug, 'AWS Write File - Starting', {
            file: file.remoteName || file.name,
            size: content.length,
            mime: file.mime,
            isBuffer: Buffer.isBuffer(content),
            bufferType: content.constructor.name
        });

        try {
            // Always ensure the path has the vault prefix
            const encodedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));

            this.log(LogLevel.Debug, 'AWS Write File - Path prepared', {
                original: file.remoteName || file.name,
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
            this.log(LogLevel.Debug, 'AWS Write File - URL constructed', {
                endpoint: this.endpoint,
                bucket: this.bucket,
                encodedPath,
                finalUrl: url
            });

            this.log(LogLevel.Debug, 'AWS Write File - Request prepared', {
                url,
                method: 'PUT',
                headerKeys: Object.keys(headers),
                contentLength: content.length,
                contentType: headers['content-type'],
                contentHash: headers['x-amz-content-sha256']
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
                this.log(LogLevel.Error, 'AWS Write File - Response error', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: this.getResponseHeaders(response)
                });
                const errorMessage = await this.parseErrorResponse(response);
                throw new Error(errorMessage);
            }

            this.log(LogLevel.Debug, 'AWS Write File - Success', { file: file.remoteName || file.name });
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Write File - Failed', {
                file: file.remoteName || file.name,
                error,
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'AWS Delete File - Starting', { file: file.remoteName });
        try {
            // Always ensure the path has the vault prefix
            const encodedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));

            this.log(LogLevel.Debug, 'AWS Delete File - Path prepared', {
                original: file.remoteName || file.name,
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
            this.log(LogLevel.Debug, 'AWS Delete File - URL constructed', {
                endpoint: this.endpoint,
                bucket: this.bucket,
                encodedPath,
                finalUrl: url
            });

            const response = await fetch(url, {
                method: 'DELETE',
                headers
            });

            if (response.status !== 204 && !response.ok) {
                this.log(LogLevel.Error, 'AWS Delete File - Response error', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: this.getResponseHeaders(response)
                });
                const errorMessage = await this.parseErrorResponse(response);
                throw new Error(errorMessage);
            }

            this.log(LogLevel.Debug, 'AWS Delete File - Success', { file: file.remoteName || file.name });
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Delete File - Failed', {
                file: file.remoteName || file.name,
                error
            });
            throw error;
        }
    }

    async getFiles(vaultPrefix: string): Promise<File[]> {
        this.log(LogLevel.Debug, 'AWS Get Files - Starting');
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
            this.log(LogLevel.Debug, 'AWS Get Files - URL constructed', {
                endpoint: this.endpoint,
                bucket: this.bucket,
                queryString,
                finalUrl: url
            });

            const response = await fetch(url, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                this.log(LogLevel.Error, 'AWS Get Files - Response error', {
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
                return [];
            }

            const processedFiles: File[] = items.map((item: any) => {
                const key = item.Key[0];
                const lastModified = new Date(item.LastModified[0]);
                const eTag = item.ETag[0];
                const size = Number(item.Size[0]);

                // Convert remote name to local name
                const nameWithoutPrefix = this.paths.removeVaultPrefix(key);
                const localName = this.paths.remoteToLocalName(nameWithoutPrefix);

                return {
                    name: localName,
                    localName: localName,
                    remoteName: key,  // Keep the full remote path including vault prefix
                    mime: 'application/octet-stream', // MIME type not provided in XML response
                    lastModified: lastModified,
                    size: size,
                    md5: eTag.replace(/"/g, ''), // Remove quotes from ETag
                    isDirectory: false
                };
            });

            this.log(LogLevel.Debug, 'AWS Get Files - Success', { fileCount: processedFiles.length });
            return processedFiles;
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Get Files - Failed', error);
            throw error;
        }
    }
}
