import { AbstractManager, File } from "../sync/AbstractManager";
import { CloudSyncSettings, LogLevel } from "../sync/types";
import { LogManager } from "../LogManager";
import { AzureAuth } from "./auth";
import { AzureFiles } from "./files";
import { AzurePaths } from "./paths";
import { App } from "obsidian";

export class AzureManager extends AbstractManager {
    public readonly name: string = 'Azure';

    private containerName: string;
    private paths: AzurePaths;
    private auth: AzureAuth;
    private fileOps: AzureFiles;

    constructor(settings: CloudSyncSettings, vaultName: string) {
        super(settings);
        this.containerName = vaultName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[^a-z0-9]+/, '')
            .replace(/[^a-z0-9]+$/, '');

        while (this.containerName.length < 3) {
            this.containerName = this.containerName + 'x';
        }

        if (this.containerName.length > 63) {
            this.containerName = this.containerName.substring(0, 63);
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

        // Get App instance from settings
        const app = (this.settings as any).app as App;
        if (!app) {
            throw new Error('App instance not available in settings');
        }

        this.auth = new AzureAuth(account, accessKey, this.paths, app);
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
            if (error instanceof Error && error.message === 'NEW_CONTAINER') {
                LogManager.log(LogLevel.Info, 'New Azure container created, will perform fresh sync');
                return; // Allow sync to proceed with empty remote
            }
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

    async readFile(file: File): Promise<Uint8Array> {
        return this.fileOps.readFile(file);
    }

    async writeFile(file: File, content: Uint8Array): Promise<void> {
        await this.fileOps.writeFile(file, content);
    }

    async deleteFile(file: File): Promise<void> {
        await this.fileOps.deleteFile(file);
    }

    async getFiles(): Promise<File[]> {
        try {
            const files = await this.fileOps.getFiles();
            this.files = files;
            return files;
        } catch (error) {
            if (error instanceof Error && error.message === 'NEW_CONTAINER') {
                LogManager.log(LogLevel.Info, 'New container detected, returning empty file list');
                this.files = [];
                return [];
            }
            throw error;
        }
    }
}
