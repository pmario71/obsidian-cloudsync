import { AbstractManager, File, ScanState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import { join, basename, relative, sep, posix, dirname } from 'path';
import { createHash } from 'crypto';
import * as mimeTypes from 'mime-types';
import { LogManager } from '../LogManager';
import { App, FileStats } from 'obsidian';

export class LocalManager extends AbstractManager {
    public readonly name: string = 'Local';

    private basePath: string;
    private vaultName: string;
    private hashCache: {
        [filePath: string]: {
            hash: string;
            mtime: Date;
            mimeType: string;
            size: number;
        };
    } = {};

    constructor(settings: CloudSyncSettings, private app: App) {
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

    private async getFileHashAndMimeType(
        filePath: string,
        stats: FileStats
    ): Promise<{ hash: string; mimeType: string; size: number }> {
        const cached = this.hashCache[filePath];
        if (cached && stats.mtime <= cached.mtime.getTime()) {
            LogManager.log(LogLevel.Debug, `Using cached hash for ${filePath}`);
            return {
                hash: cached.hash,
                mimeType: cached.mimeType,
                size: cached.size,
            };
        }

        LogManager.log(LogLevel.Debug, `Computing hash for ${filePath}`);
        const relativePath = this.normalizeVaultPath(relative(this.basePath, filePath));
        const arrayBuffer = await this.app.vault.adapter.readBinary(relativePath);
        const buffer = Buffer.from(arrayBuffer);
        const hash = createHash("md5").update(buffer).digest("hex");
        const mimeType = mimeTypes.lookup(filePath) || "application/octet-stream";
        const size = stats.size;

        this.hashCache[filePath] = {
            hash,
            mtime: new Date(stats.mtime),
            mimeType,
            size
        };

        return { hash, mimeType, size };
    }

    private normalizePathForCloud(path: string): string {
        return path.split(sep).join(posix.sep);
    }

    private getIgnoreList(): string[] {
        // Start with default ignore list
        const ignoreList = [...this.getDefaultIgnoreList()];

        // Add user-defined ignore items if any
        if (this.settings.syncIgnore) {
            const userIgnoreItems = this.settings.syncIgnore
                .split(',')
                .map(item => item.trim())
                .filter(item => item.length > 0);

            // Add only unique items that aren't already in the list
            userIgnoreItems.forEach(item => {
                if (!ignoreList.includes(item)) {
                    ignoreList.push(item);
                }
            });
        }

        return ignoreList;
    }

    public override async getFiles(directory: string = this.basePath): Promise<File[]> {
        LogManager.log(LogLevel.Trace, `Scanning directory: ${directory}`);

        try {
            const ignoreList = this.getIgnoreList();
            const relativeDirPath = this.normalizeVaultPath(relative(this.basePath, directory));

            if (ignoreList.includes(basename(directory))) {
                LogManager.log(LogLevel.Debug, `Skipping ignored directory: ${directory}`);
                return [];
            }

            const listing = await this.app.vault.adapter.list(relativeDirPath || '/');
            const files = await Promise.all(
                listing.files.map(async (filePath: string) => {
                    const name = basename(filePath);
                    if (ignoreList.includes(name)) {
                        LogManager.log(LogLevel.Debug, `Skipping ignored file: ${name}`);
                        return [];
                    }

                    const absolutePath = join(this.basePath, filePath);
                    const stats = await this.app.vault.adapter.stat(filePath);
                    if (!stats) {
                        LogManager.log(LogLevel.Debug, `No stats available for file: ${filePath}`);
                        return [];
                    }

                    const { hash, mimeType, size } = await this.getFileHashAndMimeType(
                        absolutePath,
                        stats
                    );

                    const normalizedPath = this.normalizePathForCloud(filePath);
                    const cloudPath = encodeURIComponent(normalizedPath);

                    LogManager.log(LogLevel.Debug, `Processing file: ${filePath}`, {
                        size,
                        mimeType,
                        hash: hash.substring(0, 8) // Log only first 8 chars of hash
                    });

                    return [{
                        name: normalizedPath,
                        localName: absolutePath,
                        remoteName: cloudPath,
                        mime: mimeType,
                        size: size,
                        md5: hash,
                        lastModified: new Date(stats.mtime),
                        isDirectory: false,
                    }];
                })
            );

            // Recursively process directories
            const directoryFiles = await Promise.all(
                listing.folders.map(async (folderPath: string) => {
                    const name = basename(folderPath);
                    if (ignoreList.includes(name)) {
                        LogManager.log(LogLevel.Debug, `Skipping ignored directory: ${name}`);
                        return [];
                    }
                    return this.getFiles(join(this.basePath, folderPath));
                })
            );

            this.files = [...files.flat(), ...directoryFiles.flat()];
            LogManager.log(LogLevel.Trace, `Found ${this.files.length} files in ${directory}`);
            return this.files;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to scan directory: ${directory}`, error);
            throw error;
        }
    }

    async authenticate(): Promise<void> {
        LogManager.log(LogLevel.Debug, 'Verifying local vault access');
        this.state = ScanState.Ready;
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
