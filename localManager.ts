import * as fs from "fs";
import { promisify } from "util";
import * as path from "path";
import { createHash } from "crypto";
import * as mimeTypes from "mime-types";
import { AbstractManager, File, SyncState } from "./AbstractManager";
import { CloudSyncSettings } from "./types";

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);
const utimesAsync = promisify(fs.utimes);
const accessAsync = promisify(fs.access);

export class LocalManager extends AbstractManager {
    private directory: string;
    private hashCache: {
        [filePath: string]: {
            hash: string;
            mtime: Date;
            mimeType: string;
            size: number;
        };
    } = {};

    constructor(settings: CloudSyncSettings, directory: string) {
        super(settings);
        this.directory = directory;
    }

    private async getFileHashAndMimeType(
        filePath: string,
        stats: fs.Stats
    ): Promise<{ hash: string; mimeType: string; size: number }> {
        const cached = this.hashCache[filePath];
        if (cached && stats.mtime <= cached.mtime) {
            return {
                hash: cached.hash,
                mimeType: cached.mimeType,
                size: cached.size,
            };
        }

        const content = await readFileAsync(filePath);
        const hash = createHash("md5").update(content).digest("hex");
        const mimeType = mimeTypes.lookup(filePath) || "application/octet-stream";
        const size = stats.size;

        this.hashCache[filePath] = { hash, mtime: stats.mtime, mimeType, size };
        return { hash, mimeType, size };
    }

    public async testConnectivity(): Promise<{
        success: boolean;
        message: string;
        details?: any;
    }> {
        try {
            // Test read access
            await accessAsync(this.directory, fs.constants.R_OK);
            // Test write access
            await accessAsync(this.directory, fs.constants.W_OK);

            return {
                success: true,
                message: "Local filesystem access verified",
                details: {
                    directory: this.directory,
                    permissions: "read/write"
                }
            };
        } catch (error) {
            return {
                success: false,
                message: "Failed to access local filesystem",
                details: {
                    directory: this.directory,
                    error: error.message
                }
            };
        }
    }

    public async authenticate(): Promise<void> {
        const connectivityTest = await this.testConnectivity();
        if (!connectivityTest.success) {
            this.state = SyncState.Error;
            throw new Error(connectivityTest.message);
        }
        this.state = SyncState.Ready;
    }

    public async readFile(file: File): Promise<Buffer> {
        try {
            return await readFileAsync(file.localName);
        } catch (error) {
            this.debugLog(`Error reading file ${file.name}:`, error);
            throw error;
        }
    }

    public async writeFile(file: File, content: Buffer): Promise<void> {
        try {
            const filePath = path.join(this.directory, file.name);
            const dir = path.dirname(filePath);

            await mkdirAsync(dir, { recursive: true });
            await writeFileAsync(filePath, content);
            await utimesAsync(
                filePath,
                Date.now() / 1000,
                file.lastModified.getTime() / 1000
            );
        } catch (error) {
            this.debugLog(`Error writing file ${file.name}:`, error);
            throw error;
        }
    }

    public async deleteFile(file: File): Promise<void> {
        try {
            const filePath = path.join(this.directory, file.name);
            await unlinkAsync(filePath);
        } catch (error) {
            this.debugLog(`Error deleting file ${file.name}:`, error);
            throw error;
        }
    }

    public async getFiles(): Promise<File[]> {
        const ignoreList = this.settings.syncIgnore.split(',').map(item => item.trim());
        if (!ignoreList.includes('.cloudsync.json')) {
            ignoreList.push('.cloudsync.json');
        }

        const processDirectory = async (directory: string): Promise<File[]> => {
            if (ignoreList.includes(path.basename(directory))) {
                return [];
            }

            const fileNames = await readdirAsync(directory);
            const files = await Promise.all(
                fileNames.map(async (name) => {
                    if (ignoreList.includes(name)) {
                        return [];
                    }

                    const filePath = path.join(directory, name);
                    const stats = await statAsync(filePath);

                    if (stats.isDirectory()) {
                        return processDirectory(filePath);
                    }

                    const { hash, mimeType, size } = await this.getFileHashAndMimeType(
                        filePath,
                        stats
                    );

                    const relativePath = path.relative(this.directory, filePath).replace(/\\/g, "/");
                    const cloudPath = encodeURIComponent(relativePath);

                    return [{
                        name: relativePath,
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

            return files.flat();
        };

        this.files = await processDirectory(this.directory);
        this.files = this.files.filter(file => !file.isDirectory);
        return this.files;
    }
}
