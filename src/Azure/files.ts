import { File } from "../sync/AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { AzurePathHandler } from "./AzurePathHandler";
import { AzureAuth } from "./auth";
import { App, requestUrl } from "obsidian";
import { CacheManagerService } from "../sync/utils/cacheUtils";

export class AzureFiles {
    private readonly cacheService: CacheManagerService;

    constructor(
        private readonly account: string,
        private readonly paths: AzurePathHandler,
        private readonly auth: AzureAuth,
        private readonly app: App
    ) {
        this.paths.setCredentials(account, this.auth.getSasToken());
        this.cacheService = CacheManagerService.getInstance();
    }

    async readFile(file: File): Promise<Uint8Array> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from Azure (remote name: ${file.remoteName})`);
        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            LogManager.log(LogLevel.Debug, 'Prepared Azure request', {
                url,
                remoteName: file.remoteName,
                name: file.name
            });

            const response = await requestUrl({ url, method: 'GET' });
            if (response.status !== 200) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const buffer = new Uint8Array(response.arrayBuffer);
            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to read ${file.name} from Azure`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Uint8Array): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to Azure (${content.length} bytes, remote name: ${file.remoteName})`);
        try {
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            LogManager.log(LogLevel.Debug, 'Prepared Azure request', {
                url,
                size: content.length
            });

            const response = await requestUrl({
                url,
                method: 'PUT',
                body: content.buffer as ArrayBuffer,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'x-ms-blob-type': 'BlockBlob'
                }
            });

            if (response.status !== 200 && response.status !== 201) {
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
            const url = this.paths.getBlobUrl(this.account, file.remoteName, this.auth.getSasToken());
            LogManager.log(LogLevel.Debug, 'Prepared Azure request', {
                originalName: file.name,
                remoteName: file.remoteName,
                url
            });

            const response = await requestUrl({
                url,
                method: 'DELETE'
            });

            if (response.status !== 200 && response.status !== 202) {
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
            const url = this.paths.getAzureContainerUrl(this.account, this.auth.getSasToken(), 'list');
            LogManager.log(LogLevel.Debug, 'Prepared Azure list request', { url });

            const response = await requestUrl({ url });
            if (response.status === 404) {
                throw new Error('NEW_CONTAINER');
            }
            if (response.status !== 200) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = response.text;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const blobs = xmlDoc.getElementsByTagName('Blob');

            const rawNames = Array.from(blobs)
                .map(blob => blob.getElementsByTagName('Name')[0]?.textContent ?? '')
                .filter(name => name);
            LogManager.log(LogLevel.Trace, 'Raw names from Azure:');
            for (const name of rawNames) {
                LogManager.log(LogLevel.Trace, name);
            }

            LogManager.log(LogLevel.Debug, `Processing ${blobs.length} blobs from response`);

            const files: File[] = [];
            for (const blob of Array.from(blobs)) {
                const nameElement = blob.getElementsByTagName('Name')[0];
                const propertiesElement = blob.getElementsByTagName('Properties')[0];

                if (nameElement && propertiesElement) {
                    const rawName = nameElement.textContent ?? '';
                    LogManager.log(LogLevel.Trace, `Raw name from Azure XML: "${rawName}" (hex: ${[...rawName].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')})`);
                    const normalizedName = this.paths.normalizeCloudPath(this.paths.decodePathProperly(rawName));

                    const contentLength = propertiesElement.getElementsByTagName('Content-Length')[0]?.textContent ?? '0';
                    const contentType = propertiesElement.getElementsByTagName('Content-Type')[0]?.textContent ?? '';
                    const lastModified = propertiesElement.getElementsByTagName('Last-Modified')[0]?.textContent;
                    const contentMD5 = propertiesElement.getElementsByTagName('Content-MD5')[0]?.textContent;

                    LogManager.log(LogLevel.Debug, 'Processing blob', {
                        name: normalizedName,
                        size: contentLength
                    });

                    const md5 = contentMD5
                        ? Array.from(Uint8Array.from(atob(contentMD5), c => c.charCodeAt(0)))
                            .map(b => {
                                const hex = b.toString(16);
                                return hex.length === 1 ? '0' + hex : hex;
                            })
                            .join('')
                        : '';

                    files.push({
                        name: normalizedName,
                        localName: '',
                        remoteName: rawName,
                        mime: contentType,
                        lastModified: lastModified ? new Date(lastModified) : new Date(),
                        size: Number(contentLength),
                        md5,
                        isDirectory: false
                    });
                }
            }

            LogManager.log(LogLevel.Trace, `Found ${files.length} files in Azure container`);
            return files;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to list files in Azure container', error);
            throw error;
        }
    }
}
