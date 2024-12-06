import { File } from '../sync/AbstractManager';
import { LogLevel } from '../sync/types';
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
        this.log(LogLevel.Trace, `Reading ${file.name} from Azure`);

        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            this.log(LogLevel.Debug, 'Prepared Azure request', { url });

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.arrayBuffer();
            const buffer = Buffer.from(data);

            this.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, `Failed to read ${file.name} from Azure`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Trace, `Writing ${file.name} to Azure (${content.length} bytes)`);

        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            this.log(LogLevel.Debug, 'Prepared Azure request', {
                url,
                size: content.length
            });

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

            this.log(LogLevel.Trace, `Successfully wrote ${file.name} to Azure`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to write ${file.name} to Azure`, error);
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Trace, `Deleting ${file.name} from Azure`);

        try {
            const encodedBlobName = this.paths.encodePathProperly(file.remoteName);
            const url = this.paths.getBlobUrl(this.account, encodedBlobName, this.auth.getSasToken());

            this.log(LogLevel.Debug, 'Prepared Azure request', {
                originalName: file.name,
                encodedName: encodedBlobName,
                url
            });

            const response = await fetch(url, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.log(LogLevel.Trace, `Successfully deleted ${file.name} from Azure`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to delete ${file.name} from Azure`, error);
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.log(LogLevel.Trace, 'Listing files in Azure container');

        try {
            const url = this.paths.getContainerUrl(this.account, this.auth.getSasToken(), 'list');
            this.log(LogLevel.Debug, 'Prepared Azure list request', { url });

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.text();
            const result = await xml2js.parseStringPromise(data) as AzureListBlobsResult;
            const blobs = result.EnumerationResults.Blobs[0].Blob;

            this.log(LogLevel.Debug, `Processing ${blobs?.length ?? 0} blobs from response`);

            let files: File[] = [];

            if (blobs) {
                files = blobs.map((blob: AzureBlob) => {
                    const properties = blob.Properties[0];
                    const encodedName = blob.Name[0];
                    const normalizedName = this.paths.normalizeCloudPath(
                        this.paths.decodePathProperly(encodedName)
                    );

                    this.log(LogLevel.Debug, 'Processing blob', {
                        name: normalizedName,
                        size: properties["Content-Length"][0]
                    });

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

            this.log(LogLevel.Trace, `Found ${files.length} files in Azure container`);
            return files;
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to list files in Azure container', error);
            throw error;
        }
    }
}
