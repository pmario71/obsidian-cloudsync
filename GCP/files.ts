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
        this.log(LogLevel.Debug, 'GCP Read File - Started', { file: file.remoteName });
        try {
            await this.auth.refreshToken();
            // Use remoteName directly if it's a full path
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.paths.addVaultPrefix(file.remoteName);
            const url = this.paths.getObjectUrl(this.bucket, fullPath);
            this.log(LogLevel.Debug, 'GCP Read File - URL', { url });

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

            this.log(LogLevel.Debug, 'GCP Read File - Success', {
                file: file.remoteName,
                size: buffer.length
            });
            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Read File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Debug, 'GCP Write File - Starting', {
            file: file.remoteName,
            size: content.length
        });

        try {
            await this.auth.refreshToken();
            // Use remoteName directly if it's a full path
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.paths.addVaultPrefix(file.remoteName);
            const url = this.paths.getObjectUrl(this.bucket, fullPath);
            this.log(LogLevel.Debug, 'GCP Write File - URL', { url });

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

            this.log(LogLevel.Debug, 'GCP Write File - Success', { file: file.remoteName });
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Write File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'GCP Delete File - Starting', { file: file.remoteName });
        try {
            await this.auth.refreshToken();
            // Use remoteName directly if it's a full path
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.paths.addVaultPrefix(file.remoteName);
            const url = this.paths.getObjectUrl(this.bucket, fullPath);
            this.log(LogLevel.Debug, 'GCP Delete File - URL', { url });

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${this.auth.getAccessToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.log(LogLevel.Debug, 'GCP Delete File - Success', { file: file.remoteName });
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Delete File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.log(LogLevel.Debug, 'GCP Get Files - Starting');
        try {
            await this.auth.refreshToken();
            const url = this.paths.getBucketUrl(this.bucket) +
                       `?prefix=${encodeURIComponent(this.paths.addVaultPrefix(''))}`;

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
                return [];
            }

            const processedFiles: File[] = items.map((item: GCPFileMetadata) => {
                const key = item.Key[0];
                const lastModified = new Date(item.LastModified[0]);
                const eTag = item.ETag[0];
                const size = Number(item.Size[0]);

                // Remove the vault prefix from the name for local operations
                const nameWithoutPrefix = this.paths.removeVaultPrefix(decodeURIComponent(key));
                // Normalize the path to ensure consistent forward slashes
                const normalizedName = this.paths.normalizeCloudPath(nameWithoutPrefix);

                return {
                    name: normalizedName,
                    localName: normalizedName,
                    remoteName: key,  // Keep encoded name for remote operations
                    mime: 'application/octet-stream', // MIME type not provided in XML response
                    lastModified: lastModified,
                    size: size,
                    md5: eTag.replace(/"/g, ''), // Remove quotes from ETag
                    isDirectory: false
                };
            });

            this.log(LogLevel.Debug, 'GCP Get Files - Success', { fileCount: processedFiles.length });
            return processedFiles;
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Get Files - Failed', error);
            throw error;
        }
    }
}
