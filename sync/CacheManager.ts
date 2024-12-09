import { File } from "./AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { App } from "obsidian";
import { relative } from "path";

export class CacheManager {
    private fileCache: Map<string, string> = new Map();
    private lastSync: Date | null = null;

    constructor(
        private readonly cacheFilePath: string,
        private readonly app: App
    ) {}

    private getVaultRelativePath(): string {
        const basePath = (this.app.vault.adapter as any).basePath;
        return relative(basePath, this.cacheFilePath).replace(/\\/g, '/');
    }

    async readCache(): Promise<void> {
        try {
            LogManager.log(LogLevel.Debug, 'Reading cache file');
            const relativePath = this.getVaultRelativePath();
            const exists = await this.app.vault.adapter.exists(relativePath);

            if (!exists) {
                LogManager.log(LogLevel.Debug, 'No cache file found');
                this.fileCache = new Map();
                this.lastSync = null;
                return;
            }

            const arrayBuffer = await this.app.vault.adapter.readBinary(relativePath);
            const content = Buffer.from(arrayBuffer).toString('utf-8');
            const { lastSync, fileCache } = JSON.parse(content);
            this.lastSync = lastSync ? new Date(lastSync) : null;
            this.fileCache = new Map(Object.entries(fileCache));
            LogManager.log(LogLevel.Debug, `Cache loaded with ${this.fileCache.size} entries`);
        } catch (error) {
            LogManager.log(LogLevel.Debug, 'Invalid cache file', error);
            this.fileCache = new Map();
            this.lastSync = null;
        }
    }

    async writeCache(files: File[]): Promise<void> {
        const fileCache = files.reduce((cache, file) => {
            cache[file.name] = file.md5;
            return cache;
        }, {} as { [key: string]: string });

        const fileCacheJson = JSON.stringify({
            lastSync: this.lastSync,
            fileCache
        }, null, 2);

        try {
            const relativePath = this.getVaultRelativePath();
            await this.app.vault.adapter.writeBinary(
                relativePath,
                Buffer.from(fileCacheJson, 'utf-8')
            );
            LogManager.log(LogLevel.Debug, `Cache updated with ${this.fileCache.size} entries`);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to write cache file', error);
            throw error;
        }
    }

    getLastSync(): Date | null {
        return this.lastSync;
    }

    updateLastSync(): void {
        this.lastSync = new Date();
    }

    hasFile(fileName: string): boolean {
        return this.fileCache.has(fileName);
    }

    getMd5(fileName: string): string | undefined {
        return this.fileCache.get(fileName);
    }
}
