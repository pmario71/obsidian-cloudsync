import { AbstractManager, File } from "./AbstractManager";
import { writeFile, readFile } from "fs/promises";
import { diff_match_patch } from "diff-match-patch";
import { LogManager } from "./LogManager";
import { LogLevel } from "./types";
import { join, dirname, sep, posix, normalize } from "path";
import { mkdir } from "fs/promises";

export interface Scenario {
    local: File | null;
    remote: File | null;
    rule: SyncRule;
}

export type SyncRule =
    | "LOCAL_TO_REMOTE"
    | "REMOTE_TO_LOCAL"
    | "DIFF_MERGE"
    | "DELETE_LOCAL"
    | "DELETE_REMOTE"
    | "TO_CACHE";

export class Synchronize {
    private local: AbstractManager;
    private remote: AbstractManager;
    private localFiles: File[];
    private remoteFiles: File[];
    private cacheFilePath: string;
    private fileCache: Map<string, string>;
    private lastSync: Date;

    constructor(local: AbstractManager, remote: AbstractManager, cacheFilePath: string) {
        this.local = local;
        this.remote = remote;
        this.localFiles = [];
        this.remoteFiles = [];
        this.cacheFilePath = cacheFilePath;
        this.fileCache = new Map();
        this.lastSync = new Date(0);

        const vaultName = (this.local as any).getVaultName?.() || 'default';
        this.log(LogLevel.Debug, 'Synchronize initialized', {
            vault: vaultName,
            provider: this.remote.getProviderName(),
            cacheFile: this.cacheFilePath
        });
    }

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    private async ensureDirectoryExists(filePath: string): Promise<void> {
        // Get the full directory path
        const fullPath = normalize(filePath);
        const directory = dirname(fullPath);

        // Split the directory path into segments
        const segments = directory.split(sep);
        let currentPath = segments[0]; // Start with the root/drive

        // Create each directory level if it doesn't exist
        for (let i = 1; i < segments.length; i++) {
            currentPath = join(currentPath, segments[i]);
            try {
                await mkdir(currentPath);
                this.log(LogLevel.Debug, 'Created directory', { directory: currentPath });
            } catch (error: any) {
                if (error.code !== 'EEXIST') {
                    this.log(LogLevel.Error, 'Failed to create directory', {
                        directory: currentPath,
                        error: error.message
                    });
                    throw error;
                }
            }
        }
    }

    private normalizeLocalPath(basePath: string, relativePath: string): string {
        // First normalize the relative path to use system separators
        const normalizedRelative = relativePath.split(posix.sep).join(sep);
        // Then join with base path and normalize the result
        return normalize(join(basePath, normalizedRelative));
    }

    async readFileCache(): Promise<void> {
        try {
            const fileCacheJson = await readFile(this.cacheFilePath, "utf-8");
            const { lastSync, fileCache } = JSON.parse(fileCacheJson);
            this.lastSync = new Date(lastSync);
            this.fileCache = new Map(fileCache);
            this.log(LogLevel.Debug, 'Cache read successfully', {
                lastSync: this.lastSync,
                cacheSize: this.fileCache.size,
                cachePath: this.cacheFilePath
            });
        } catch (error) {
            this.log(LogLevel.Debug, 'No cache found or error reading cache', { cachePath: this.cacheFilePath });
            this.lastSync = new Date(0);
            this.fileCache.clear();
        }
    }

