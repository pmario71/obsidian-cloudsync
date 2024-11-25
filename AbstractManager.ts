import { CloudSyncSettings } from "./types";

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

export enum SyncState {
    Offline,
    Ready,
    Syncing,
    Error,
}

export abstract class AbstractManager {
    public files: File[];
    public lastSync: Date | null;
    public state: SyncState;
    protected settings: CloudSyncSettings;
    private boundConsoleLog: (message?: any, ...optionalParams: any[]) => void;

    constructor(settings: CloudSyncSettings) {
        this.files = [];
        this.lastSync = null;
        this.state = SyncState.Offline;
        this.settings = settings;
        // Bind console.log to preserve its context
        this.boundConsoleLog = console.log.bind(console);
    }

    public debugLog(message: string, data?: any): void {
        if (this.settings.debugEnabled) {
            const prefix = 'cloudsync: ';
            if (data !== undefined) {
                this.boundConsoleLog(prefix + message, data);
            } else {
                this.boundConsoleLog(prefix + message);
            }
        }
    }

    // Comprehensive connectivity test method that each provider must implement
    abstract testConnectivity(): Promise<{
        success: boolean;
        message: string;
        details?: any;
    }>;

    // Method to authenticate
    public abstract authenticate(): Promise<void>;

    // Method to get the list of files
    public getFiles(): Promise<File[]> {
        return Promise.resolve(this.files);
    }

    // Method to set or update the last sync date
    public setLastSync(date: Date): void {
        this.lastSync = date;
    }

    // Method to get the last sync date
    public getLastSync(): Date | null {
        return this.lastSync;
    }

    // Abstract methods for file operations
    abstract readFile(file: File): Promise<Buffer>;
    abstract writeFile(file: File, content: Buffer): Promise<void>;
    abstract deleteFile(file: File): Promise<void>;

    // Base sync method that can be overridden by providers if needed
    public async sync(): Promise<void> {
        this.debugLog('Starting sync');
        this.state = SyncState.Syncing;

        try {
            await this.authenticate();
            await this.getFiles();
            this.setLastSync(new Date());
            this.state = SyncState.Ready;
            this.debugLog('Sync completed successfully');
        } catch (error) {
            this.state = SyncState.Error;
            this.debugLog('Sync failed', error);
            throw error;
        }
    }
}
