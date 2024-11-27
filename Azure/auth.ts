import { LogLevel } from '../types';
import { LogManager } from '../LogManager';
import { AzurePaths } from './paths';
import { AzureTestResult, AzureSasOptions } from './types';
import {
    generateAccountSASQueryParameters,
    AccountSASPermissions,
    AccountSASServices,
    AccountSASResourceTypes,
    StorageSharedKeyCredential
} from "@azure/storage-blob";

export class AzureAuth {
    private sasToken: string = '';

    constructor(
        private account: string,
        private accessKey: string,
        private paths: AzurePaths
    ) {}

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    private validateSettings(): void {
        this.log(LogLevel.Debug, 'Azure Validate Settings');

        // Debug log for account name
        this.log(LogLevel.Debug, 'Azure Account', {
            account: this.account || 'not set'
        });

        // Debug log for access key (masked)
        const maskedKey = this.accessKey
            ? `${this.accessKey.substring(0, 4)}...${this.accessKey.substring(this.accessKey.length - 4)}`
            : 'not set';
        this.log(LogLevel.Debug, 'Azure Access Key', {
            accessKey: maskedKey
        });

        if (!this.account || this.account.trim() === '') {
            throw new Error('Azure Storage account name is required');
        }
        if (!this.accessKey || this.accessKey.trim() === '') {
            throw new Error('Azure Storage access key is required');
        }
        this.log(LogLevel.Debug, 'Azure Validate Settings - Success');
    }

    generateSasToken(): string {
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
            this.account,
            this.accessKey
        );

        this.sasToken = generateAccountSASQueryParameters({
            permissions: permissions,
            services: services.toString(),
            resourceTypes: resourceTypes.toString(),
            startsOn: startDate,
            expiresOn: expiryDate,
        }, sharedKeyCredential).toString();

        this.log(LogLevel.Debug, 'Azure Generate SAS token - Success');
        return this.sasToken;
    }

    getSasToken(): string {
        if (!this.sasToken) {
            this.generateSasToken();
        }
        return this.sasToken;
    }

    async ensureContainer(): Promise<void> {
        this.log(LogLevel.Debug, 'Azure Ensure Container - Started');

        const containerUrl = this.paths.getContainerUrl(this.account, this.getSasToken(), 'list');
        const response = await fetch(containerUrl);

        if (response.status !== 200) {
            const createUrl = this.paths.getContainerUrl(this.account, this.getSasToken());
            const createResponse = await fetch(createUrl, {
                method: 'PUT'
            });

            if (createResponse.status !== 201) {
                throw new Error(`Failed to create container. Status: ${createResponse.status}`);
            }
            this.log(LogLevel.Info, 'Azure container created successfully');
        }

        this.log(LogLevel.Debug, 'Azure Ensure Container - Success');
    }

    async testConnectivity(): Promise<AzureTestResult> {
        try {
            this.log(LogLevel.Debug, 'Azure Connection Test');
            this.validateSettings();

            const containerUrl = this.paths.getContainerUrl(this.account, this.getSasToken(), 'list');
            const response = await fetch(containerUrl);

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
}
