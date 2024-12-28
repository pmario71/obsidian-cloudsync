import { File } from "../AbstractManager";
import { LogManager } from "../../LogManager";
import { LogLevel } from "../types";
import { CloudPathHandler } from "../CloudPathHandler";

export interface RetryConfig {
    maxRetries?: number;
    baseDelay?: number;
}

export abstract class CloudFiles {
    protected static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1000
    };

    constructor(
        protected readonly bucket: string,
        protected readonly paths: CloudPathHandler
    ) {}

    protected isDirectoryPath(path: string): boolean {
        return path === '/' || path.endsWith('/') || path.includes('/.') || path.includes('/./') || path.includes('/../');
    }

    protected async parseXMLError(text: string): Promise<string> {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const errorElement = xmlDoc.getElementsByTagName('Error')[0];

            if (errorElement) {
                const code = errorElement.getElementsByTagName('Code')[0]?.textContent ?? 'UnknownError';
                const message = errorElement.getElementsByTagName('Message')[0]?.textContent ?? 'Unknown error occurred';
                return `${code}: ${message}`;
            }
        } catch (error) {
            LogManager.log(LogLevel.Debug, 'Failed to parse XML error response', error);
        }
        return 'Unknown error occurred';
    }

    protected async retryOperation<T>(
        operation: () => Promise<T>,
        operationName: string,
        config: RetryConfig = CloudFiles.DEFAULT_RETRY_CONFIG
    ): Promise<T> {
        const maxRetries = config.maxRetries ?? CloudFiles.DEFAULT_RETRY_CONFIG.maxRetries!;
        const baseDelay = config.baseDelay ?? CloudFiles.DEFAULT_RETRY_CONFIG.baseDelay!;
        let retryCount = 0;

        while (true) {
            try {
                return await operation();
            } catch (error) {
                if (retryCount >= maxRetries) {
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, retryCount);
                LogManager.log(LogLevel.Debug, `Retrying ${operationName} operation`, {
                    attempt: retryCount + 1,
                    delay,
                    error: error instanceof Error ? error.message : String(error)
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
            }
        }
    }

    protected shouldSkipDirectoryOperation(file: File): boolean {
        if (file.isDirectory || this.isDirectoryPath(file.name)) {
            LogManager.log(LogLevel.Debug, 'Skipping operation for directory', { name: file.name });
            return true;
        }

        const remotePath = file.remoteName || file.name;
        if (this.isDirectoryPath(remotePath)) {
            LogManager.log(LogLevel.Debug, 'Skipping operation for directory path', { path: remotePath });
            return true;
        }

        return false;
    }

    protected createRootDirectoryFile(): File {
        return {
            name: '/',
            localName: '/',
            remoteName: '/',
            mime: 'application/octet-stream',
            lastModified: new Date(),
            size: 0,
            md5: '',
            isDirectory: true
        };
    }

    protected logFileOperation(operation: string, file: File, path: string): void {
        LogManager.log(LogLevel.Debug, `${operation} file:`, {
            originalName: file.name,
            remoteName: file.remoteName,
            remotePath: file.remoteName || file.name,
            fullPath: path
        });
    }

    abstract readFile(file: File): Promise<Uint8Array>;
    abstract writeFile(file: File, content: Uint8Array): Promise<void>;
    abstract deleteFile(file: File): Promise<void>;
    abstract getFiles(): Promise<File[]>;
}
