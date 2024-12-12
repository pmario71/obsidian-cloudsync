import { CloudSyncSettings, LogLevel } from "./types";
import { LogManager } from "../LogManager";

export interface File {
    name: string;
    localName: string;
    remoteName: string;
    mime: string;
    lastModified: Date;
    size: number;
    md5: string;
    isDirectory: boolean;
}

export abstract class AbstractManager {
    public abstract readonly name: string;

    public files: File[];
    public lastScan: Date | null;
    protected settings: CloudSyncSettings;

    constructor(settings: CloudSyncSettings) {
        this.files = [];
        this.lastScan = null;
        this.settings = settings;
        LogManager.log(LogLevel.Debug, `${this.constructor.name} initialized`);
    }

    public abstract testConnectivity(): Promise<{
        success: boolean;
        message: string;
        details?: unknown;
    }>;

    public abstract authenticate(): Promise<void>;

    public abstract getFiles(): Promise<File[]>;

    public setLastScan(date: Date): void {
        this.lastScan = date;
        LogManager.log(LogLevel.Debug, 'Updated last scan time', { timestamp: date.toISOString() });
    }

    public getLastSync(): Date | null {
        return this.lastScan;
    }

    public abstract readFile(file: File): Promise<Buffer>;
    public abstract writeFile(file: File, content: Buffer): Promise<void>;
    public abstract deleteFile(file: File): Promise<void>;

    public async scan(): Promise<void> {
        LogManager.log(LogLevel.Trace, 'Starting vault scan');

        try {
            LogManager.log(LogLevel.Trace, 'Authenticating...');
            await this.authenticate();

            LogManager.log(LogLevel.Trace, 'Retrieving file list...');
            const files = await this.getFiles();

            LogManager.log(LogLevel.Debug, 'Scan statistics', {
                fileCount: files.length,
                totalSize: files.reduce((sum, file) => sum + file.size, 0)
            });

            this.setLastScan(new Date());
            LogManager.log(LogLevel.Info, `Vault scan completed: ${files.length} files found`);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Vault scan failed', error);
            throw error;
        }
    }
}
