import { normalize } from "path-browserify";
import { AbstractManager, File } from "./AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { LocalManager } from "./localManager";

export class FileOperations {
    constructor(
        private readonly local: AbstractManager,
        private readonly remote: AbstractManager
    ) {}

    private normalizeLocalPath(relativePath: string): string {
        return relativePath.split(/[/\\]/).join('/');
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
            file.localName = this.normalizeLocalPath(file.name);
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
            file.localName = this.normalizeLocalPath(file.name);
            await this.local.deleteFile(file);
            LogManager.log(LogLevel.Trace, `Deleted ${file.name} from local`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete ${file.name} from local`, error);
            throw error;
        }
    }
}
