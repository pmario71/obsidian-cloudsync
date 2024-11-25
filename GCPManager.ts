import { AbstractManager, File, SyncState } from './AbstractManager';
import { CloudSyncSettings } from './types';
import { GoogleAuth } from "google-auth-library";
import fetch, { Response } from 'node-fetch';

interface GCPStorageObject {
    name: string;
    contentType: string;
    updated: string;
    size: string;
    md5Hash?: string;
}

interface GCPListResponse {
    items?: GCPStorageObject[];
    nextPageToken?: string;
}

interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer;
    responseType?: 'arraybuffer';
}

export class GCPManager extends AbstractManager {
    private auth: GoogleAuth | null = null;
    private bucketName: string = '';

    constructor(settings: CloudSyncSettings) {
        super(settings);
    }

    private validateSettings(): void {
        if (!this.settings.gcp.privateKey || this.settings.gcp.privateKey.trim() === '') {
            throw new Error('GCP Private Key is required');
        }
        if (!this.settings.gcp.clientEmail || this.settings.gcp.clientEmail.trim() === '') {
            throw new Error('GCP Client Email is required');
        }
        if (!this.settings.gcp.bucket || this.settings.gcp.bucket.trim() === '') {
            throw new Error('GCP Bucket name is required');
        }
    }

