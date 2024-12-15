import { AccountSASPermissions, AccountSASResourceTypes, AccountSASServices, StorageSharedKeyCredential, generateAccountSASQueryParameters, SASProtocol } from "@azure/storage-blob";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { AzurePaths } from "./paths";

export class AzureAuth {
    private sasToken = '';

    constructor(
        private readonly account: string,
        private readonly accessKey: string,
        private readonly paths: AzurePaths
    ) {}

    validateSettings(): void {
        LogManager.log(LogLevel.Debug, 'Validating Azure configuration');

        const maskedKey = this.accessKey
            ? `${this.accessKey.substring(0, 4)}...${this.accessKey.substring(this.accessKey.length - 4)}`
            : 'not set';

        LogManager.log(LogLevel.Debug, 'Azure credentials', {
            account: this.account || 'not set',
            accessKey: maskedKey
        });

        if (!this.account || this.account.trim() === '') {
            throw new Error('Azure Storage account name is required');
        }
        if (!this.accessKey || this.accessKey.trim() === '') {
            throw new Error('Azure Storage access key is required');
        }

        LogManager.log(LogLevel.Debug, 'Azure configuration validated');
    }

    generateSasToken(): string {
        LogManager.log(LogLevel.Debug, 'Generating Azure SAS token');

        const permissions = new AccountSASPermissions();
        permissions.read = true;
        permissions.write = true;
        permissions.delete = true;
        permissions.list = true;
        permissions.create = true;
        permissions.add = true;  // Add permission for container creation

        const services = new AccountSASServices();
        services.blob = true;

        const resourceTypes = new AccountSASResourceTypes();
        resourceTypes.container = true;
        resourceTypes.object = true;
        resourceTypes.service = true;

        const startsOn = new Date();
        const expiresOn = new Date(startsOn);
        expiresOn.setHours(startsOn.getHours() + 1);

        try {
            const sharedKeyCredential = new StorageSharedKeyCredential(
                this.account.trim(),
                this.accessKey.trim()
            );

            this.sasToken = generateAccountSASQueryParameters(
                {
                    permissions,
                    services: services.toString(),
                    resourceTypes: resourceTypes.toString(),
                    startsOn,
                    expiresOn,
                    protocol: SASProtocol.Https  // Use the correct enum value
                },
                sharedKeyCredential
            ).toString();

            LogManager.log(LogLevel.Debug, 'Azure SAS token generated');
            return this.sasToken;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to generate SAS token', error);
            throw new Error(`Failed to generate SAS token: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    getSasToken(): string {
        return this.sasToken || this.generateSasToken();
    }

    async ensureContainer(): Promise<void> {
        LogManager.log(LogLevel.Debug, 'Verifying Azure container exists');
        try {
            const listUrl = this.paths.getContainerUrl(this.account, this.getSasToken(), 'list');
            LogManager.log(LogLevel.Debug, 'Checking container with URL', { url: listUrl });

            const response = await fetch(listUrl);
            LogManager.log(LogLevel.Debug, 'Container check response', { status: response.status });

            if (response.status === 404) {
                LogManager.log(LogLevel.Debug, 'Container not found, creating new container');
                const createUrl = this.paths.getContainerUrl(this.account, this.getSasToken());
                LogManager.log(LogLevel.Debug, 'Creating container with URL', { url: createUrl });

                const createResponse = await fetch(createUrl, {
                    method: 'PUT',
                    headers: {
                        'x-ms-version': '2020-04-08'
                        // Removed 'x-ms-blob-public-access': 'container' to create private container
                    }
                });

                if (createResponse.status === 201) {
                    LogManager.log(LogLevel.Debug, 'Azure container created successfully');
                } else if (createResponse.status === 403) {
                    throw new Error(
                        'Permission denied when creating container. Please ensure:\n' +
                        '1. Your storage account key is correct\n' +
                        '2. CORS is enabled on your Azure Storage account'
                    );
                } else {
                    const text = await createResponse.text();
                    throw new Error(`Failed to create container. Status: ${createResponse.status}, Response: ${text}`);
                }
            } else if (response.status !== 200) {
                const text = await response.text();
                throw new Error(`Unexpected response when checking container. Status: ${response.status}, Response: ${text}`);
            }

            LogManager.log(LogLevel.Trace, 'Azure container verified');
        } catch (error) {
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                throw new Error(
                    'Unable to connect to Azure Storage. Please check:\n' +
                    '1. Your internet connection\n' +
                    '2. CORS is enabled on your Azure Storage account'
                );
            }
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            LogManager.log(LogLevel.Debug, 'Testing Azure connectivity');
            this.validateSettings();

            const url = this.paths.getContainerUrl(this.account, this.getSasToken(), 'list');
            LogManager.log(LogLevel.Debug, 'Testing connectivity with URL', { url });

            const response = await fetch(url);
            LogManager.log(LogLevel.Debug, 'Connectivity test response', { status: response.status });

            if (response.status === 200) {
                LogManager.log(LogLevel.Trace, 'Azure connectivity test successful');
                return {
                    success: true,
                    message: "Successfully connected to Azure Storage"
                };
            } else if (response.status === 404) {
                LogManager.log(LogLevel.Debug, 'Azure container not found (will be created during sync)');
                return {
                    success: true,
                    message: "Connected to Azure Storage (container will be created during sync)"
                };
            }

            const text = await response.text();
            throw response.status === 403
                ? new Error(
                    'Permission denied. Please verify:\n' +
                    '1. Your storage account key is correct\n' +
                    '2. CORS is enabled on your Azure Storage account'
                )
                : new Error(`HTTP status: ${response.status}, Response: ${text}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Azure connectivity test failed', error);
            return {
                success: false,
                message: `Azure connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                details: error
            };
        }
    }
}