    async writeFileCache(processedFiles: File[]): Promise<void> {
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
            this.log(LogLevel.Debug, 'Cache written successfully', {
                lastSync: this.lastSync,
                cacheSize: this.fileCache.size,
                cachePath: this.cacheFilePath
            });
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to write cache', {
                error,
                cachePath: this.cacheFilePath
            });
            throw error;
        }
    }

    async syncActions(): Promise<Scenario[]> {
        this.log(LogLevel.Debug, 'Starting sync action analysis');
        const scenarios: Scenario[] = [];

        try {
            // Get files and read cache in parallel
            const [localFiles, remoteFiles] = await Promise.all([
                this.local.getFiles(),
                this.remote.getFiles(),
                this.readFileCache()
            ]);

            this.localFiles = localFiles;
            this.remoteFiles = remoteFiles;

            this.log(LogLevel.Info, 'File counts', {
                local: this.localFiles.length,
                remote: this.remoteFiles.length,
            });

            // Handle local files
            this.localFiles.forEach((localFile) => {
                const remoteFile = this.remoteFiles.find(
                    (f) => f.name === localFile.name
                );

                if (!remoteFile) {
                    if (!this.fileCache.has(localFile.name)) {
                        // New file since last sync, copy to remote
                        scenarios.push({
                            local: localFile,
                            remote: null,
                            rule: "LOCAL_TO_REMOTE",
                        });
                        this.log(LogLevel.Debug, `LOCAL_TO_REMOTE: ${localFile.name} - Local exists, no remote`);
                    } else {
                        // File was deleted remotely, delete locally
                        scenarios.push({
                            local: localFile,
                            remote: null,
                            rule: "DELETE_LOCAL",
                        });
                        this.log(LogLevel.Debug, `DELETE_LOCAL: ${localFile.name} - Local exists, remote deleted`);
                    }
                } else if (localFile.md5 !== remoteFile.md5) {
                    const cachedMd5 = this.fileCache.get(localFile.name);
                    if (cachedMd5 && cachedMd5 === remoteFile.md5) {
                        // Remote unchanged, local changed
                        scenarios.push({
                            local: localFile,
                            remote: remoteFile,
                            rule: "LOCAL_TO_REMOTE",
                        });
                        this.log(LogLevel.Debug, `LOCAL_TO_REMOTE: ${localFile.name} - Local changed, remote unchanged`);

                    } else if (cachedMd5 && cachedMd5 === localFile.md5) {
                        // Local unchanged, remote changed
                        scenarios.push({
                            local: localFile,
                            remote: remoteFile,
                            rule: "REMOTE_TO_LOCAL",
                        });
                        this.log(LogLevel.Debug, `REMOTE_TO_LOCAL: ${localFile.name} - Local unchanged, remote changed`);

                    } else {
                        // Both changed, need merge
                        scenarios.push({
                            local: localFile,
                            remote: remoteFile,
                            rule: "DIFF_MERGE",
                        });
                        this.log(LogLevel.Debug, `DIFF_MERGE: ${localFile.name} - Local changed, remote changed`);

                    }
                }
            });

            // Handle remote files
            this.remoteFiles.forEach((remoteFile) => {
                const localFile = this.localFiles.find((f) => f.name === remoteFile.name);
                if (!localFile) {
                    if (!this.fileCache.has(remoteFile.name)) {
                        // New remote file, copy to local
                        scenarios.push({
                            local: null,
                            remote: remoteFile,
                            rule: "REMOTE_TO_LOCAL",
                        });
                        this.log(LogLevel.Debug, `REMOTE_TO_LOCAL: ${remoteFile.name} - No local, remote exists`);

                    } else {
                        // File was deleted locally, delete remotely
                        scenarios.push({
                            local: null,
                            remote: remoteFile,
                            rule: "DELETE_REMOTE",
                        });
                        this.log(LogLevel.Debug, `DELETE_REMOTE: ${remoteFile.name} - Local deleted, remote exists`);

                    }
                } else {
                     this.log(LogLevel.Debug, `SKIP: ${remoteFile.name} - Local and remote the same`);

                }
            });

            this.log(LogLevel.Info, 'Sync actions ', {
                total: scenarios.length,
                byRule: scenarios.reduce((acc, s) => {
                    acc[s.rule] = (acc[s.rule] || 0) + 1;
                    return acc;
                }, {} as Record<SyncRule, number>)
            });

            return scenarios;
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to generate sync scenarios', { error });
            throw error;
        }
    }

    async runAllScenarios(scenarios: Scenario[]): Promise<void> {
        this.log(LogLevel.Debug, 'Starting to run all scenarios');

        try {
            for (const scenario of scenarios) {
                try {
                    this.log(LogLevel.Debug, 'Processing scenario', {
                        rule: scenario.rule,
                        localFile: scenario.local?.name,
                        remoteFile: scenario.remote?.name,
                        remoteFileDetails: scenario.remote ? {
                            name: scenario.remote.name,
                            localName: scenario.remote.localName,
                            remoteName: scenario.remote.remoteName
                        } : null
                    });

                    switch (scenario.rule) {
                        case "LOCAL_TO_REMOTE":
                            if (scenario.local) {
                                await this.copyToRemote(scenario.local);
                            }
                            break;
                        case "REMOTE_TO_LOCAL":
                            if (scenario.remote) {
                                await this.copyToLocal(scenario.remote);
                            }
                            break;
                        case "DELETE_LOCAL":
                            if (scenario.local) {
                                await this.deleteFromLocal(scenario.local);
                            }
                            break;
                        case "DELETE_REMOTE":
                            if (scenario.remote) {
                                this.log(LogLevel.Debug, 'Starting DELETE_REMOTE operation', {
                                    file: scenario.remote.name,
                                    remoteName: scenario.remote.remoteName
                                });
                                await this.deleteFromRemote(scenario.remote);
                            }
                            break;
                        case "DIFF_MERGE":
                            if (scenario.local && scenario.remote) {
                                await this.diffMerge(scenario.local);
                            }
                            break;
                    }
                } catch (error) {
                    this.log(LogLevel.Error, 'Failed to process scenario', {
                        rule: scenario.rule,
                        localFile: scenario.local?.name,
                        remoteFile: scenario.remote?.name,
                        error
                    });
                    throw error;
                }
            }

            this.lastSync = new Date();
            this.remoteFiles = await this.remote.getFiles();
            await this.writeFileCache(this.remoteFiles);

        } catch (error) {
            this.log(LogLevel.Error, 'Failed to run scenarios', { error });
            throw error;
        }
    }

    async copyToRemote(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'Copying to remote', { file: file });

        try {
            const content = await this.local.readFile(file);
            await this.remote.writeFile(file, content);
            this.log(LogLevel.Debug, 'Successfully copied to remote', { file: file.name });
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to copy to remote', {
                file: file.name,
                error
            });
            throw error;
        }
    }

    async copyToLocal(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'Copying to local', {
            name: file.name,
            localName: file.localName,
            remoteName: file.remoteName
        });
        try {
            const content = await this.remote.readFile(file);
            // Set localName using the basePath from LocalManager
            const basePath = (this.local as any).basePath;
            if (basePath) {
                // Convert cloud path (with forward slashes) to local system path
                file.localName = this.normalizeLocalPath(basePath, file.name);
                // Log the path before creating directory
                this.log(LogLevel.Debug, 'Creating directory for', { path: file.localName });
                // Ensure the directory exists before writing
                await this.ensureDirectoryExists(file.localName);
            }
            await this.local.writeFile(file, content);
            this.log(LogLevel.Debug, 'Successfully copied to local', {
                name: file.name,
                localName: file.localName,
                remoteName: file.remoteName
            });
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to copy to local', {
                name: file.name,
                localName: file.localName,
                remoteName: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFromRemote(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'Deleting from remote', {
            name: file.name,
            remoteName: file.remoteName
        });
        try {
            await this.remote.deleteFile(file);
            this.log(LogLevel.Debug, 'Successfully deleted from remote', {
                name: file.name,
                remoteName: file.remoteName
            });
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to delete from remote', {
                name: file.name,
                remoteName: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFromLocal(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'Deleting from local', { file: file.name });
        try {
            await this.local.deleteFile(file);
            this.log(LogLevel.Debug, 'Successfully deleted from local', { file: file.name });
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to delete from local', {
                file: file.name,
                error
            });
            throw error;
        }
    }

    async diffMerge(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'Starting diff merge', { file: file.name });
        try {
            // Read both files in parallel
            const [localBuffer, remoteBuffer] = await Promise.all([
                this.local.readFile(file),
                this.remote.readFile(file)
            ]);

            // Convert buffers to strings and lines
            const localContent = localBuffer.toString();
            const remoteContent = remoteBuffer.toString();
            const localLines = localContent.split("\n");
            const remoteLines = remoteContent.split("\n");

            // Create diff instance and compute differences
            const dmp = new diff_match_patch();
            const diffs = dmp.diff_main(localLines.join("\n"), remoteLines.join("\n"));
            dmp.diff_cleanupSemantic(diffs);

            // Initialize merged lines with local lines
            const mergedLines = [...localLines];

            // Process the diffs
            for (const [operation, text] of diffs) {
                if (operation === diff_match_patch.DIFF_INSERT) {
                    const lines = text.split("\n");
                    lines.pop(); // Remove empty string from split
                    const index = mergedLines.indexOf(localLines[0]);
                    mergedLines.splice(index, 0, ...lines);
                }
            }

            // Create merged content buffer
            const mergedBuffer = Buffer.from(mergedLines.join("\n"));

            // Write merged content to both local and remote
            await Promise.all([
                this.local.writeFile(file, mergedBuffer),
                this.remote.writeFile(file, mergedBuffer)
            ]);

            this.log(LogLevel.Debug, 'Successfully completed diff merge', { file: file.name });
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to perform diff merge', {
                file: file.name,
                error
            });
            throw error;
        }
    }
}
