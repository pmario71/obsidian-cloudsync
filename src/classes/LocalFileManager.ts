import * as fs from 'fs';
import { utimes, mkdir } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as mimeTypes from 'mime-types';
import { File } from '../classes/Synchronize';
import { FileManager } from './AbstractFileManager';
import { readFileAsync, writeFileAsync, unlinkAsync, readdirAsync, statAsync } from '../main';
import { promisify } from 'util';

export class LocalFileManager extends FileManager {
    public directory: string;
    private hashCache: { [filePath: string]: { hash: string; mtime: Date; mimeType: string; size: number; }; } = {};

    constructor(directory: string) {
        super();
        this.directory = directory;
    }

    private async getFileHashAndMimeType(filePath: string, stats: fs.Stats): Promise<{ hash: string; mimeType: string; size: number; }> {
        const cached = this.hashCache[filePath];
        if (cached && stats.mtime <= cached.mtime) {
            // If the file is in the cache and hasn't been modified, return the cached hash, MIME type, and size
            return { hash: cached.hash, mimeType: cached.mimeType, size: cached.size };
        } else {
            // If the file is not in the cache or has been modified, calculate the hash and MIME type, and get the size
            const content = await readFileAsync(filePath);
            const hash = createHash('md5').update(content).digest('hex');
            const mimeType = mimeTypes.lookup(filePath) || 'unknown';
            const size = stats.size;

            // Update the cache
            this.hashCache[filePath] = { hash, mtime: stats.mtime, mimeType, size };

            return { hash, mimeType, size };
        }
    }

    public authenticate(): Promise<void> {
        // No authentication needed for local file system
        this.isAuthenticated = true;
        return Promise.resolve();
    }

    public async readFile(file: File): Promise<Buffer> {
        const content = await readFileAsync(file.localName);
        return content;
      }

      public async writeFile(file: File, content: Buffer): Promise<void> {
        const utimesAsync = promisify(utimes);
        const mkdirAsync = promisify(mkdir);
        const filePath = path.join(this.directory, file.name);

        const dir = path.dirname(filePath);
        await mkdirAsync(dir, { recursive: true });

        await writeFileAsync(filePath, content);
        await utimesAsync(filePath, Date.now() / 1000, file.lastModified.getTime() / 1000);
      }

    public async deleteFile(file: File): Promise<void> {
        const filePath = path.join(this.directory, file.name);
        await unlinkAsync(filePath);
    }

    public async getFiles(directory: string = this.directory): Promise<File[]> {
        const ignoreList = ['node_modules', '.git', 'bak', '.obsidian', '.DS_Store', '.cloudsync.json', 'secrets.json'];

        if (ignoreList.includes(path.basename(directory))) {
            return [];
        }
        const fileNames = await readdirAsync(directory);
        const files = await Promise.all(fileNames.map(async (name) => {
            if (ignoreList.includes(name)) {
                return [];
            }
            const filePath = path.join(directory, name);
            const stats = await statAsync(filePath);

            if (stats.isDirectory()) {
                // If it's a directory, recursively get the files in the directory
                return this.getFiles(filePath);
            } else {
                // If it's a file, read it and compute its MD5 hash
                const { hash, mimeType, size } = await this.getFileHashAndMimeType(filePath, stats);

                // Create a cloud storage friendly name
                const cloudPath = encodeURIComponent(path.relative(this.directory, filePath).replace(/\\/g, '/'));

                return {
                    name: path.relative(this.directory, filePath).replace(/\\/g, '/'),
                    localName: filePath,
                    remoteName: cloudPath,
                    mime: mimeType,
                    size: size,
                    md5: hash,
                    lastModified: stats.mtime,
                    isDirectory: stats.isDirectory(),
                };
            }
        }));

        // Flatten the array of files and directories
        this.files = files.flat();
        this.files = this.files.filter(file => !file.isDirectory);

        return this.files;
    }
}
