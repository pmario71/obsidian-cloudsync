import { AbstractManager, File, ScanState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import {
  generateAccountSASQueryParameters,
  AccountSASPermissions,
  AccountSASServices,
  AccountSASResourceTypes,
  StorageSharedKeyCredential
} from "@azure/storage-blob";
import * as xml2js from "xml2js";
import { posix } from 'path';

export class AzureManager extends AbstractManager {
    private sasToken: string = '';
    private readonly containerName: string;

    constructor(settings: CloudSyncSettings, vaultName: string) {
        super(settings);
        this.containerName = vaultName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        this.log(LogLevel.Debug, `AzureManager initialized for container: ${this.containerName}`);
    }

    public getProviderName(): string {
        return 'azure';
    }

    private validateSettings(): void {
        this.log(LogLevel.Debug, 'Azure Validate Settings');

        // Debug log for account name
        this.log(LogLevel.Debug, 'Azure Account', {
            account: this.settings.azure.account || 'not set'
        });

        // Debug log for access key (masked)
        const maskedKey = this.settings.azure.accessKey
            ? `${this.settings.azure.accessKey.substring(0, 4)}...${this.settings.azure.accessKey.substring(this.settings.azure.accessKey.length - 4)}`
            : 'not set';
        this.log(LogLevel.Debug, 'Azure Access Key', {
            accessKey: maskedKey
        });

        if (!this.settings.azure.account || this.settings.azure.account.trim() === '') {
            throw new Error('Azure Storage account name is required');
        }
        if (!this.settings.azure.accessKey || this.settings.azure.accessKey.trim() === '') {
            throw new Error('Azure Storage access key is required');
        }
        this.log(LogLevel.Debug, 'Azure Validate Settings - Success');
    }

    private generateSasToken(): string {
        this.log(LogLevel.Debug, 'Azure Generate SAS token - Started');

        const permissions = new AccountSASPermissions();
        permissions.read = true;
        permissions.write = true;
        permissions.delete = true;
        permissions.list = true;

        const services = new AccountSASServices();
        services.blob = true;

        const resourceTypes = new AccountSASResourceTypes();
        resourceTypes.container = true;
        resourceTypes.object = true;

        const startDate = new Date();
        const expiryDate = new Date(startDate);
        expiryDate.setHours(startDate.getHours() + 1);

        const sharedKeyCredential = new StorageSharedKeyCredential(
            this.settings.azure.account,
            this.settings.azure.accessKey
        );

        this.log(LogLevel.Debug, 'Azure Generate SAS token - Success');
        return generateAccountSASQueryParameters({
            permissions: permissions,
            services: services.toString(),
            resourceTypes: resourceTypes.toString(),
            startsOn: startDate,
            expiresOn: expiryDate,
        }, sharedKeyCredential).toString();
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Trace, 'Azure Authentication');
            this.validateSettings();

            this.sasToken = this.generateSasToken();
            const containerUrl = `https://${this.settings.azure.account}.blob.core.windows.net/${this.containerName}`;

            // Check if container exists
            const response = await fetch(`${containerUrl}?restype=container&comp=list&${this.sasToken}`);

            if (response.status !== 200) {
                const createResponse = await fetch(`${containerUrl}?restype=container&${this.sasToken}`, {
                    method: 'PUT'
                });

                if (createResponse.status !== 201) {
                    throw new Error(`Failed to create container. Status: ${createResponse.status}`);
                }
                this.log(LogLevel.Info, `Azure container ${this.containerName} created successfully`);
            }

            this.state = ScanState.Ready;
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Authentication - Failed', error);
            this.state = ScanState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.log(LogLevel.Debug, 'Azure Connection Test');
            this.validateSettings();

            const sasToken = this.generateSasToken();
            const containerUrl = `https://${this.settings.azure.account}.blob.core.windows.net/${this.containerName}`;
            const response = await fetch(`${containerUrl}?restype=container&comp=list&${sasToken}`);

            if (response.status === 200) {
                this.log(LogLevel.Debug, 'Azure Connection Test - Success');
                return {
                    success: true,
                    message: "Successfully connected to Azure Storage"
                };
            } else if (response.status === 404) {
                this.log(LogLevel.Info, 'Azure Connection Test - Container does not exist');
                return {
                    success: true,
                    message: "Connected to Azure Storage (container will be created during scan)"
                };
            } else {
                throw new Error(`HTTP status: ${response.status}`);
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
        this.log(LogLevel.Debug, 'Azure Read File - Started', { file: file.remoteName });

        try {
            const url = `https://${this.settings.azure.account}.blob.core.windows.net/${this.containerName}/${file.remoteName}?${this.sasToken}`;
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
            const url = `https://${this.settings.azure.account}.blob.core.windows.net/${this.containerName}/${file.remoteName}?${this.sasToken}`;
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
            const url = `https://${this.settings.azure.account}.blob.core.windows.net/${this.containerName}/${file.remoteName}?${this.sasToken}`;
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

    private normalizeCloudPath(path: string): string {
        // Ensure consistent forward slash usage for cloud paths
        return path.split('/').join(posix.sep);
    }

    public async getFiles(): Promise<File[]> {
        this.log(LogLevel.Trace, 'Azure list files');

        try {
            const url = `https://${this.settings.azure.account}.blob.core.windows.net/${this.containerName}?restype=container&comp=list&${this.sasToken}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.text();
            const result = await xml2js.parseStringPromise(data);
            const blobs = result.EnumerationResults.Blobs[0].Blob;
            this.log(LogLevel.Debug, 'Azure Get Files - Blobs found', { blobCount: blobs?.length ?? 0 });

            let files: File[] = [];

            if (blobs) {
                files = blobs.map((blob: any) => {
                    const properties = blob.Properties[0];
                    const encodedName = blob.Name[0];
                    const decodedName = decodeURIComponent(encodedName);
                    // Normalize the path to ensure consistent forward slashes
                    const normalizedName = this.normalizeCloudPath(decodedName);
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
