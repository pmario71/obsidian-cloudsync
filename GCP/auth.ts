import { GoogleAuth } from "google-auth-library";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { GCPPaths } from "./paths";

export class GCPAuth {
    private auth: GoogleAuth | null = null;
    private accessToken = '';

    constructor(
        private readonly bucket: string,
        private readonly paths: GCPPaths
    ) {}

    processPrivateKey(key: string): string {
        LogManager.log(LogLevel.Debug, 'Processing private key...');

        try {
            const parsed = JSON.parse(key);
            if (parsed.private_key) {
                key = parsed.private_key;
                LogManager.log(LogLevel.Debug, 'Extracted private key from JSON');
            }
        } catch (e) {
            LogManager.log(LogLevel.Debug, 'Key is not in JSON format, treating as raw PEM');
        }

        key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
        LogManager.log(LogLevel.Debug, 'Key after newline processing:', { key: `${key.substring(0, 100)}...` });

        const header = '-----BEGIN PRIVATE KEY-----';
        const footer = '-----END PRIVATE KEY-----';
        const startIndex = key.indexOf(header);
        const endIndex = key.indexOf(footer);

        if (startIndex === -1 || endIndex === -1) {
            LogManager.log(LogLevel.Error, 'Invalid PEM format:', {
                hasHeader: startIndex !== -1,
                hasFooter: endIndex !== -1
            });
            throw new Error('Private key must contain valid PEM header and footer');
        }

        const contentStartIndex = startIndex + header.length;
        let content = key.substring(contentStartIndex, endIndex).trim();
        LogManager.log(LogLevel.Debug, 'Extracted content length:', { length: content.length });

        content = content.replace(/[\s\r\n]/g, '');
        LogManager.log(LogLevel.Debug, 'Content after whitespace removal length:', { length: content.length });

        if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
            LogManager.log(LogLevel.Error, 'Invalid base64 content');
            throw new Error('Private key contains invalid base64 content');
        }

        const lines = content.match(/.{1,64}/g) || [];
        const formattedKey = `${header}\n${lines.join('\n')}\n${footer}`;

        LogManager.log(LogLevel.Debug, 'Private key processed successfully');
        return formattedKey;
    }

    async initialize(clientEmail: string, privateKey: string): Promise<void> {
        const authConfig = {
            credentials: {
                client_email: clientEmail,
                private_key: this.processPrivateKey(privateKey)
            },
            scopes: ['https://www.googleapis.com/auth/devstorage.full_control']
        };

        this.auth = new GoogleAuth(authConfig);
        await this.getAccessToken(); // Initial token fetch
    }

    async getAccessToken(): Promise<string> {
        if (!this.auth) {
            throw new Error('GCP Auth not initialized');
        }

        try {
            LogManager.log(LogLevel.Debug, 'Fetching GCP access token');
            const client = await this.auth.getClient();
            const token = await client.getAccessToken();

            if (!token.token) {
                throw new Error('Failed to obtain access token');
            }

            this.accessToken = token.token;
            LogManager.log(LogLevel.Debug, 'Access token obtained successfully');
            return this.accessToken;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to get access token', error);
            this.accessToken = '';
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            LogManager.log(LogLevel.Debug, 'Testing GCP connectivity');

            const url = this.paths.getBucketUrl(this.bucket) +
                `?prefix=${encodeURIComponent(this.paths.addVaultPrefix(''))}`;

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                LogManager.log(LogLevel.Trace, 'GCP connectivity test successful');
                return {
                    success: true,
                    message: "Successfully connected to GCP Storage"
                };
            }

            throw new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'GCP connectivity test failed', error);
            return {
                success: false,
                message: `GCP connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                details: error
            };
        }
    }
}
