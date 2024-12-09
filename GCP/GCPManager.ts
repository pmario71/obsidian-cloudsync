import { AbstractManager, File, ScanState } from "../sync/AbstractManager";
import { CloudSyncSettings, LogLevel } from "../sync/types";
import { LogManager } from "../LogManager";
import { GCPAuth } from "./auth";
import { GCPFiles } from "./files";
import { GCPPaths } from "./paths";

export class GCPManager extends AbstractManager {
    public readonly name: string = 'GCP';

    private bucket: string = '';
    private vaultPrefix: string;
    private paths: GCPPaths;
    private auth: GCPAuth;
    private fileOps: GCPFiles;

    constructor(settings: CloudSyncSettings, vaultPrefix: string) {
        super(settings);
        this.vaultPrefix = vaultPrefix;
        this.paths = new GCPPaths(this.vaultPrefix);
        LogManager.log(LogLevel.Debug, `GCPManager initialized with vault prefix: ${this.vaultPrefix}`);
    }

    private validateSettings(): void {
        LogManager.log(LogLevel.Debug, 'GCP Validate Settings - Starting');
        if (!this.settings.gcp.privateKey || this.settings.gcp.privateKey.trim() === '') {
            throw new Error('GCP private key is required');
        }
        if (!this.settings.gcp.clientEmail || this.settings.gcp.clientEmail.trim() === '') {
            throw new Error('GCP client email is required');
        }
        if (!this.settings.gcp.bucket || this.settings.gcp.bucket.trim() === '') {
            throw new Error('GCP bucket name is required');
        }
        LogManager.log(LogLevel.Debug, 'GCP Validate Settings - Success');
    }

    private logGCPSettings(): void {
        LogManager.log(LogLevel.Debug, 'GCP Settings:', {
            clientEmail: this.settings.gcp.clientEmail,
            bucket: this.settings.gcp.bucket,
            privateKey: this.settings.gcp.privateKey.substring(0, 100) + '...'
        });
    }

    private async initializeClient(): Promise<void> {
        this.bucket = this.settings.gcp.bucket.trim();
        this.auth = new GCPAuth(this.bucket, this.paths);
        await this.auth.initialize(
            this.settings.gcp.clientEmail.trim(),
            this.settings.gcp.privateKey.trim()
        );
        this.fileOps = new GCPFiles(this.bucket, this.paths, this.auth);

        LogManager.log(LogLevel.Debug, 'GCP Client Initialized', {
            bucket: this.bucket
        });
    }

    async authenticate(): Promise<void> {
        try {
            LogManager.log(LogLevel.Debug, 'GCP Authentication - Starting');
            this.logGCPSettings();
            this.validateSettings();
            await this.initializeClient();

            const result = await this.auth.testConnectivity();
            if (!result.success) {
                throw new Error(result.message);
            }

            this.state = ScanState.Ready;
            LogManager.log(LogLevel.Trace, 'GCP Authentication - Success');
        } catch (error) {
            LogManager.log(LogLevel.Error, 'GCP Authentication - Failed', error);
            this.state = ScanState.Error;
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
