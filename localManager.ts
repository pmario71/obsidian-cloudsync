import { AbstractManager, File, ScanState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import { readFile as fsReadFile, writeFile as fsWriteFile, unlink, readdir, stat } from 'fs/promises';
import { join, basename, relative, sep, posix } from 'path';
import { createHash } from 'crypto';
import * as mimeTypes from 'mime-types';

export class LocalManager extends AbstractManager {
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

    constructor(settings: CloudSyncSettings, app: any) {
        super(settings);
        this.basePath = app.vault.adapter.basePath;
        this.vaultName = basename(this.basePath);
        this.log(LogLevel.Debug, `LocalManager initialized for vault: ${this.vaultName} at ${this.basePath}`);
    }

    public getProviderName(): string {
        return 'local';
    }

    public getVaultName(): string {
        return this.vaultName;
    }

    private async getFileHashAndMimeType(
        filePath: string,
        stats: any
    ): Promise<{ hash: string; mimeType: string; size: number }> {
        const cached = this.hashCache[filePath];
        if (cached && stats.mtime <= cached.mtime) {
            return {
                hash: cached.hash,
                mimeType: cached.mimeType,
                size: cached.size,
            };
        }

        const content = await fsReadFile(filePath);
        const hash = createHash("md5").update(content).digest("hex");
        const mimeType = mimeTypes.lookup(filePath) || "application/octet-stream";
        const size = stats.size;

        this.hashCache[filePath] = {
            hash,
            mtime: stats.mtime,
            mimeType,
            size
        };

        return { hash, mimeType, size };
    }

    private normalizePathForCloud(path: string): string {
        // Convert Windows backslashes to forward slashes for cloud storage
        return path.split(sep).join(posix.sep);
    }

    public override async getFiles(directory: string = this.basePath): Promise<File[]> {
        this.log(LogLevel.Trace, 'Local list files in:', directory);

        try {
            const ignoreList: string[] = this.settings.syncIgnore?.split(',').map((item: string) => item.trim()) || [];
            if (!ignoreList.includes('.obsidian')) {
                ignoreList.push('.obsidian');
            }

            if (ignoreList.includes(basename(directory))) {
                return [];
            }

            const fileNames = await readdir(directory);
            const files = await Promise.all(
                fileNames.map(async (name) => {
                    if (ignoreList.includes(name)) {
                        return [];
                    }

                    const filePath = join(directory, name);
                    const stats = await stat(filePath);

                    if (stats.isDirectory()) {
                        return this.getFiles(filePath);
                    }

                    const { hash, mimeType, size } = await this.getFileHashAndMimeType(
                        filePath,
                        stats
                    );

                    const relativePath = relative(this.basePath, filePath);
                    // Normalize path before encoding for cloud storage
                    const normalizedPath = this.normalizePathForCloud(relativePath);
                    const cloudPath = encodeURIComponent(normalizedPath);

                    this.log(LogLevel.Debug, 'Local File:', { relativePath });

                    return [{
                        name: normalizedPath, // Use normalized path for name field
                        localName: filePath,
                        remoteName: cloudPath,
                        mime: mimeType,
                        size: size,
                        md5: hash,
                        lastModified: stats.mtime,
                        isDirectory: stats.isDirectory(),
                    }];
                })
            );

            this.files = files.flat();
            this.files = this.files.filter((file) => !file.isDirectory);
            return this.files;
        } catch (error) {
            this.log(LogLevel.Error, 'Local Get Files - Failed', error);
            throw error;
        }
    }

    async authenticate(): Promise<void> {
        this.log(LogLevel.Debug, `Local Authentication - Starting for vault: ${this.vaultName}`);
        // No authentication needed for local storage
        this.state = ScanState.Ready;
        this.log(LogLevel.Info, 'Local Authentication - Success');
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.log(LogLevel.Trace, `Local Read/Write Test`);
            // Test if we can read/write to the base path
            const testFile = join(this.basePath, '.test');
            await fsWriteFile(testFile, 'test');
            await unlink(testFile);

            return {
                success: true,
                message: "Successfully verified local storage access"
            };
        } catch (error) {
            this.log(LogLevel.Error, 'Local RW Test - Failed', error);
            return {
                success: false,
                message: `Local storage access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, 'Local Read File - Starting', { file: file.localName });
        try {
            const buffer = await fsReadFile(file.localName);
            this.log(LogLevel.Debug, 'Local Read File - Success', {
                file: file.localName,
                size: buffer.length
            });
            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, 'Local Read File - Failed', {
                file: file.localName,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Debug, 'Local Write File - Starting', {
            file: file.localName,
            size: content.length
        });
        try {
            await fsWriteFile(file.localName, content);
            this.log(LogLevel.Debug, 'Local Write File - Success', { file: file.localName });
        } catch (error) {
            this.log(LogLevel.Error, 'Local Write File - Failed', {
                file: file.localName,
                error
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'Local Delete File - Starting', { file: file.localName });
        try {
            await unlink(file.localName);
            this.log(LogLevel.Debug, 'Local Delete File - Success', { file: file.localName });
        } catch (error) {
            this.log(LogLevel.Error, 'Local Delete File - Failed', {
                file: file.localName,
                error
            });
            throw error;
        }
    }
}
