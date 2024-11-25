import { AbstractManager, File, SyncState } from './AbstractManager';
import { CloudSyncSettings } from './types';
import {
    BlobServiceClient,
    StorageSharedKeyCredential,
    ContainerClient
} from "@azure/storage-blob";

export class AzureManager extends AbstractManager {
    private blobServiceClient: BlobServiceClient | null = null;
    private containerClient: ContainerClient | null = null;

    constructor(settings: CloudSyncSettings) {
        super(settings);
    }

    private validateSettings(): void {
        if (!this.settings.azure.account || this.settings.azure.account.trim() === '') {
            throw new Error('Azure Storage Account is required');
        }
        if (!this.settings.azure.accessKey || this.settings.azure.accessKey.trim() === '') {
            throw new Error('Azure Access Key is required');
        }
    }

    async authenticate(): Promise<void> {
        try {
            this.debugLog('Azure Authentication - Starting');
            this.validateSettings();
            this.debugLog('Azure settings validated successfully');

            const sharedKeyCredential = new StorageSharedKeyCredential(
                this.settings.azure.account.trim(),
                this.settings.azure.accessKey.trim()
            );

            this.blobServiceClient = new BlobServiceClient(
                `https://${this.settings.azure.account.trim()}.blob.core.windows.net`,
                sharedKeyCredential
            );

            this.debugLog('Azure client created');

            // Create default container if it doesn't exist
            const containerName = 'obsidian-sync';
            this.containerClient = this.blobServiceClient.getContainerClient(containerName);
            await this.containerClient.createIfNotExists();

            this.state = SyncState.Ready;
            this.debugLog('Azure Authentication - Success');
        } catch (error) {
            this.debugLog('Azure Authentication - Failed', error);
            this.state = SyncState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.debugLog('Azure Connection Test - Starting');
            this.validateSettings();

            const sharedKeyCredential = new StorageSharedKeyCredential(
                this.settings.azure.account.trim(),
                this.settings.azure.accessKey.trim()
            );

            const blobServiceClient = new BlobServiceClient(
                `https://${this.settings.azure.account.trim()}.blob.core.windows.net`,
                sharedKeyCredential
            );

            this.debugLog('Azure client created');

            // List containers to verify access
            const containers = blobServiceClient.listContainers();
            await containers.next();

            this.debugLog('Azure Connection Test - Success');
            return {
                success: true,
                message: "Successfully connected to Azure Storage"
            };
        } catch (error) {
            this.debugLog('Azure Connection Test - Failed', error);
            return {
                success: false,
                message: `Azure connection failed: ${error.message}`,
                details: error
            };
        }
    }

    async readFile(file: File): Promise<Buffer> {
        this.debugLog('Azure Read File - Starting', { file: file.remoteName });
        if (!this.containerClient) {
            this.debugLog('Azure Read File - Failed: Not authenticated');
            throw new Error('Not authenticated');
        }

        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(file.remoteName);
            const downloadResponse = await blockBlobClient.download(0);

            if (!downloadResponse.readableStreamBody) {
                this.debugLog('Azure Read File - Failed: No data received');
                throw new Error('No data received');
            }

            const chunks: Buffer[] = [];
            for await (const chunk of downloadResponse.readableStreamBody) {
                chunks.push(Buffer.from(chunk));
            }

            const buffer = Buffer.concat(chunks);
            this.debugLog('Azure Read File - Success', {
                file: file.remoteName,
                size: buffer.length
            });
            return buffer;
        } catch (error) {
            this.debugLog('Azure Read File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.debugLog('Azure Write File - Starting', {
            file: file.remoteName,
            size: content.length
        });

        if (!this.containerClient) {
            this.debugLog('Azure Write File - Failed: Not authenticated');
            throw new Error('Not authenticated');
        }

        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(file.remoteName);

            await blockBlobClient.upload(content, content.length, {
                blobHTTPHeaders: {
                    blobContentType: file.mime
                }
            });

            this.debugLog('Azure Write File - Success', { file: file.remoteName });
        } catch (error) {
            this.debugLog('Azure Write File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.debugLog('Azure Delete File - Starting', { file: file.remoteName });
        if (!this.containerClient) {
            this.debugLog('Azure Delete File - Failed: Not authenticated');
            throw new Error('Not authenticated');
        }

        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(file.remoteName);
            await blockBlobClient.delete();
            this.debugLog('Azure Delete File - Success', { file: file.remoteName });
        } catch (error) {
            this.debugLog('Azure Delete File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.debugLog('Azure Get Files - Starting');
        if (!this.containerClient) {
            this.debugLog('Azure Get Files - Failed: Not authenticated');
            throw new Error('Not authenticated');
        }

        try {
            const files: File[] = [];

            for await (const blob of this.containerClient.listBlobsFlat()) {
                const properties = await this.containerClient
                    .getBlobClient(blob.name)
                    .getProperties();

                files.push({
                    name: blob.name,
                    localName: blob.name,
                    remoteName: blob.name,
                    mime: properties.contentType || 'application/octet-stream',
                    lastModified: properties.lastModified || new Date(),
                    size: properties.contentLength || 0,
                    md5: properties.contentMD5 ? Buffer.from(properties.contentMD5).toString('hex') : '',
                    isDirectory: false // Azure Blob Storage doesn't have real directories
                });
            }

            this.files = files;
            this.debugLog('Azure Get Files - Success', { fileCount: files.length });
            return files;
        } catch (error) {
            this.debugLog('Azure Get Files - Failed', error);
            throw error;
        }
    }
}
