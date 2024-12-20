import { AbstractManager, File } from "./AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { LocalManager } from "./localManager";
import { normalizePath } from "obsidian";
import { FileOperationError } from "./errors";

export class FileOperations {
    constructor(
        private readonly local: AbstractManager,
        private readonly remote: AbstractManager
    ) {}

    private isDirectoryPath(path: string): boolean {
        return path === '/' || path.endsWith('/') || path.includes('/.') || path.includes('/./') || path.includes('/../');
    }

    async copyToRemote(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Preparing to upload ${file.name} to ${this.remote.name}`);

        // Skip directory operations
        if (file.isDirectory || this.isDirectoryPath(file.name)) {
            LogManager.log(LogLevel.Debug, `Skipping upload for directory: ${file.name}`);
            return;
        }

        try {
            const content = await this.local.readFile(file).catch(error => {
                if (error.code === 'EISDIR') {
                    LogManager.log(LogLevel.Debug, `Skipping upload for directory: ${file.name}`);
                    return new Uint8Array(0);
                }
                throw new FileOperationError('read', file.name, `Local read failed: ${error.message}`);
            });

            // Skip if we got empty content from a directory
            if (content.length === 0 && (file.isDirectory || this.isDirectoryPath(file.name))) {
                return;
            }

            await this.remote.writeFile(file, content).catch(error => {
                throw new FileOperationError('write', file.name, `Remote write failed: ${error.message}`);
            });

            LogManager.log(LogLevel.Trace, `Uploaded ${file.name} to ${this.remote.name}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to upload ${file.name} to ${this.remote.name}`, error);
            throw error;
        }
    }

    async copyToLocal(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Preparing to download ${file.name} from ${this.remote.name}`);

        // Skip directory operations
        if (file.isDirectory || this.isDirectoryPath(file.name)) {
            LogManager.log(LogLevel.Debug, `Skipping download for directory: ${file.name}`);
            return;
        }

        try {
            const content = await this.remote.readFile(file).catch(error => {
                throw new FileOperationError('read', file.name, `Remote read failed: ${error.message}`);
            });

            // Skip if we got empty content from a directory
            if (content.length === 0 && (file.isDirectory || this.isDirectoryPath(file.name))) {
                return;
            }

            file.localName = normalizePath(file.name);
            await this.local.writeFile(file, content).catch(error => {
                if (error.code === 'EISDIR') {
                    LogManager.log(LogLevel.Debug, `Skipping write for directory: ${file.name}`);
                    return;
                }
                throw new FileOperationError('write', file.name, `Local write failed: ${error.message}`);
            });

            LogManager.log(LogLevel.Trace, `Downloaded ${file.name} from ${this.remote.name}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to download ${file.name} from ${this.remote.name}`, error);
            throw error;
        }
    }

    async deleteFromRemote(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Preparing to delete ${file.name} from ${this.remote.name}`);

        // Skip directory operations
        if (file.isDirectory || this.isDirectoryPath(file.name)) {
            LogManager.log(LogLevel.Debug, `Skipping delete for directory: ${file.name}`);
            return;
        }

        try {
            await this.remote.deleteFile(file).catch(error => {
                throw new FileOperationError('delete', file.name, `Remote delete failed: ${error.message}`);
            });
            LogManager.log(LogLevel.Trace, `Deleted ${file.name} from ${this.remote.name}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete ${file.name} from ${this.remote.name}`, error);
            throw error;
        }
    }

    async deleteFromLocal(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Preparing to delete ${file.name} from local`);

        // Skip directory operations
        if (file.isDirectory || this.isDirectoryPath(file.name)) {
            LogManager.log(LogLevel.Debug, `Skipping delete for directory: ${file.name}`);
            return;
        }

        try {
            file.localName = normalizePath(file.name);
            await this.local.deleteFile(file).catch(error => {
                if (error.code === 'EISDIR') {
                    LogManager.log(LogLevel.Debug, `Skipping delete for directory: ${file.name}`);
                    return;
                }
                throw new FileOperationError('delete', file.name, `Local delete failed: ${error.message}`);
            });
            LogManager.log(LogLevel.Trace, `Deleted ${file.name} from local`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete ${file.name} from local`, error);
            throw error;
        }
    }
}
