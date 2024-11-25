import { AbstractManager, File, SyncState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export class AzureManager extends AbstractManager {
    private client: ContainerClient | null = null;

    constructor(settings: CloudSyncSettings) {
        super(settings);
    }

    private validateSettings(): void {
        this.log(LogLevel.Debug, 'Azure Validate Settings - Starting');
        if (!this.settings.azure.account || this.settings.azure.account.trim() === '') {
            throw new Error('Azure Storage account name is required');
        }
        if (!this.settings.azure.accessKey || this.settings.azure.accessKey.trim() === '') {
            throw new Error('Azure Storage access key is required');
        }
        this.log(LogLevel.Debug, 'Azure Validate Settings - Success');
    }

    private createContainerClient(): ContainerClient {
        this.log(LogLevel.Debug, 'Azure Create Container Client - Starting');
        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${this.settings.azure.account};AccountKey=${this.settings.azure.accessKey};EndpointSuffix=core.windows.net`;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient('obsidian-sync');
        this.log(LogLevel.Debug, 'Azure Create Container Client - Success');
        return containerClient;
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Debug, 'Azure Authentication - Starting');
            this.validateSettings();
            this.client = this.createContainerClient();
            await this.client.createIfNotExists();
            this.state = SyncState.Ready;
            this.log(LogLevel.Trace, 'Azure Authentication - Success');
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Authentication - Failed', error);
            this.state = SyncState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.log(LogLevel.Debug, 'Azure Connection Test - Starting');
            this.validateSettings();

            const client = this.createContainerClient();
            const exists = await client.exists();

            if (exists) {
                this.log(LogLevel.Trace, 'Azure Connection Test - Success');
                return {
                    success: true,
                    message: "Successfully connected to Azure Storage"
                };
            } else {
                this.log(LogLevel.Info, 'Azure Connection Test - Container does not exist');
                return {
                    success: true,
                    message: "Connected to Azure Storage (container will be created during sync)"
                };
            }
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Connection Test - Failed', error);
            return {
                success: false,
                message: `Azure connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, 'Azure Read File - Starting', { file: file.remoteName });
        if (!this.client) {
            throw new Error('Not authenticated');
        }

        try {
            const blockBlobClient = this.client.getBlockBlobClient(file.remoteName);
            const downloadResponse = await blockBlobClient.download(0);

            if (!downloadResponse.readableStreamBody) {
                throw new Error('Empty response body');
            }

            const chunks: Buffer[] = [];
            // @ts-ignore
            for await (const chunk of downloadResponse.readableStreamBody) {
                chunks.push(Buffer.from(chunk));
            }

            const buffer = Buffer.concat(chunks);
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
        this.log(LogLevel.Debug, 'Azure Write File - Starting', {
            file: file.remoteName,
            size: content.length
        });

        if (!this.client) {
            throw new Error('Not authenticated');
        }

        try {
            const blockBlobClient = this.client.getBlockBlobClient(file.remoteName);
            await blockBlobClient.upload(content, content.length, {
                blobHTTPHeaders: {
                    blobContentType: file.mime
                }
            });
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
        this.log(LogLevel.Debug, 'Azure Delete File - Starting', { file: file.remoteName });
        if (!this.client) {
            throw new Error('Not authenticated');
        }

        try {
            const blockBlobClient = this.client.getBlockBlobClient(file.remoteName);
            await blockBlobClient.delete();
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
        this.log(LogLevel.Debug, 'Azure Get Files - Starting');
        if (!this.client) {
            throw new Error('Not authenticated');
        }

        try {
            const files: File[] = [];

            for await (const blob of this.client.listBlobsFlat()) {
                const properties = await this.client.getBlobClient(blob.name).getProperties();
                files.push({
                    name: blob.name,
                    localName: blob.name,
                    remoteName: blob.name,
                    mime: properties.contentType || 'application/octet-stream',
                    lastModified: properties.lastModified || new Date(),
                    size: properties.contentLength || 0,
                    md5: properties.contentMD5 ? Buffer.from(properties.contentMD5).toString('hex') : '',
                    isDirectory: false
                });
            }

            this.files = files;
            this.log(LogLevel.Debug, 'Azure Get Files - Success', { fileCount: files.length });
            return files;
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Get Files - Failed', error);
            throw error;
        }
    }
}
