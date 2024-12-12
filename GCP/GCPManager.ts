import { AbstractManager, File } from "../sync/AbstractManager";
import { CloudSyncSettings, LogLevel } from "../sync/types";
import { LogManager } from "../LogManager";
import { GCPAuth } from "./auth";
import { GCPFiles } from "./files";
import { GCPPaths } from "./paths";

interface GCPSession {
    token: string;
    expiry: number;
    headers: Record<string, string>;
}

export class GCPManager extends AbstractManager {
    public readonly name: string = 'GCP';

    private bucket: string = '';
    private vaultPrefix: string;
    private paths: GCPPaths;
    private auth: GCPAuth;
    private fileOps: GCPFiles;
    private currentSession: GCPSession | null = null;

    constructor(settings: CloudSyncSettings, vaultPrefix: string) {
        super(settings);
        this.vaultPrefix = vaultPrefix;
        this.paths = new GCPPaths(this.vaultPrefix);
        LogManager.log(LogLevel.Debug, `GCPManager initialized with vault prefix: ${this.vaultPrefix}`);
    }

    private validateSettings(): void {
        LogManager.log(LogLevel.Debug, 'GCP Validate Settings - Starting');
        LogManager.log(LogLevel.Debug, 'GCP Settings:', {
            clientEmail: this.settings.gcp.clientEmail,
            bucket: this.settings.gcp.bucket,
            privateKey: this.settings.gcp.privateKey.substring(0, 100) + '...'
        });

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

    private async ensureSession(): Promise<void> {
        if (!this.currentSession || Date.now() >= this.currentSession.expiry) {
            LogManager.log(LogLevel.Debug, 'Creating new GCP session');
            const token = await this.auth.getAccessToken();
            this.currentSession = {
                token,
                expiry: Date.now() + (3600 * 1000), // 1 hour
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/octet-stream'
                }
            };
            this.fileOps.setSession(this.currentSession);
            LogManager.log(LogLevel.Debug, 'New GCP session created', {
                expiresIn: Math.floor((this.currentSession.expiry - Date.now()) / 1000)
            });
        }
    }

    async startSyncSession(): Promise<void> {
        await this.ensureSession();
    }

    async authenticate(): Promise<void> {
        try {
            LogManager.log(LogLevel.Debug, 'GCP Authentication - Starting');
            this.validateSettings();
            await this.initializeClient();
            await this.startSyncSession();

            const result = await this.auth.testConnectivity();
            if (!result.success) {
                throw new Error(result.message);
            }

            LogManager.log(LogLevel.Trace, 'GCP Authentication - Success');
        } catch (error) {
            LogManager.log(LogLevel.Error, 'GCP Authentication - Failed', error);
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.validateSettings();
            await this.initializeClient();
            await this.startSyncSession();
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
        await this.ensureSession();
        return this.fileOps.readFile(file);
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        await this.ensureSession();
        await this.fileOps.writeFile(file, content);
    }

    async deleteFile(file: File): Promise<void> {
        await this.ensureSession();
        await this.fileOps.deleteFile(file);
    }

    async getFiles(): Promise<File[]> {
        await this.ensureSession();
        const files = await this.fileOps.getFiles();
        this.files = files;
        return files;
    }
}
