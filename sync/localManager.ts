import { AbstractManager, File } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import { join, basename, relative, sep, posix, dirname } from 'path';
import { createHash } from 'crypto';
import * as mimeTypes from 'mime-types';
import { LogManager } from '../LogManager';
import { App, FileStats } from 'obsidian';
import { CacheManager } from './CacheManager';

interface HashCacheEntry {
    hash: string;
    mtime: Date;
    mimeType: string;
    size: number;
    utcTimestamp: string;
}

export class LocalManager extends AbstractManager {
    public readonly name: string = 'Local';
    private readonly BATCH_SIZE = 20;

    private basePath: string;
    private vaultName: string;
    private hashCache: {
        [filePath: string]: HashCacheEntry;
    } = {};

    constructor(
        settings: CloudSyncSettings,
        private app: App,
        private cache: CacheManager
    ) {
        super(settings);
        this.basePath = (this.app.vault.adapter as any).basePath;
        this.vaultName = basename(this.basePath);
        LogManager.log(LogLevel.Debug, 'Local vault manager initialized', {
            vault: this.vaultName,
            path: this.basePath
        });
    }

    public getBasePath(): string {
        return this.basePath;
    }

    public getApp(): App {
        return this.app;
    }

    private getDefaultIgnoreList(): string[] {
        const configDir = basename(this.app.vault.configDir);
        return [
            configDir,
            '.git',
            '.gitignore',
            '.trash',
            '.DS_Store',
            'Thumbs.db',
            'desktop.ini'
        ];
    }

    public getVaultName(): string {
        return this.vaultName;
    }

    private normalizeVaultPath(path: string): string {
        return path.split(sep).join('/');
    }

    private async ensureDirectoryExists(filePath: string): Promise<void> {
        const relativePath = this.normalizeVaultPath(relative(this.basePath, filePath));
        const dirPath = dirname(relativePath);

        if (dirPath === '.') return;

        const exists = await this.app.vault.adapter.exists(dirPath);
        if (!exists) {
            LogManager.log(LogLevel.Debug, `Creating directory: ${dirPath}`);
            await this.app.vault.adapter.mkdir(dirPath);
        }
    }

    private async computeHashStreaming(relativePath: string): Promise<string> {
        const hash = createHash('md5');
        const chunkSize = 64 * 1024; // 64KB chunks
        const stats = await this.app.vault.adapter.stat(relativePath);
        if (!stats) {
            throw new Error(`Failed to get stats for file: ${relativePath}`);
        }
        let offset = 0;

        while (offset < stats.size) {
            const chunk = await this.app.vault.adapter.readBinary(relativePath);
            hash.update(Buffer.from(chunk));
            offset += chunk.byteLength;
        }

        return hash.digest('hex');
    }

    private async getFileHashAndMimeType(
        filePath: string,
        stats: FileStats,
        normalizedPath: string
    ): Promise<{ hash: string; mimeType: string; size: number; utcTimestamp: string }> {
        const utcTimestamp = new Date(stats.mtime).toISOString();
        const cachedTimestamp = this.cache.getTimestamp(normalizedPath);

        // If we have a cache hit with matching timestamp, use cached MD5
        if (cachedTimestamp && cachedTimestamp.toISOString() === utcTimestamp) {
            const cachedMd5 = this.cache.getMd5(normalizedPath);
            if (cachedMd5) {
                LogManager.log(LogLevel.Debug, `Using cached MD5 for ${filePath} (timestamp match)`);
                return {
                    hash: cachedMd5,
                    mimeType: mimeTypes.lookup(filePath) || "application/octet-stream",
                    size: stats.size,
                    utcTimestamp
                };
            }
        }

        // No cache hit or timestamp mismatch - compute hash
        LogManager.log(LogLevel.Debug, `Computing hash for ${filePath}`);
        const relativePath = this.normalizeVaultPath(relative(this.basePath, filePath));
        const hash = await this.computeHashStreaming(relativePath);
        const mimeType = mimeTypes.lookup(filePath) || "application/octet-stream";
        const size = stats.size;

        return { hash, mimeType, size, utcTimestamp };
    }

    private normalizePathForCloud(path: string): string {
        return path.split(sep).join(posix.sep);
    }

    private getIgnoreList(): string[] {
        const ignoreList = [...this.getDefaultIgnoreList()];

        if (this.settings.syncIgnore) {
            const userIgnoreItems = this.settings.syncIgnore
                .split(',')
                .map(item => item.trim())
                .filter(item => item.length > 0);

            userIgnoreItems.forEach(item => {
                if (!ignoreList.includes(item)) {
                    ignoreList.push(item);
                }
            });
        }

        return ignoreList;
    }

