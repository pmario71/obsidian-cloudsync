import { File } from "../sync/AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { GCPPaths } from "./paths";
import { GCPAuth } from "./auth";
import { parseStringPromise } from "xml2js";

export class GCPFiles {
    constructor(
        private readonly bucket: string,
        private readonly paths: GCPPaths,
        private readonly auth: GCPAuth
    ) {}

    async readFile(file: File): Promise<Buffer> {
        LogManager.log(LogLevel.Trace, `Reading ${file.name} from GCP`);
        try {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));
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
                headers: {
                    Authorization: `Bearer ${await this.auth.getAccessToken()}`
                }
            });

            if (!response.ok) {
                LogManager.log(LogLevel.Error, `GCP read failed for ${file.name}`, {
                    status: response.status,
                    statusText: response.statusText,
                    url,
                    prefixedPath,
                    encodedPath
                });
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            LogManager.log(LogLevel.Trace, `Read ${buffer.length} bytes from ${file.name}`);
            return buffer;
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to read ${file.name} from GCP`, error);
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        LogManager.log(LogLevel.Trace, `Writing ${file.name} to GCP (${content.length} bytes)`);
        try {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));
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
                    Authorization: `Bearer ${await this.auth.getAccessToken()}`,
                    'Content-Type': file.mime
                }
            });

            if (!response.ok) {
                LogManager.log(LogLevel.Error, `GCP write failed for ${file.name}`, {
                    status: response.status,
                    statusText: response.statusText,
                    url,
                    prefixedPath,
                    encodedPath
                });
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            LogManager.log(LogLevel.Trace, `Successfully wrote ${file.name} to GCP`);
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to write ${file.name} to GCP`, error);
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Trace, `Deleting ${file.name} from GCP`);
        try {
            const prefixedPath = this.paths.addVaultPrefix(file.remoteName || this.paths.localToRemoteName(file.name));
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
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${await this.auth.getAccessToken()}`
                }
            });

            if (!response.ok) {
                LogManager.log(LogLevel.Error, `GCP delete failed for ${file.name}`, {
                    status: response.status,
                    statusText: response.statusText,
                    url,
                    prefixedPath,
                    encodedPath
                });
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
                headers: {
                    Authorization: `Bearer ${await this.auth.getAccessToken()}`
                }
            });

            if (!response.ok) {
                LogManager.log(LogLevel.Error, 'GCP list failed', {
                    status: response.status,
                    statusText: response.statusText,
                    url
                });
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
