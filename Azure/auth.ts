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
        this.log(LogLevel.Debug, 'Validating Azure configuration');

        const maskedKey = this.accessKey
            ? `${this.accessKey.substring(0, 4)}...${this.accessKey.substring(this.accessKey.length - 4)}`
            : 'not set';
        this.log(LogLevel.Debug, 'Azure credentials', {
            account: this.account || 'not set',
            accessKey: maskedKey
        });

        if (!this.account || this.account.trim() === '') {
            throw new Error('Azure Storage account name is required');
        }
        if (!this.accessKey || this.accessKey.trim() === '') {
            throw new Error('Azure Storage access key is required');
        }
        this.log(LogLevel.Debug, 'Azure configuration validated');
    }

    generateSasToken(): string {
        this.log(LogLevel.Debug, 'Generating Azure SAS token');

        const permissions = new AccountSASPermissions();
        permissions.read = true;
        permissions.write = true;
        permissions.delete = true;
        permissions.list = true;
        permissions.create = true; // Add create permission for new containers

        const services = new AccountSASServices();
        services.blob = true;

        const resourceTypes = new AccountSASResourceTypes();
        resourceTypes.container = true;
        resourceTypes.object = true;
        resourceTypes.service = true; // Add service level access for container creation

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

        this.log(LogLevel.Debug, 'Azure SAS token generated');
        return this.sasToken;
    }

    getSasToken(): string {
        if (!this.sasToken) {
            this.generateSasToken();
        }
        return this.sasToken;
    }

    async ensureContainer(): Promise<void> {
        this.log(LogLevel.Debug, 'Verifying Azure container exists');

        try {
            const containerUrl = this.paths.getContainerUrl(this.account, this.getSasToken(), 'list');
            const response = await fetch(containerUrl);

            if (response.status === 404) {
                this.log(LogLevel.Debug, 'Container not found, creating new container');
                const createUrl = this.paths.getContainerUrl(this.account, this.getSasToken());
                const createResponse = await fetch(createUrl, {
                    method: 'PUT'
                });

                if (createResponse.status === 201) {
                    this.log(LogLevel.Debug, 'Azure container created successfully');
                } else if (createResponse.status === 403) {
                    throw new Error(
                        'Permission denied when creating container. Please ensure:\n' +
                        '1. Your storage account key is correct\n' +
                        '2. CORS is enabled on your Azure Storage account:\n' +
                        '   - Go to Azure Portal > Your Storage Account > Settings > Resource sharing (CORS)\n' +
                        '   - Add a new CORS rule:\n' +
                        '     * Allowed origins: *\n' +
                        '     * Allowed methods: DELETE,GET,HEAD,MERGE,POST,OPTIONS,PUT\n' +
                        '     * Allowed headers: *\n' +
                        '     * Exposed headers: *\n' +
                        '     * Max age: 86400'
                    );
                } else {
                    throw new Error(`Failed to create container. Status: ${createResponse.status}`);
                }
            } else if (response.status === 403) {
                throw new Error(
                    'Permission denied when accessing Azure Storage. Please ensure:\n' +
                    '1. Your storage account key is correct\n' +
                    '2. CORS is enabled on your Azure Storage account:\n' +
                    '   - Go to Azure Portal > Your Storage Account > Settings > Resource sharing (CORS)\n' +
                    '   - Add a new CORS rule:\n' +
                    '     * Allowed origins: *\n' +
                    '     * Allowed methods: DELETE,GET,HEAD,MERGE,POST,OPTIONS,PUT\n' +
                    '     * Allowed headers: *\n' +
                    '     * Exposed headers: *\n' +
                    '     * Max age: 86400'
                );
            } else if (response.status !== 200) {
                throw new Error(`Unexpected response when checking container. Status: ${response.status}`);
            }

            this.log(LogLevel.Trace, 'Azure container verified');
        } catch (error) {
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                throw new Error(
                    'Unable to connect to Azure Storage. Please check:\n' +
                    '1. Your internet connection\n' +
                    '2. The storage account name is correct\n' +
                    '3. CORS is enabled on your Azure Storage account:\n' +
                    '   - Go to Azure Portal > Your Storage Account > Settings > Resource sharing (CORS)\n' +
                    '   - Add a new CORS rule:\n' +
                    '     * Allowed origins: *\n' +
                    '     * Allowed methods: DELETE,GET,HEAD,MERGE,POST,OPTIONS,PUT\n' +
                    '     * Allowed headers: *\n' +
                    '     * Exposed headers: *\n' +
                    '     * Max age: 86400'
                );
            }
            throw error;
        }
    }

    async testConnectivity(): Promise<AzureTestResult> {
        try {
            this.log(LogLevel.Debug, 'Testing Azure connectivity');
            this.validateSettings();

            const containerUrl = this.paths.getContainerUrl(this.account, this.getSasToken(), 'list');
            const response = await fetch(containerUrl);

            if (response.status === 200) {
                this.log(LogLevel.Trace, 'Azure connectivity test successful');
                return {
                    success: true,
                    message: "Successfully connected to Azure Storage"
                };
            } else if (response.status === 404) {
                this.log(LogLevel.Debug, 'Azure container not found (will be created during sync)');
                return {
                    success: true,
                    message: "Connected to Azure Storage (container will be created during sync)"
                };
            } else if (response.status === 403) {
                throw new Error(
                    'Permission denied. Please verify:\n' +
                    '1. Your storage account key is correct\n' +
                    '2. CORS is enabled on your Azure Storage account'
                );
            } else {
                throw new Error(`HTTP status: ${response.status}`);
            }
        } catch (error) {
            this.log(LogLevel.Error, 'Azure connectivity test failed', error);
            return {
                success: false,
                message: `Azure connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }
}
