import { GoogleAuth } from 'google-auth-library';
import { LogLevel } from '../sync/types';
import { LogManager } from '../LogManager';
import { GCPAuthConfig, GCPTestResult } from './types';
import { GCPPaths } from './paths';

export class GCPAuth {
    private auth: GoogleAuth | null = null;
    private accessToken: string = '';

    constructor(
        private bucket: string,
        private paths: GCPPaths
    ) {}

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
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

    async initialize(clientEmail: string, privateKey: string): Promise<void> {
        const authConfig: GCPAuthConfig = {
            credentials: {
                client_email: clientEmail,
                private_key: this.processPrivateKey(privateKey)
            },
            scopes: ['https://www.googleapis.com/auth/devstorage.full_control']
        };

        this.auth = new GoogleAuth(authConfig);
        await this.refreshToken();
    }

    async refreshToken(): Promise<string> {
        if (!this.auth) {
            throw new Error('GCP Auth not initialized');
        }

        const client = await this.auth.getClient();
        const token = await client.getAccessToken();
        this.accessToken = token.token || '';
        return this.accessToken;
    }

    getAccessToken(): string {
        return this.accessToken;
    }

    async testConnectivity(): Promise<GCPTestResult> {
        try {
            this.log(LogLevel.Debug, 'Testing GCP connectivity');

            const url = this.paths.getBucketUrl(this.bucket) +
                       `?prefix=${encodeURIComponent(this.paths.addVaultPrefix(''))}`;

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                this.log(LogLevel.Trace, 'GCP connectivity test successful');
                return {
                    success: true,
                    message: "Successfully connected to GCP Storage"
                };
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            this.log(LogLevel.Error, 'GCP connectivity test failed', error);
            return {
                success: false,
                message: `GCP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }
}
