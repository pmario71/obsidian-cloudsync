import { join, normalize, dirname, sep } from "path";
import { mkdir } from "fs/promises";
import { AbstractManager, File } from "./AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { LocalManager } from "./localManager";

export class FileOperations {
    constructor(
        private readonly local: AbstractManager,
        private readonly remote: AbstractManager
    ) {}

    private async ensureDirectoryExists(filePath: string): Promise<void> {
        const normalizedPath = normalize(filePath);
        const parts = dirname(normalizedPath).split(sep);
        let currentPath = parts[0];

        for (let i = 1; i < parts.length; i++) {
            currentPath = join(currentPath, parts[i]);
            try {
                await mkdir(currentPath);
                LogManager.log(LogLevel.Debug, `Created directory ${currentPath}`);
            } catch (error: any) {
                if (error.code !== 'EEXIST') {
                    LogManager.log(LogLevel.Error, `Failed to create directory ${currentPath}`, error);
                    throw error;
                }
            }
        }
    }

    private normalizeLocalPath(basePath: string, relativePath: string): string {
        const normalizedRelative = relativePath.split(sep).join(sep);
        return normalize(join(basePath, normalizedRelative));
    }

    async copyToRemote(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Preparing to upload ${file.name} to ${this.remote.name}`);
        try {
            const content = await this.local.readFile(file);
            await this.remote.writeFile(file, content);
            LogManager.log(LogLevel.Trace, `Uploaded ${file.name} to ${this.remote.name}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to upload ${file.name} to ${this.remote.name}`, error);
            throw error;
        }
    }

    async copyToLocal(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Preparing to download ${file.name} from ${this.remote.name}`);
        try {
            const content = await this.remote.readFile(file);
            const localManager = this.local as LocalManager;
            const basePath = (localManager as any).basePath;
            if (basePath) {
                file.localName = this.normalizeLocalPath(basePath, file.name);
                LogManager.log(LogLevel.Debug, `Creating directory structure for ${file.localName}`);
                await this.ensureDirectoryExists(file.localName);
            }
            await this.local.writeFile(file, content);
            LogManager.log(LogLevel.Trace, `Downloaded ${file.name} from ${this.remote.name}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to download ${file.name} from ${this.remote.name}`, error);
            throw error;
        }
    }

    async deleteFromRemote(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Preparing to delete ${file.name} from ${this.remote.name}`);
        try {
            await this.remote.deleteFile(file);
            LogManager.log(LogLevel.Trace, `Deleted ${file.name} from ${this.remote.name}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete ${file.name} from ${this.remote.name}`, error);
            throw error;
        }
    }

    async deleteFromLocal(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Preparing to delete ${file.name} from local`);
        try {
            await this.local.deleteFile(file);
            LogManager.log(LogLevel.Trace, `Deleted ${file.name} from local`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete ${file.name} from local`, error);
            throw error;
        }
    }
}
