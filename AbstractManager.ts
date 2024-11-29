import { CloudSyncSettings, LogLevel } from "./types";
import { LogManager } from "./LogManager";

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

export enum ScanState {
    Offline,
    Ready,
    Scanning,
    Error,
}

export abstract class AbstractManager {
    public abstract readonly name: string;

    public files: File[];
    public lastScan: Date | null;
    public state: ScanState;
    protected settings: CloudSyncSettings;

    constructor(settings: CloudSyncSettings) {
        this.files = [];
        this.lastScan = null;
        this.state = ScanState.Offline;
        this.settings = settings;
        this.log(LogLevel.Debug, `${this.constructor.name} initialized`);
    }

    protected log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    // Comprehensive connectivity test method that each provider must implement
    public abstract testConnectivity(): Promise<{
        success: boolean;
        message: string;
        details?: any;
    }>;

    // Method to authenticate
    public abstract authenticate(): Promise<void>;

    // Method to get the list of files
    public abstract getFiles(): Promise<File[]>;

    // Method to set or update the last scan date
    public setLastScan(date: Date): void {
        this.lastScan = date;
        this.log(LogLevel.Debug, 'Updated last scan time', { timestamp: date.toISOString() });
    }

    // Method to get the last scan date
    public getLastScan(): Date | null {
        return this.lastScan;
    }

    // Abstract methods for file operations
    public abstract readFile(file: File): Promise<Buffer>;
    public abstract writeFile(file: File, content: Buffer): Promise<void>;
    public abstract deleteFile(file: File): Promise<void>;

    // Base scan method that can be overridden by providers if needed
    public async scan(): Promise<void> {
        this.log(LogLevel.Trace, 'Starting vault scan');
        this.state = ScanState.Scanning;

        try {
            this.log(LogLevel.Trace, 'Authenticating...');
            await this.authenticate();

            this.log(LogLevel.Trace, 'Retrieving file list...');
            const files = await this.getFiles();

            this.log(LogLevel.Debug, 'Scan statistics', {
                fileCount: files.length,
                totalSize: files.reduce((sum, file) => sum + file.size, 0)
            });

            this.setLastScan(new Date());
            this.state = ScanState.Ready;

            this.log(LogLevel.Info, `Vault scan completed: ${files.length} files found`);
        } catch (error) {
            this.state = ScanState.Error;
            this.log(LogLevel.Error, 'Vault scan failed', error);
            throw error;
        }
    }
}
