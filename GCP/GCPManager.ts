import { AbstractManager, File } from "../sync/AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel, CloudSyncSettings } from "../sync/types";
import { GCPAuth } from "./auth";
import { GCPFiles } from "./files";
import { GCPPaths } from "./paths";

export interface GCPSettings {
    bucket: string;
    clientEmail: string;
    privateKey: string;
}

export class GCPManager extends AbstractManager {
    readonly name = 'GCP';
    private auth: GCPAuth;
    private fileHandler: GCPFiles;
    private paths: GCPPaths;
    files: File[] = [];

    constructor(settings: CloudSyncSettings, gcpSettings: GCPSettings, vaultPath: string) {
        super(settings);
        this.paths = new GCPPaths(vaultPath);
        this.auth = new GCPAuth(gcpSettings.bucket, this.paths);
        this.fileHandler = new GCPFiles(gcpSettings.bucket, this.paths, this.auth);
    }

    async initialize(): Promise<void> {
        LogManager.log(LogLevel.Trace, 'Initializing GCP manager');
        try {
            await this.auth.initialize(this.settings.gcp.clientEmail, this.settings.gcp.privateKey);
            LogManager.log(LogLevel.Trace, 'GCP manager initialized successfully');
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to initialize GCP manager', { error });
            throw error;
        }
    }

    async authenticate(): Promise<void> {
        LogManager.log(LogLevel.Trace, 'Authenticating with GCP');
        try {
            LogManager.log(LogLevel.Debug, 'Testing GCP connectivity with current token');
            const result = await this.auth.testConnectivity();
            if (!result.success) {
                LogManager.log(LogLevel.Debug, 'Connectivity test failed', result);
                throw new Error(result.message);
            }
            LogManager.log(LogLevel.Trace, 'GCP authentication successful');
        } catch (error) {
            LogManager.log(LogLevel.Error, 'GCP authentication failed', { error });
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: unknown }> {
        return this.auth.testConnectivity();
    }

    async readFile(file: File): Promise<Uint8Array> {
        return this.fileHandler.readFile(file);
    }

    async writeFile(file: File, content: Uint8Array): Promise<void> {
        await this.fileHandler.writeFile(file, content);
    }

    async deleteFile(file: File): Promise<void> {
        await this.fileHandler.deleteFile(file);
    }

    async getFiles(): Promise<File[]> {
        this.files = await this.fileHandler.getFiles();
        return this.files;
    }
}
