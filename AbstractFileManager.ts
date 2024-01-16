import { File } from "./Synchronize";

export enum SyncState {
  Offline,
  Ready,
  Syncing,
  Error,
  // Add other states here as needed.
}

export abstract class FileManager {
  public files: File[];
  public lastSync: Date | null;
  public state: SyncState;

  constructor() {
    this.files = [];
    this.lastSync = null;
    this.state = SyncState.Offline;
  }

  async isOnline(endpoint: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 1000); // Set timeout to 1 second.

    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return true;
    } catch {
      clearTimeout(timeout);
      return false;
    }
  }

  // Method to authenticate
  public abstract authenticate(): void;

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
