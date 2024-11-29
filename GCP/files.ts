import { File } from '../AbstractManager';
import { LogLevel } from '../types';
import { LogManager } from '../LogManager';
import { GCPPaths } from './paths';
import { GCPAuth } from './auth';
import * as xml2js from 'xml2js';
import { GCPFileMetadata } from './types';

export class GCPFiles {
    constructor(
        private bucket: string,
        private paths: GCPPaths,
        private auth: GCPAuth
    ) {}

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Trace, `Reading ${file.name} from GCP`);
        try {
            await this.auth.refreshToken();
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.paths.addVaultPrefix(file.remoteName);
            const url = this.paths.getObjectUrl(this.bucket, fullPath);

            this.log(LogLevel.Debug, 'Prepared GCP request', { url });

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.auth.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            this.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, `Failed to read ${file.name} from GCP`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Trace, `Writing ${file.name} to GCP (${content.length} bytes)`);

        try {
            await this.auth.refreshToken();
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.paths.addVaultPrefix(file.remoteName);
            const url = this.paths.getObjectUrl(this.bucket, fullPath);

            this.log(LogLevel.Debug, 'Prepared GCP request', {
                url,
                size: content.length,
                mime: file.mime
            });

            const response = await fetch(url, {
                method: 'PUT',
                body: content,
                headers: {
                    Authorization: `Bearer ${this.auth.getAccessToken()}`,
                    'Content-Type': file.mime
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.log(LogLevel.Trace, `Successfully wrote ${file.name} to GCP`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to write ${file.name} to GCP`, error);
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Trace, `Deleting ${file.name} from GCP`);
        try {
            await this.auth.refreshToken();
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.paths.addVaultPrefix(file.remoteName);
            const url = this.paths.getObjectUrl(this.bucket, fullPath);

            this.log(LogLevel.Debug, 'Prepared GCP request', { url });

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${this.auth.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.log(LogLevel.Trace, `Successfully deleted ${file.name} from GCP`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to delete ${file.name} from GCP`, error);
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.log(LogLevel.Trace, 'Listing files in GCP bucket');
        try {
            await this.auth.refreshToken();
            const url = this.paths.getBucketUrl(this.bucket) +
                       `?prefix=${encodeURIComponent(this.paths.addVaultPrefix(''))}`;

            this.log(LogLevel.Debug, 'Prepared GCP list request', { url });

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.auth.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.text();
            const result = await xml2js.parseStringPromise(data);
            const items = result.ListBucketResult.Contents;

            if (!items || items.length === 0) {
                this.log(LogLevel.Debug, 'No files found in GCP bucket');
                return [];
            }

            this.log(LogLevel.Debug, `Processing ${items.length} items from response`);

            const processedFiles: File[] = items.map((item: GCPFileMetadata) => {
                const key = item.Key[0];
                const lastModified = new Date(item.LastModified[0]);
                const eTag = item.ETag[0];
                const size = Number(item.Size[0]);

                const nameWithoutPrefix = this.paths.removeVaultPrefix(decodeURIComponent(key));
                const normalizedName = this.paths.normalizeCloudPath(nameWithoutPrefix);

                this.log(LogLevel.Debug, 'Processing file', {
                    name: normalizedName,
                    size: size
                });

                return {
                    name: normalizedName,
                    localName: normalizedName,
                    remoteName: key,
                    mime: 'application/octet-stream',
                    lastModified: lastModified,
                    size: size,
                    md5: eTag.replace(/"/g, ''),
                    isDirectory: false
                };
            });

            this.log(LogLevel.Trace, `Found ${processedFiles.length} files in GCP bucket`);
            return processedFiles;
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to list files in GCP bucket', error);
            throw error;
        }
    }
}
