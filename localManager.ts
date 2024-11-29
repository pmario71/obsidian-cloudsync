import { AbstractManager, File, ScanState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import { readFile as fsReadFile, writeFile as fsWriteFile, unlink, readdir, stat } from 'fs/promises';
import { join, basename, relative, sep, posix } from 'path';
import { createHash } from 'crypto';
import * as mimeTypes from 'mime-types';

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

    constructor(settings: CloudSyncSettings, app: any) {
        super(settings);
        this.basePath = app.vault.adapter.basePath;
        this.vaultName = basename(this.basePath);
        this.log(LogLevel.Debug, 'Local vault manager initialized', {
            vault: this.vaultName,
            path: this.basePath
        });
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
            this.log(LogLevel.Debug, `Using cached hash for ${filePath}`);
            return {
                hash: cached.hash,
                mimeType: cached.mimeType,
                size: cached.size,
            };
        }

        this.log(LogLevel.Debug, `Computing hash for ${filePath}`);
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
        return path.split(sep).join(posix.sep);
    }

    public override async getFiles(directory: string = this.basePath): Promise<File[]> {
        this.log(LogLevel.Trace, `Scanning directory: ${directory}`);

        try {
            const ignoreList: string[] = this.settings.syncIgnore?.split(',').map((item: string) => item.trim()) || [];
            if (!ignoreList.includes('.obsidian')) {
                ignoreList.push('.obsidian');
            }

            if (ignoreList.includes(basename(directory))) {
                this.log(LogLevel.Debug, `Skipping ignored directory: ${directory}`);
                return [];
            }

            const fileNames = await readdir(directory);
            const files = await Promise.all(
                fileNames.map(async (name) => {
                    if (ignoreList.includes(name)) {
                        this.log(LogLevel.Debug, `Skipping ignored file: ${name}`);
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
                    const normalizedPath = this.normalizePathForCloud(relativePath);
                    const cloudPath = encodeURIComponent(normalizedPath);

                    this.log(LogLevel.Debug, `Processing file: ${relativePath}`, {
                        size,
                        mimeType,
                        hash: hash.substring(0, 8) // Log only first 8 chars of hash
                    });

                    return [{
                        name: normalizedPath,
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

            this.log(LogLevel.Trace, `Found ${this.files.length} files in ${directory}`);
            return this.files;
        } catch (error) {
            this.log(LogLevel.Error, `Failed to scan directory: ${directory}`, error);
            throw error;
        }
    }

    async authenticate(): Promise<void> {
        this.log(LogLevel.Debug, 'Verifying local vault access');
        this.state = ScanState.Ready;
        this.log(LogLevel.Trace, 'Local vault access verified');
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.log(LogLevel.Debug, 'Testing local vault read/write access');
            const testFile = join(this.basePath, '.test');
            await fsWriteFile(testFile, 'test');
            await unlink(testFile);

            this.log(LogLevel.Trace, 'Local vault access test successful');
            return {
                success: true,
                message: "Successfully verified local vault access"
            };
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to verify local vault access', error);
            return {
                success: false,
                message: `Local vault access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, `Reading file: ${file.name}`);
        try {
            const buffer = await fsReadFile(file.localName);
            this.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, `Failed to read file: ${file.name}`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Debug, `Writing file: ${file.name} (${content.length} bytes)`);
        try {
            await fsWriteFile(file.localName, content);
            this.log(LogLevel.Trace, `Wrote ${content.length} bytes to ${file.name}`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to write file: ${file.name}`, error);
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Debug, `Deleting file: ${file.name}`);
        try {
            await unlink(file.localName);
            this.log(LogLevel.Trace, `Deleted file: ${file.name}`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to delete file: ${file.name}`, error);
            throw error;
        }
    }
}
