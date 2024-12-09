import { readFile, writeFile } from "fs/promises";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { File } from "./AbstractManager";

export class CacheManager {
    private fileCache: Map<string, string> = new Map();
    private lastSync: Date = new Date(0);

    constructor(private readonly cacheFilePath: string) {}

    async readCache(): Promise<void> {
        try {
            const content = await readFile(this.cacheFilePath, 'utf-8');
            const { lastSync, fileCache } = JSON.parse(content);
            this.lastSync = new Date(lastSync);
            this.fileCache = new Map(fileCache);
            LogManager.log(LogLevel.Debug, `Cache loaded with ${this.fileCache.size} entries from ${this.cacheFilePath}`);
        } catch (error) {
            LogManager.log(LogLevel.Debug, 'No existing cache found, starting fresh');
            this.lastSync = new Date(0);
            this.fileCache.clear();
        }
    }

    async writeCache(files: File[]): Promise<void> {
        try {
            this.fileCache.clear();
            files.forEach(file => {
                this.fileCache.set(file.name, file.md5);
            });

            const fileCache = Array.from(this.fileCache.entries());
            const fileCacheJson = JSON.stringify({
                lastSync: this.lastSync,
                fileCache
            }, null, 2);

            await writeFile(this.cacheFilePath, fileCacheJson);
            LogManager.log(LogLevel.Debug, `Cache updated with ${this.fileCache.size} entries`);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to write cache file', error);
            throw error;
        }
    }

    hasFile(name: string): boolean {
        return this.fileCache.has(name);
    }

    getMd5(name: string): string | undefined {
        return this.fileCache.get(name);
    }

    updateLastSync(): void {
        this.lastSync = new Date();
    }

    getLastSync(): Date {
        return this.lastSync;
    }
}
