import { AbstractManager, File } from "../sync/AbstractManager";
import { CloudSyncSettings, LogLevel } from "../sync/types";
import { LogManager } from "../LogManager";
import { AzureAuth } from "./auth";
import { AzureFiles } from "./files";
import { AzurePaths } from "./paths";

export class AzureManager extends AbstractManager {
    public readonly name: string = 'Azure';

    private containerName: string;
    private paths: AzurePaths;
    private auth: AzureAuth;
    private fileOps: AzureFiles;

    constructor(settings: CloudSyncSettings, vaultName: string) {
        super(settings);
        // Sanitize container name according to Azure rules:
        // 1. Convert to lowercase
        // 2. Replace invalid chars with single dash
        // 3. Remove consecutive dashes
        // 4. Ensure starts with letter/number
        // 5. Ensure between 3-63 chars
        this.containerName = vaultName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')     // Replace invalid chars with dash
            .replace(/-+/g, '-')              // Replace multiple dashes with single dash
            .replace(/^[^a-z0-9]+/, '')       // Remove leading non-alphanumeric
            .replace(/[^a-z0-9]+$/, '');      // Remove trailing non-alphanumeric

        // Ensure minimum length of 3 by padding if necessary
        if (this.containerName.length < 3) {
            this.containerName = this.containerName.padEnd(3, 'x');
        }
        // Truncate to maximum length of 63
        if (this.containerName.length > 63) {
            this.containerName = this.containerName.substring(0, 63);
            // Ensure it doesn't end with a dash after truncating
            this.containerName = this.containerName.replace(/[^a-z0-9]+$/, '');
        }

        this.paths = new AzurePaths(this.containerName);
        LogManager.log(LogLevel.Debug, `AzureManager initialized for container: ${this.containerName}`);
    }

    private validateSettings(): void {
        LogManager.log(LogLevel.Debug, 'Azure Validate Settings');

        LogManager.log(LogLevel.Debug, 'Azure Account', {
            account: this.settings.azure.account || 'not set'
        });

        const maskedKey = this.settings.azure.accessKey
            ? `${this.settings.azure.accessKey.substring(0, 4)}...${this.settings.azure.accessKey.substring(this.settings.azure.accessKey.length - 4)}`
            : 'not set';

        LogManager.log(LogLevel.Debug, 'Azure Access Key', {
            accessKey: maskedKey
        });

        if (!this.settings.azure.account || this.settings.azure.account.trim() === '') {
            throw new Error('Azure Storage account name is required');
        }
        if (!this.settings.azure.accessKey || this.settings.azure.accessKey.trim() === '') {
            throw new Error('Azure Storage access key is required');
        }

        LogManager.log(LogLevel.Debug, 'Azure Validate Settings - Success');
    }

    private async initializeClient(): Promise<void> {
        const account = this.settings.azure.account.trim();
        const accessKey = this.settings.azure.accessKey.trim();

        this.auth = new AzureAuth(account, accessKey, this.paths);
        this.fileOps = new AzureFiles(account, this.paths, this.auth);

        LogManager.log(LogLevel.Debug, 'Azure Client Initialized', {
            account,
            containerName: this.containerName
        });
    }

    async authenticate(): Promise<void> {
        try {
            LogManager.log(LogLevel.Trace, 'Azure Authentication');
            this.validateSettings();
            await this.initializeClient();
            await this.auth.ensureContainer();
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Azure Authentication - Failed', error);
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.validateSettings();
            await this.initializeClient();
            return await this.auth.testConnectivity();
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : "Unknown error",
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
