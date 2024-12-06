import { AbstractManager, File } from "./AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { join, dirname, sep, posix, normalize } from "path";
import { mkdir } from "fs/promises";

export class FileOperations {
    constructor(
        private readonly local: AbstractManager,
        private readonly remote: AbstractManager
    ) {}

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    private async ensureDirectoryExists(filePath: string): Promise<void> {
        const fullPath = normalize(filePath);
        const directory = dirname(fullPath);
        const segments = directory.split(sep);
        let currentPath = segments[0];

        for (let i = 1; i < segments.length; i++) {
            currentPath = join(currentPath, segments[i]);
            try {
                await mkdir(currentPath);
                this.log(LogLevel.Debug, `Created directory ${currentPath}`);
            } catch (error: any) {
                if (error.code !== 'EEXIST') {
                    this.log(LogLevel.Error, `Failed to create directory ${currentPath}`, error);
                    throw error;
                }
            }
        }
    }

    private normalizeLocalPath(basePath: string, relativePath: string): string {
        const normalizedRelative = relativePath.split(posix.sep).join(sep);
        return normalize(join(basePath, normalizedRelative));
    }

    async copyToRemote(file: File): Promise<void> {
        this.log(LogLevel.Debug, `Preparing to upload ${file.name} to ${this.remote.name}`);

        try {
            const content = await this.local.readFile(file);
            await this.remote.writeFile(file, content);
            this.log(LogLevel.Trace, `Uploaded ${file.name} to ${this.remote.name}`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to upload ${file.name} to ${this.remote.name}`, error);
            throw error;
        }
    }

    async copyToLocal(file: File): Promise<void> {
        this.log(LogLevel.Debug, `Preparing to download ${file.name} from ${this.remote.name}`);

        try {
            const content = await this.remote.readFile(file);
            const basePath = (this.local as any).basePath;
            if (basePath) {
                file.localName = this.normalizeLocalPath(basePath, file.name);
                this.log(LogLevel.Debug, `Creating directory structure for ${file.localName}`);
                await this.ensureDirectoryExists(file.localName);
            }
            await this.local.writeFile(file, content);
            this.log(LogLevel.Trace, `Downloaded ${file.name} from ${this.remote.name}`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to download ${file.name} from ${this.remote.name}`, error);
            throw error;
        }
    }

    async deleteFromRemote(file: File): Promise<void> {
        this.log(LogLevel.Debug, `Preparing to delete ${file.name} from ${this.remote.name}`);
        try {
            await this.remote.deleteFile(file);
            this.log(LogLevel.Trace, `Deleted ${file.name} from ${this.remote.name}`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to delete ${file.name} from ${this.remote.name}`, error);
            throw error;
        }
    }

    async deleteFromLocal(file: File): Promise<void> {
        this.log(LogLevel.Debug, `Preparing to delete ${file.name} from local`);
        try {
            await this.local.deleteFile(file);
            this.log(LogLevel.Trace, `Deleted ${file.name} from local`);
        } catch (error) {
            this.log(LogLevel.Error, `Failed to delete ${file.name} from local`, error);
            throw error;
        }
    }
}
