import { File } from "../sync/AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { AzurePaths } from "./paths";
import { AzureAuth } from "./auth";
import { parseStringPromise } from "xml2js";

export class AzureFiles {
    constructor(
        private readonly account: string,
        private readonly paths: AzurePaths,
        private readonly auth: AzureAuth
    ) {}

    async readFile(file: File): Promise<Buffer> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from Azure`);
        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            LogManager.log(LogLevel.Debug, 'Prepared Azure request', { url });

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to read ${file.name} from Azure`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to Azure (${content.length} bytes)`);
        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            LogManager.log(LogLevel.Debug, 'Prepared Azure request', {
                url,
                size: content.length
            });

            const response = await fetch(url, {
                method: 'PUT',
                body: content,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'x-ms-blob-type': 'BlockBlob'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            LogManager.log(LogLevel.Trace, `Successfully wrote ${file.name} to Azure`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to write ${file.name} to Azure`, error);
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Trace, `Deleting ${file.name} from Azure`);
        try {
            const encodedName = this.paths.encodePathProperly(file.remoteName);
            const url = this.paths.getBlobUrl(this.account, encodedName, this.auth.getSasToken());
            LogManager.log(LogLevel.Debug, 'Prepared Azure request', {
                originalName: file.name,
                encodedName: encodedName,
                url
            });

            const response = await fetch(url, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            LogManager.log(LogLevel.Trace, `Successfully deleted ${file.name} from Azure`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete ${file.name} from Azure`, error);
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        LogManager.log(LogLevel.Trace, 'Listing files in Azure container');
        try {
            const url = this.paths.getContainerUrl(this.account, this.auth.getSasToken(), 'list');
            LogManager.log(LogLevel.Debug, 'Prepared Azure list request', { url });

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            const result = await parseStringPromise(text);
            const blobs = result.EnumerationResults.Blobs[0].Blob;

            LogManager.log(LogLevel.Debug, `Processing ${blobs?.length ?? 0} blobs from response`);

            const files: File[] = [];
            if (blobs) {
                files.push(...blobs.map((blob: any) => {
                    const properties = blob.Properties[0];
                    const name = blob.Name[0];
                    const normalizedName = this.paths.normalizeCloudPath(this.paths.decodePathProperly(name));

                    LogManager.log(LogLevel.Debug, 'Processing blob', {
                        name: normalizedName,
                        size: properties['Content-Length'][0]
                    });

                    const md5 = properties['Content-MD5'][0]
                        ? Buffer.from(properties['Content-MD5'][0], 'base64').toString('hex')
                        : '';

                    return {
                        name: normalizedName,
                        localName: '',
                        remoteName: name,
                        mime: properties['Content-Type'][0] || '',
                        lastModified: properties['Last-Modified'][0] ? new Date(properties['Last-Modified'][0]) : new Date(),
                        size: properties['Content-Length'][0] ? Number(properties['Content-Length'][0]) : 0,
                        md5,
                        isDirectory: false
                    };
                }));
            }

            LogManager.log(LogLevel.Trace, `Found ${files.length} files in Azure container`);
            return files;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to list files in Azure container', error);
            throw error;
        }
    }
}