    private async processFileBatch(filePaths: string[]): Promise<(File | null)[]> {
        return Promise.all(
            filePaths.map(async (filePath) => {
                const absolutePath = join(this.basePath, filePath);
                const stats = await this.app.vault.adapter.stat(filePath);
                if (!stats) {
                    LogManager.log(LogLevel.Debug, `No stats available for file: ${filePath}`);
                    return null;
                }

                const normalizedPath = this.normalizePathForCloud(filePath);
                const { hash, mimeType, size, utcTimestamp } = await this.getFileHashAndMimeType(
                    absolutePath,
                    stats,
                    normalizedPath
                );

                const cloudPath = encodeURIComponent(normalizedPath);

                LogManager.log(LogLevel.Debug, `Processed file: ${filePath}`, {
                    size,
                    mimeType,
                    hash: hash.substring(0, 8) // Log only first 8 chars of hash
                });

                return {
                    name: normalizedPath,
                    localName: absolutePath,
                    remoteName: cloudPath,
                    mime: mimeType,
                    size: size,
                    md5: hash,
                    lastModified: new Date(stats.mtime),
                    isDirectory: false,
                };
            })
        );
    }

    public override async getFiles(directory: string = this.basePath): Promise<File[]> {
        try {
            const ignoreList = this.getIgnoreList();
            const relativeDirPath = this.normalizeVaultPath(relative(this.basePath, directory));

            if (ignoreList.includes(basename(directory))) {
                return [];
            }

            const listing = await this.app.vault.adapter.list(relativeDirPath || '/');

            // Process files in batches
            const files: File[] = [];
            for (let i = 0; i < listing.files.length; i += this.BATCH_SIZE) {
                const batch = listing.files
                    .slice(i, i + this.BATCH_SIZE)
                    .filter(filePath => !ignoreList.includes(basename(filePath)));

                const batchResults = await this.processFileBatch(batch);
                const validResults = batchResults.filter((f): f is File => f !== null);
                files.push(...validResults);
            }

            // Recursively process directories
            const directoryFiles = await Promise.all(
                listing.folders
                    .filter(folderPath => !ignoreList.includes(basename(folderPath)))
                    .map(folderPath => this.getFiles(join(this.basePath, folderPath)))
            );

            this.files = [...files, ...directoryFiles.flat()];

            // Only log total file count at INFO level for the root directory scan
            if (directory === this.basePath) {
                LogManager.log(LogLevel.Info, `Vault: ${this.files.length}`);
            }

            return this.files;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to scan directory: ${directory}`, error);
            throw error;
        }
    }

    async authenticate(): Promise<void> {
        LogManager.log(LogLevel.Debug, 'Verifying local vault access');
        LogManager.log(LogLevel.Trace, 'Local vault access verified');
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            LogManager.log(LogLevel.Debug, 'Testing local vault read/write access');
            const testFile = '.test';
            await this.app.vault.adapter.writeBinary(testFile, Buffer.from('test'));
            await this.app.vault.adapter.remove(testFile);

            LogManager.log(LogLevel.Trace, 'Local vault access test successful');
            return {
                success: true,
                message: "Successfully verified local vault access"
            };
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to verify local vault access', error);
            return {
                success: false,
                message: `Local vault access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }

    async readFile(file: File): Promise<Buffer> {
        LogManager.log(LogLevel.Debug, `Reading file: ${file.name}`);
        try {
            const relativePath = this.normalizeVaultPath(relative(this.basePath, file.localName));
            const arrayBuffer = await this.app.vault.adapter.readBinary(relativePath);
            const buffer = Buffer.from(arrayBuffer);
            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to read file: ${file.name}`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        LogManager.log(LogLevel.Debug, `Writing file: ${file.name} (${content.length} bytes)`);
        try {
            const relativePath = this.normalizeVaultPath(relative(this.basePath, file.localName));
            await this.ensureDirectoryExists(file.localName);
            await this.app.vault.adapter.writeBinary(relativePath, content);
            LogManager.log(LogLevel.Trace, `Wrote ${content.length} bytes to ${file.name}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to write file: ${file.name}`, error);
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Deleting file: ${file.name}`);
        try {
            const relativePath = this.normalizeVaultPath(relative(this.basePath, file.localName));
            const abstractFile = this.app.vault.getAbstractFileByPath(relativePath);
            if (!abstractFile) {
                throw new Error(`File not found in vault: ${relativePath}`);
            }
            await this.app.vault.trash(abstractFile, true);
            LogManager.log(LogLevel.Trace, `Deleted file: ${file.name}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete file: ${file.name}`, error);
            throw error;
        }
    }
}