    private formatPrivateKey(privateKey: string): string {
        this.debugLog('GCP Format Private Key - Starting');

        try {
            let key = privateKey;

            // Handle escaped newlines
            if (key.includes('\\\\n')) {
                key = key.replace(/\\\\n/g, '\n');
            }
            if (key.includes('\\n')) {
                key = key.replace(/\\n/g, '\n');
            }

            // Normalize line endings
            key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            // Process the key content
            let lines = key.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const startIndex = lines.findIndex(line => line === '-----BEGIN PRIVATE KEY-----');
            const endIndex = lines.findIndex(line => line === '-----END PRIVATE KEY-----');

            // Extract base64 content
            let base64Content;
            if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                base64Content = lines.slice(startIndex + 1, endIndex).join('');
            } else {
                base64Content = lines
                    .filter(line => !line.includes('-----BEGIN') && !line.includes('-----END'))
                    .join('');
            }

            base64Content = base64Content.replace(/\s+/g, '');

            // Validate base64
            try {
                Buffer.from(base64Content, 'base64');
            } catch (error) {
                throw new Error('Invalid base64 in private key');
            }

            // Format the final key
            const chunks = base64Content.match(/.{1,64}/g) || [];
            const formattedKey = [
                '-----BEGIN PRIVATE KEY-----',
                ...chunks,
                '-----END PRIVATE KEY-----'
            ].join('\n');

            this.debugLog('GCP Format Private Key - Success');
            return formattedKey;
        } catch (error) {
            this.debugLog('GCP Format Private Key - Failed', error);
            throw error;
        }
    }

    private async makeRequest(url: string, options: RequestOptions = {}): Promise<any> {
        if (!this.auth) {
            throw new Error('Not authenticated');
        }

        const client = await this.auth.getClient();
        const headers = await client.getRequestHeaders();

        try {
            const response: Response = await fetch(url, {
                ...options,
                headers: {
                    ...headers,
                    ...(options.headers || {})
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
            }

            if (options.responseType === 'arraybuffer') {
                const buffer = await response.buffer();
                return { data: buffer };
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            throw error;
        }
    }

    async authenticate(): Promise<void> {
        try {
            this.debugLog('GCP Authentication - Starting');
            this.validateSettings();

            const formattedKey = this.formatPrivateKey(this.settings.gcp.privateKey);
            const credentials = {
                client_email: this.settings.gcp.clientEmail.trim(),
                private_key: formattedKey
            };

            this.auth = new GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });

            this.bucketName = this.settings.gcp.bucket.trim();

            // Test authentication
            const url = `https://storage.googleapis.com/storage/v1/b/${this.bucketName}`;
            await this.makeRequest(url);

            this.state = SyncState.Ready;
            this.debugLog('GCP Authentication - Success');
        } catch (error) {
            this.debugLog('GCP Authentication - Failed', error);
            this.state = SyncState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.debugLog('GCP Connection Test - Starting');
            this.validateSettings();

            const formattedKey = this.formatPrivateKey(this.settings.gcp.privateKey);
            const credentials = {
                client_email: this.settings.gcp.clientEmail.trim(),
                private_key: formattedKey
            };

            this.auth = new GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/cloud-platform']
            });

            const url = `https://storage.googleapis.com/storage/v1/b/${this.settings.gcp.bucket.trim()}`;
            await this.makeRequest(url);

            this.debugLog('GCP Connection Test - Success');
            return {
                success: true,
                message: "Successfully connected to Google Cloud Storage"
            };
        } catch (error) {
            this.debugLog('GCP Connection Test - Failed', error);
            return {
                success: false,
                message: `GCP connection failed: ${error.message}`,
                details: error
            };
        }
    }

    async readFile(file: File): Promise<Buffer> {
        this.debugLog('GCP Read File - Starting', { file: file.remoteName });
        if (!this.auth) {
            throw new Error('Not authenticated');
        }

        try {
            const url = `https://storage.googleapis.com/storage/v1/b/${this.bucketName}/o/${encodeURIComponent(file.remoteName)}?alt=media`;
            const response = await this.makeRequest(url, { responseType: 'arraybuffer' });

            const buffer = Buffer.from(response.data);
            this.debugLog('GCP Read File - Success', {
                file: file.remoteName,
                size: buffer.length
            });
            return buffer;
        } catch (error) {
            this.debugLog('GCP Read File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.debugLog('GCP Write File - Starting', {
            file: file.remoteName,
            size: content.length
        });

        if (!this.auth) {
            throw new Error('Not authenticated');
        }

        try {
            const url = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucketName}/o?uploadType=media&name=${encodeURIComponent(file.remoteName)}`;
            await this.makeRequest(url, {
                method: 'POST',
                body: content,
                headers: {
                    'Content-Type': file.mime
                }
            });

            this.debugLog('GCP Write File - Success', { file: file.remoteName });
        } catch (error) {
            this.debugLog('GCP Write File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.debugLog('GCP Delete File - Starting', { file: file.remoteName });
        if (!this.auth) {
            throw new Error('Not authenticated');
        }

        try {
            const url = `https://storage.googleapis.com/storage/v1/b/${this.bucketName}/o/${encodeURIComponent(file.remoteName)}`;
            await this.makeRequest(url, {
                method: 'DELETE'
            });

            this.debugLog('GCP Delete File - Success', { file: file.remoteName });
        } catch (error) {
            this.debugLog('GCP Delete File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.debugLog('GCP Get Files - Starting');
        if (!this.auth) {
            throw new Error('Not authenticated');
        }

        try {
            const files: File[] = [];
            let pageToken: string | undefined;

            do {
                const url = `https://storage.googleapis.com/storage/v1/b/${this.bucketName}/o${pageToken ? `?pageToken=${pageToken}` : ''}`;
                const response = await this.makeRequest(url);
                const data = response.data;

                if (data.items) {
                    for (const item of data.items) {
                        files.push({
                            name: item.name,
                            localName: item.name,
                            remoteName: item.name,
                            mime: item.contentType || 'application/octet-stream',
                            lastModified: new Date(item.updated),
                            size: parseInt(item.size),
                            md5: item.md5Hash ? Buffer.from(item.md5Hash, 'base64').toString('hex') : '',
                            isDirectory: false
                        });
                    }
                }

                pageToken = data.nextPageToken;
            } while (pageToken);

            this.files = files;
            this.debugLog('GCP Get Files - Success', { fileCount: files.length });
            return files;
        } catch (error) {
            this.debugLog('GCP Get Files - Failed', error);
            throw error;
        }
    }
}
