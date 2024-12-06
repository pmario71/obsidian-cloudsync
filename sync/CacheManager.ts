import { writeFile, readFile } from "fs/promises";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { File } from "./AbstractManager";

export class CacheManager {
    private fileCache: Map<string, string>;
    private lastSync: Date;

    constructor(private readonly cacheFilePath: string) {
        this.fileCache = new Map();
        this.lastSync = new Date(0);
    }

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    async readCache(): Promise<void> {
        try {
            const fileCacheJson = await readFile(this.cacheFilePath, "utf-8");
            const { lastSync, fileCache } = JSON.parse(fileCacheJson);
            this.lastSync = new Date(lastSync);
            this.fileCache = new Map(fileCache);
            this.log(LogLevel.Debug, `Cache loaded with ${this.fileCache.size} entries from ${this.cacheFilePath}`);
        } catch (error) {
            this.log(LogLevel.Debug, 'No existing cache found, starting fresh');
            this.lastSync = new Date(0);
            this.fileCache.clear();
        }
    }

    async writeCache(processedFiles: File[]): Promise<void> {
        try {
            this.fileCache.clear();
            processedFiles.forEach((file) => {
                this.fileCache.set(file.name, file.md5);
            });
            const fileCacheArray = Array.from(this.fileCache.entries());
            const fileCacheJson = JSON.stringify({
                lastSync: this.lastSync,
                fileCache: fileCacheArray,
            }, null, 2);
            await writeFile(this.cacheFilePath, fileCacheJson);
            this.log(LogLevel.Debug, `Cache updated with ${this.fileCache.size} entries`);
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to write cache file', error);
            throw error;
        }
    }

    hasFile(fileName: string): boolean {
        return this.fileCache.has(fileName);
    }

    getMd5(fileName: string): string | undefined {
        return this.fileCache.get(fileName);
    }

    updateLastSync(): void {
        this.lastSync = new Date();
    }

    getLastSync(): Date {
        return this.lastSync;
    }
}
