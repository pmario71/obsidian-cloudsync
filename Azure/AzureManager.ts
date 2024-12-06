import { AbstractManager, File, ScanState } from '../sync/AbstractManager';
import { CloudSyncSettings, LogLevel } from '../sync/types';
import { AzurePaths } from './paths';
import { AzureFiles } from './files';
import { AzureAuth } from './auth';
import { LogManager } from '../LogManager';
import { AzureTestResult } from './types';

export class AzureManager extends AbstractManager {
    public readonly name: string = 'Azure';

    private readonly containerName: string;
    private paths: AzurePaths;
    private fileOps: AzureFiles;
    private auth: AzureAuth;

    constructor(settings: CloudSyncSettings, vaultName: string) {
        super(settings);
        this.containerName = vaultName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        this.paths = new AzurePaths(this.containerName);
        this.log(LogLevel.Debug, `AzureManager initialized for container: ${this.containerName}`);
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

    private async initializeClient(): Promise<void> {
        const account = this.settings.azure.account.trim();
        const accessKey = this.settings.azure.accessKey.trim();

        // Initialize auth module
        this.auth = new AzureAuth(account, accessKey, this.paths);

        // Initialize file operations
        this.fileOps = new AzureFiles(account, this.paths, this.auth);

        this.log(LogLevel.Debug, 'Azure Client Initialized', {
            account,
            containerName: this.containerName
        });
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Trace, 'Azure Authentication');
            this.validateSettings();
            await this.initializeClient();
            await this.auth.ensureContainer();
            this.state = ScanState.Ready;
        } catch (error) {
            this.log(LogLevel.Error, 'Azure Authentication - Failed', error);
            this.state = ScanState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<AzureTestResult> {
        try {
            this.validateSettings();
            await this.initializeClient();
            return await this.auth.testConnectivity();
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error
            };
        }
    }

    async readFile(file: File): Promise<Buffer> {
        return this.fileOps.readFile(file);
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        await this.fileOps.writeFile(file, content);
    }

    async deleteFile(file: File): Promise<void> {
        await this.fileOps.deleteFile(file);
    }

    async getFiles(): Promise<File[]> {
        const files = await this.fileOps.getFiles();
        this.files = files;
        return files;
    }
}
