import { File } from "../sync/AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { GCPPaths } from "./paths";
import { GCPAuth } from "./auth";
import { parseStringPromise } from "xml2js";

interface GCPSession {
    token: string;
    expiry: number;
    headers: Record<string, string>;
}

export class GCPFiles {
    private session: GCPSession | null = null;
    private readonly MAX_CONCURRENT = 5;

    constructor(
        private readonly bucket: string,
        private readonly paths: GCPPaths,
        private readonly auth: GCPAuth
    ) {}

    setSession(session: GCPSession): void {
        this.session = session;
        LogManager.log(LogLevel.Debug, 'GCP Files session updated', {
            expiresIn: Math.floor((session.expiry - Date.now()) / 1000)
        });
    }

    private getHeaders(): Record<string, string> {
        if (!this.session) {
            throw new Error('No active GCP session');
        }
        return this.session.headers;
    }

    async readFile(file: File): Promise<Uint8Array> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from GCP`);
        try {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || file.name);
            const encodedPath = this.paths.localToRemoteName(prefixedPath);
            const url = this.paths.getObjectUrl(this.bucket, encodedPath);

            LogManager.log(LogLevel.Debug, 'Prepared GCP request', {
                url,
                originalName: file.name,
                remoteName: file.remoteName,
                prefixedPath,
                encodedPath
            });

            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to read ${file.name} from GCP`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Uint8Array): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to GCP (${content.length} bytes)`);
        try {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || file.name);
            const encodedPath = this.paths.localToRemoteName(prefixedPath);
            const url = this.paths.getObjectUrl(this.bucket, encodedPath);

            LogManager.log(LogLevel.Debug, 'Prepared GCP request', {
                url,
                originalName: file.name,
                remoteName: file.remoteName,
                prefixedPath,
                encodedPath,
                size: content.length,
                mime: file.mime
            });

            const response = await fetch(url, {
                method: 'PUT',
                body: content,
                headers: {
                    ...this.getHeaders(),
                    'Content-Length': content.length.toString()
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            LogManager.log(LogLevel.Trace, `Successfully wrote ${file.name} to GCP`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to write ${file.name} to GCP`, error);
            throw error;
        }
    }

    async writeFiles(files: Array<{file: File, content: Uint8Array}>): Promise<void> {
        LogManager.log(LogLevel.Debug, `Writing ${files.length} files to GCP in batches`);
        const headers = this.getHeaders();

        // Process in batches
        for (let i = 0; i < files.length; i += this.MAX_CONCURRENT) {
            const batch = files.slice(i, i + this.MAX_CONCURRENT);
            const promises = batch.map(async ({file, content}) => {
                const prefixedPath = this.paths.addVaultPrefix(file.remoteName || file.name);
                const encodedPath = this.paths.localToRemoteName(prefixedPath);
                const url = this.paths.getObjectUrl(this.bucket, encodedPath);

                const response = await fetch(url, {
                    method: 'PUT',
                    body: content,
                    headers: {
                        ...headers,
                        'Content-Length': content.length.toString()
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to write ${file.name}: HTTP ${response.status}`);
                }
            });

            await Promise.all(promises);
            LogManager.log(LogLevel.Debug, `Completed batch ${i / this.MAX_CONCURRENT + 1}`);
        }
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Trace, `Deleting ${file.name} from GCP`);
        try {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || file.name);
            const encodedPath = this.paths.localToRemoteName(prefixedPath);
            const url = this.paths.getObjectUrl(this.bucket, encodedPath);

            LogManager.log(LogLevel.Debug, 'Prepared GCP request', {
                url,
                originalName: file.name,
                remoteName: file.remoteName,
                prefixedPath,
                encodedPath,
                decodedRemoteName: this.paths.remoteToLocalName(file.remoteName)
            });

            const response = await fetch(url, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            LogManager.log(LogLevel.Trace, `Successfully deleted ${file.name} from GCP`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to delete ${file.name} from GCP`, error);
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        LogManager.log(LogLevel.Trace, 'Listing files in GCP bucket');
        try {
            const prefix = this.paths.localToRemoteName(this.paths.addVaultPrefix(''));
            const url = `${this.paths.getBucketUrl(this.bucket)}?prefix=${prefix}`;

            LogManager.log(LogLevel.Debug, 'Prepared GCP list request', { url });

            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            const result = await parseStringPromise(text);
            const items = result.ListBucketResult.Contents;

            if (!items || items.length === 0) {
                LogManager.log(LogLevel.Debug, 'No files found in GCP bucket');
                return [];
            }

            LogManager.log(LogLevel.Debug, `Processing ${items.length} items from response`);

            const processedFiles = items.map((item: { Key: string[], Size: string[], LastModified: string[], ETag: string[] }) => {
                const key = item.Key[0];
                const normalizedName = this.paths.removeVaultPrefix(decodeURIComponent(key));
                const cloudPath = this.paths.normalizeCloudPath(normalizedName);

                LogManager.log(LogLevel.Debug, 'Processing file', {
                    name: cloudPath,
                    key,
                    size: item.Size[0]
                });

                return {
                    name: cloudPath,
                    localName: cloudPath,
                    remoteName: key,
                    mime: 'application/octet-stream',
                    lastModified: new Date(item.LastModified[0]),
                    size: Number(item.Size[0]),
                    md5: item.ETag[0].replace(/"/g, ''),
                    isDirectory: false
                };
            });

            LogManager.log(LogLevel.Trace, `Found ${processedFiles.length} files in GCP bucket`);
            return processedFiles;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to list files in GCP bucket', error);
            throw error;
        }
    }
}
