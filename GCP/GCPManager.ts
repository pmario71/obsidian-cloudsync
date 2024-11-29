import { AbstractManager, File, ScanState } from '../AbstractManager';
import { CloudSyncSettings, LogLevel } from '../types';
import { GCPPaths } from './paths';
import { GCPFiles } from './files';
import { GCPAuth } from './auth';
import { LogManager } from '../LogManager';
import { GCPTestResult } from './types';

export class GCPManager extends AbstractManager {
    public readonly name: string = 'GCP';

    private bucket: string = '';
    private readonly vaultPrefix: string;

    private paths: GCPPaths;
    private fileOps: GCPFiles;
    private auth: GCPAuth;

    constructor(settings: CloudSyncSettings, vaultName: string) {
        super(settings);
        // Sanitize vault name for use as prefix
        this.vaultPrefix = vaultName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        this.paths = new GCPPaths(this.vaultPrefix);
        this.log(LogLevel.Debug, `GCPManager initialized with vault prefix: ${this.vaultPrefix}`);
    }

    private validateSettings(): void {
        this.log(LogLevel.Debug, 'GCP Validate Settings - Starting');
        if (!this.settings.gcp.privateKey || this.settings.gcp.privateKey.trim() === '') {
            throw new Error('GCP private key is required');
        }
        if (!this.settings.gcp.clientEmail || this.settings.gcp.clientEmail.trim() === '') {
            throw new Error('GCP client email is required');
        }
        if (!this.settings.gcp.bucket || this.settings.gcp.bucket.trim() === '') {
            throw new Error('GCP bucket name is required');
        }
        this.log(LogLevel.Debug, 'GCP Validate Settings - Success');
    }

    private logGCPSettings(): void {
        this.log(LogLevel.Debug, 'GCP Settings:', {
            clientEmail: this.settings.gcp.clientEmail,
            bucket: this.settings.gcp.bucket,
            privateKey: this.settings.gcp.privateKey.substring(0, 100) + '...' // Show first 100 chars only
        });
    }

    private async initializeClient(): Promise<void> {
        // Initialize core properties
        this.bucket = this.settings.gcp.bucket.trim();

        // Initialize auth module
        this.auth = new GCPAuth(this.bucket, this.paths);
        await this.auth.initialize(
            this.settings.gcp.clientEmail.trim(),
            this.settings.gcp.privateKey.trim()
        );

        // Initialize file operations
        this.fileOps = new GCPFiles(this.bucket, this.paths, this.auth);

        this.log(LogLevel.Debug, 'GCP Client Initialized', {
            bucket: this.bucket
        });
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Debug, 'GCP Authentication - Starting');
            this.logGCPSettings();
            this.validateSettings();
            await this.initializeClient();

            const testResult = await this.auth.testConnectivity();
            if (!testResult.success) {
                throw new Error(testResult.message);
            }

            this.state = ScanState.Ready;
            this.log(LogLevel.Trace, 'GCP Authentication - Success');
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Authentication - Failed', error);
            this.state = ScanState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<GCPTestResult> {
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
