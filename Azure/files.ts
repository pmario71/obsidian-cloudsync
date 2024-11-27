import { File } from '../AbstractManager';
import { LogLevel } from '../types';
import { LogManager } from '../LogManager';
import { AzurePaths } from './paths';
import { AzureAuth } from './auth';
import { AzureBlob, AzureListBlobsResult } from './types';
import * as xml2js from 'xml2js';

export class AzureFiles {
    constructor(
        private account: string,
        private paths: AzurePaths,
        private auth: AzureAuth
    ) {}

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, 'Azure Read File - Started', { file: file.remoteName });

        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.arrayBuffer();
            const buffer = Buffer.from(data);

            this.log(LogLevel.Debug, 'Azure Read File - Success', {
                file: file.remoteName,
                size: buffer.length
            });

            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Read File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Debug, 'Azure Write File - Started', {
            file: file.remoteName,
            size: content.length
        });

        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            const response = await fetch(url, {
                method: "PUT",
                body: content,
                headers: {
                    "Content-Type": "application/octet-stream",
                    "x-ms-blob-type": "BlockBlob",
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.log(LogLevel.Debug, 'Azure Write File - Success', { file: file.remoteName });
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Write File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'Azure Delete File - Started', { file: file.remoteName });

        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            const response = await fetch(url, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.log(LogLevel.Debug, 'Azure Delete File - Success', { file: file.remoteName });
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Delete File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.log(LogLevel.Trace, 'Azure list files');

        try {
            const url = this.paths.getContainerUrl(this.account, this.auth.getSasToken(), 'list');
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.text();
            const result = await xml2js.parseStringPromise(data) as AzureListBlobsResult;
            const blobs = result.EnumerationResults.Blobs[0].Blob;
            this.log(LogLevel.Debug, 'Azure Get Files - Blobs found', { blobCount: blobs?.length ?? 0 });

            let files: File[] = [];

            if (blobs) {
                files = blobs.map((blob: AzureBlob) => {
                    const properties = blob.Properties[0];
                    const encodedName = blob.Name[0];
                    // Normalize the path to ensure consistent forward slashes
                    const normalizedName = this.paths.normalizeCloudPath(
                        this.paths.decodePathProperly(encodedName)
                    );
                    this.log(LogLevel.Debug, 'Azure blob:', { normalizedName });

                    const md5Hash = properties["Content-MD5"][0]
                        ? Buffer.from(properties["Content-MD5"][0], "base64").toString("hex")
                        : "";

                    return {
                        name: normalizedName,
                        localName: "",
                        remoteName: encodedName,
                        mime: properties["Content-Type"][0] || "",
                        lastModified: properties["Last-Modified"][0]
                            ? new Date(properties["Last-Modified"][0])
                            : new Date(),
                        size: properties["Content-Length"][0]
                            ? Number(properties["Content-Length"][0])
                            : 0,
                        md5: md5Hash,
                        isDirectory: false,
                    };
                });
            }

            this.log(LogLevel.Debug, 'Azure Get Files - Success', { fileCount: files.length });
            return files;
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Get Files - Failed', error);
            throw error;
        }
    }
}
