import { AbstractManager, File, SyncState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import { Storage, File as GCPFile } from '@google-cloud/storage';

export class GCPManager extends AbstractManager {
    private storage: Storage | null = null;
    private bucket: string = '';

    constructor(settings: CloudSyncSettings) {
        super(settings);
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

    private createStorageClient(): Storage {
        this.log(LogLevel.Debug, 'GCP Create Storage Client - Starting');
        try {
            const privateKey = this.processPrivateKey(this.settings.gcp.privateKey);
            this.log(LogLevel.Debug, 'Formatted private key:', {
                key: privateKey.substring(0, 100) + '...'
            });

            const storage = new Storage({
                credentials: {
                    client_email: this.settings.gcp.clientEmail,
                    private_key: privateKey
                },
                projectId: 'obsidian-cloudsync'
            });
            this.log(LogLevel.Debug, 'GCP Create Storage Client - Success');
            return storage;
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Create Storage Client - Failed', error);
            throw error;
        }
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Debug, 'GCP Authentication - Starting');
            this.logGCPSettings();
            this.validateSettings();

            this.bucket = this.settings.gcp.bucket.trim();
            this.storage = this.createStorageClient();

            // Test authentication by getting bucket metadata
            await this.storage.bucket(this.bucket).getMetadata();

            this.state = SyncState.Ready;
            this.log(LogLevel.Trace, 'GCP Authentication - Success');
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Authentication - Failed', error);
            this.state = SyncState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.log(LogLevel.Debug, 'GCP Connection Test - Starting');
            this.logGCPSettings();
            this.validateSettings();

            const storage = this.createStorageClient();
            const bucket = storage.bucket(this.settings.gcp.bucket.trim());
            const [exists] = await bucket.exists();

            if (exists) {
                this.log(LogLevel.Info, 'GCP Connection Test - Success');
                return {
                    success: true,
                    message: "Successfully connected to GCP Storage"
                };
            } else {
                this.log(LogLevel.Error, 'GCP Connection Test - Failed: Bucket does not exist');
                return {
                    success: false,
                    message: "GCP bucket does not exist"
                };
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

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, 'GCP Read File - Starting', { file: file.remoteName });
        if (!this.storage) {
            throw new Error('Not authenticated');
        }

        try {
            const bucket = this.storage.bucket(this.bucket);
            const blob = bucket.file(file.remoteName);
            const [buffer] = await blob.download();

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

        if (!this.storage) {
            throw new Error('Not authenticated');
        }

        try {
            const bucket = this.storage.bucket(this.bucket);
            const blob = bucket.file(file.remoteName);
            await blob.save(content, {
                contentType: file.mime,
                metadata: {
                    contentType: file.mime
                }
            });
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
        if (!this.storage) {
            throw new Error('Not authenticated');
        }

        try {
            const bucket = this.storage.bucket(this.bucket);
            const blob = bucket.file(file.remoteName);
            await blob.delete();
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
        if (!this.storage) {
            throw new Error('Not authenticated');
        }

        try {
            const [files] = await this.storage.bucket(this.bucket).getFiles();
            const processedFiles: File[] = files.map((gcpFile: GCPFile) => {
                const size = typeof gcpFile.metadata.size === 'string'
                    ? parseInt(gcpFile.metadata.size)
                    : typeof gcpFile.metadata.size === 'number'
                        ? gcpFile.metadata.size
                        : 0;

                return {
                    name: gcpFile.name,
                    localName: gcpFile.name,
                    remoteName: gcpFile.name,
                    mime: gcpFile.metadata.contentType || 'application/octet-stream',
                    lastModified: new Date(gcpFile.metadata.updated || Date.now()),
                    size: size,
                    md5: gcpFile.metadata.md5Hash || '',
                    isDirectory: false
                };
            });

            this.files = processedFiles;
            this.log(LogLevel.Debug, 'GCP Get Files - Success', { fileCount: files.length });
            return processedFiles;
        } catch (error) {
            this.log(LogLevel.Error, 'GCP Get Files - Failed', error);
            throw error;
        }
    }
}
