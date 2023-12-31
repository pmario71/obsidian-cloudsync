import { File } from '../classes/Synchronize';

export abstract class FileManager {
    public files: File[];
    public lastSync: Date | null;
    public isAuthenticated: boolean;

    constructor() {
        this.files = [];
        this.lastSync = null;
        this.isAuthenticated = false;
    }

    // Method to authenticate
    public abstract authenticate(credentials: any): void;

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

    // Abstract methods for file operations - to be implemented in derived classes
    abstract readFile(file: File): Promise<Buffer>; // Assuming read returns file content as a string
    abstract writeFile(file: File, content: Buffer): Promise<void>; // Write file content
    abstract deleteFile(file: File): Promise<void>;

}
