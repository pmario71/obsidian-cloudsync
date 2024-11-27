import { AbstractManager, File, ScanState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import { GoogleAuth } from 'google-auth-library';
import * as xml2js from "xml2js";
import { posix } from 'path';

export class GCPManager extends AbstractManager {
    private auth: GoogleAuth | null = null;
    private accessToken: string = '';
    private bucket: string = '';
    private readonly vaultPrefix: string;

    constructor(settings: CloudSyncSettings, vaultName: string) {
        super(settings);
        // Sanitize vault name for use as prefix (similar to Azure's container name sanitization)
        this.vaultPrefix = vaultName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        this.log(LogLevel.Debug, `GCPManager initialized with vault prefix: ${this.vaultPrefix}`);
    }

    public getProviderName(): string {
        return 'gcp';
    }

    private validateSettings(): void {
        this.log(LogLevel.Debug, 'GCP Validate Settings - Starting');
        if (!this.settings.gcp.privateKey || this.settings.gcp.privateKey.trim() === '') {
            throw new Error('GCP private key is required');
        }
        if (!this.settings.gcp.clientEmail || this.settings.gcp.clientEmail.trim() === '') {
            throw new Error('GCP client email is required');
        }
        if (!this.settings.gcp.bucket || this.settings.gcp.bucket.trim() === '') {
            throw new Error('GCP bucket name is required');
        }
        this.log(LogLevel.Debug, 'GCP Validate Settings - Success');
    }

    private logGCPSettings(): void {
        this.log(LogLevel.Debug, 'GCP Settings:', {
            clientEmail: this.settings.gcp.clientEmail,
            bucket: this.settings.gcp.bucket,
            privateKey: this.settings.gcp.privateKey.substring(0, 100) + '...' // Show first 100 chars only
        });
    }

    private processPrivateKey(key: string): string {
        this.log(LogLevel.Debug, 'Processing private key...');

        // Try parsing as JSON first
        try {
            const parsed = JSON.parse(key);
            if (parsed.private_key) {
                key = parsed.private_key;
                this.log(LogLevel.Debug, 'Extracted private key from JSON');
            }
        } catch (e) {
            this.log(LogLevel.Debug, 'Key is not in JSON format, treating as raw PEM');
        }

        // Handle escaped newlines
        key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
        this.log(LogLevel.Debug, 'Key after newline processing:', { key: key.substring(0, 100) + '...' });

        const pemHeader = '-----BEGIN PRIVATE KEY-----';
        const pemFooter = '-----END PRIVATE KEY-----';

        // Extract and validate PEM content
        let startIndex = key.indexOf(pemHeader);
        let endIndex = key.indexOf(pemFooter);

        if (startIndex === -1 || endIndex === -1) {
            this.log(LogLevel.Error, 'Invalid PEM format:', {
                hasHeader: startIndex !== -1,
                hasFooter: endIndex !== -1
            });
            throw new Error('Private key must contain valid PEM header and footer');
        }

        // Extract base64 content
        startIndex += pemHeader.length;
        let content = key.substring(startIndex, endIndex).trim();
        this.log(LogLevel.Debug, 'Extracted content length:', { length: content.length });

        // Clean and validate base64
        content = content.replace(/[\s\r\n]/g, '');
        this.log(LogLevel.Debug, 'Content after whitespace removal length:', { length: content.length });

        if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
            this.log(LogLevel.Error, 'Invalid base64 content');
            throw new Error('Private key contains invalid base64 content');
        }

        // Format final key
        const lines = content.match(/.{1,64}/g) || [];
        const formattedKey = `${pemHeader}\n${lines.join('\n')}\n${pemFooter}`;

        this.log(LogLevel.Debug, 'Private key processed successfully');
        return formattedKey;
    }

    private async refreshToken(): Promise<void> {
        if (!this.auth) {
            this.auth = new GoogleAuth({
                credentials: {
                    client_email: this.settings.gcp.clientEmail,
                    private_key: this.processPrivateKey(this.settings.gcp.privateKey)
                },
                scopes: ['https://www.googleapis.com/auth/devstorage.full_control']
            });
        }

        const client = await this.auth.getClient();
        const token = await client.getAccessToken();
        this.accessToken = token.token || '';
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Debug, 'GCP Authentication - Starting');
            this.logGCPSettings();
            this.validateSettings();

            this.bucket = this.settings.gcp.bucket.trim();
            await this.refreshToken();

            // Test authentication by listing bucket
            const url = `https://${this.bucket}.storage.googleapis.com?prefix=${encodeURIComponent(this.vaultPrefix)}`;
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.state = ScanState.Ready;
            this.log(LogLevel.Trace, 'GCP Authentication - Success');
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Authentication - Failed', error);
            this.state = ScanState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.log(LogLevel.Debug, 'GCP Connection Test - Starting');
            this.logGCPSettings();
            this.validateSettings();

            await this.refreshToken();
            const url = `https://${this.bucket}.storage.googleapis.com?prefix=${encodeURIComponent(this.vaultPrefix)}`;
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                this.log(LogLevel.Info, 'GCP Connection Test - Success');
                return {
                    success: true,
                    message: "Successfully connected to GCP Storage"
                };
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Connection Test - Failed', error);
            return {
                success: false,
                message: `GCP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }

    private normalizeCloudPath(path: string): string {
        // Ensure consistent forward slash usage for cloud paths
        return path.split('/').join(posix.sep);
    }

    private addVaultPrefix(remoteName: string): string {
        // If remoteName already has the vault prefix, don't add it again
        if (remoteName.startsWith(`${this.vaultPrefix}/`)) {
            return remoteName;
        }
        // If remoteName is already a full path (e.g., testing/assets/file.jpg), use it as is
        if (remoteName.includes('/')) {
            return remoteName;
        }
        return `${this.vaultPrefix}/${remoteName}`;
    }

    private removeVaultPrefix(path: string): string {
        const prefix = `${this.vaultPrefix}/`;
        return path.startsWith(prefix) ? path.slice(prefix.length) : path;
    }

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, 'GCP Read File - Started', { file: file.remoteName });
        try {
            await this.refreshToken();
            // Use remoteName directly if it's a full path
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.addVaultPrefix(file.remoteName);
            const url = `https://${this.bucket}.storage.googleapis.com/${fullPath}`;
            this.log(LogLevel.Debug, 'GCP Read File - URL', { url });

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            this.log(LogLevel.Debug, 'GCP Read File - Success', {
                file: file.remoteName,
                size: buffer.length
            });
            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Read File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Debug, 'GCP Write File - Starting', {
            file: file.remoteName,
            size: content.length
        });

        try {
            await this.refreshToken();
            // Use remoteName directly if it's a full path
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.addVaultPrefix(file.remoteName);
            const url = `https://${this.bucket}.storage.googleapis.com/${fullPath}`;
            this.log(LogLevel.Debug, 'GCP Write File - URL', { url });

            const response = await fetch(url, {
                method: 'PUT',
                body: content,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': file.mime
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.log(LogLevel.Debug, 'GCP Write File - Success', { file: file.remoteName });
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Write File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'GCP Delete File - Starting', { file: file.remoteName });
        try {
            await this.refreshToken();
            // Use remoteName directly if it's a full path
            const fullPath = file.remoteName.includes('/') ? file.remoteName : this.addVaultPrefix(file.remoteName);
            const url = `https://${this.bucket}.storage.googleapis.com/${fullPath}`;
            this.log(LogLevel.Debug, 'GCP Delete File - URL', { url });

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.log(LogLevel.Debug, 'GCP Delete File - Success', { file: file.remoteName });
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Delete File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.log(LogLevel.Debug, 'GCP Get Files - Starting');
        try {
            await this.refreshToken();
            const url = `https://${this.bucket}.storage.googleapis.com?prefix=${encodeURIComponent(this.vaultPrefix)}`;
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.text();
            const result = await xml2js.parseStringPromise(data);
            const items = result.ListBucketResult.Contents;

            if (!items || items.length === 0) {
                return [];
            }

            const processedFiles: File[] = items.map((item: any) => {
                const key = item.Key[0];
                const lastModified = new Date(item.LastModified[0]);
                const eTag = item.ETag[0];
                const size = Number(item.Size[0]);

                // Remove the vault prefix from the name for local operations
                const nameWithoutPrefix = this.removeVaultPrefix(decodeURIComponent(key));
                // Normalize the path to ensure consistent forward slashes
                const normalizedName = this.normalizeCloudPath(nameWithoutPrefix);

                return {
                    name: normalizedName,
                    localName: normalizedName,
                    remoteName: key,  // Keep encoded name for remote operations
                    mime: 'application/octet-stream', // MIME type not provided in XML response
                    lastModified: lastModified,
                    size: size,
                    md5: eTag.replace(/"/g, ''), // Remove quotes from ETag
                    isDirectory: false
                };
            });

            this.files = processedFiles;
            this.log(LogLevel.Debug, 'GCP Get Files - Success', { fileCount: processedFiles.length });
            return processedFiles;
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Get Files - Failed', error);
            throw error;
        }
    }
}
