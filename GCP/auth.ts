import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { GCPPaths } from "./paths";

export class GCPAuth {
    private accessToken = '';
    private tokenExpiry = 0;

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

    private async createJWT(clientEmail: string, privateKey: string): Promise<string> {
        LogManager.log(LogLevel.Debug, 'Creating JWT', { clientEmail });

        try {
            const now = Math.floor(Date.now() / 1000);
            const oneHour = 3600;
            const exp = now + oneHour;

            const header = {
                alg: 'RS256',
                typ: 'JWT'
            };

            const claim = {
                iss: clientEmail,
                scope: 'https://www.googleapis.com/auth/devstorage.full_control',
                aud: 'https://oauth2.googleapis.com/token',
                exp: exp,
                iat: now
            };

            LogManager.log(LogLevel.Debug, 'JWT claims prepared', {
                exp: new Date(exp * 1000).toISOString(),
                iat: new Date(now * 1000).toISOString()
            });

            const base64Header = btoa(JSON.stringify(header));
            const base64Claim = btoa(JSON.stringify(claim));
            const signatureInput = `${base64Header}.${base64Claim}`;

            LogManager.log(LogLevel.Debug, 'Importing private key');
            const encoder = new TextEncoder();
            const keyData = this.pemToArrayBuffer(privateKey);
            const cryptoKey = await window.crypto.subtle.importKey(
                'pkcs8',
                keyData,
                {
                    name: 'RSASSA-PKCS1-v1_5',
                    hash: 'SHA-256'
                },
                false,
                ['sign']
            );
            LogManager.log(LogLevel.Debug, 'Private key imported successfully');

            LogManager.log(LogLevel.Debug, 'Signing JWT');
            const signature = await window.crypto.subtle.sign(
                'RSASSA-PKCS1-v1_5',
                cryptoKey,
                encoder.encode(signatureInput)
            );

            const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
            const jwt = `${signatureInput}.${base64Signature}`;
            LogManager.log(LogLevel.Debug, 'JWT created successfully');

            return jwt;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to create JWT', { error });
            throw error;
        }
    }

    private pemToArrayBuffer(pem: string): ArrayBuffer {
        const base64 = pem
            .replace('-----BEGIN PRIVATE KEY-----', '')
            .replace('-----END PRIVATE KEY-----', '')
            .replace(/\s/g, '');
        const binary = atob(base64);
        const buffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
        }
        return buffer;
    }

    async initialize(clientEmail: string, privateKey: string): Promise<void> {
        try {
            const jwt = await this.createJWT(clientEmail, this.processPrivateKey(privateKey));
            await this.fetchAccessToken(jwt);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to initialize GCP auth', error);
            throw error;
        }
    }

    private async fetchAccessToken(jwt: string): Promise<void> {
        LogManager.log(LogLevel.Debug, 'Fetching access token');

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt
                })
            });

            const responseText = await response.text();
            LogManager.log(LogLevel.Debug, 'Token response received', {
                status: response.status,
                statusText: response.statusText
            });

            if (!response.ok) {
                LogManager.log(LogLevel.Error, 'Failed to fetch token', {
                    status: response.status,
                    response: responseText
                });
                throw new Error(`Failed to fetch access token: ${response.status} - ${responseText}`);
            }

            const data = JSON.parse(responseText);
            if (!data.access_token) {
                LogManager.log(LogLevel.Error, 'No access token in response', { data });
                throw new Error('No access token in response');
            }

            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);
            LogManager.log(LogLevel.Debug, 'Access token fetched successfully', {
                expiresIn: data.expires_in,
                expiry: new Date(this.tokenExpiry).toISOString()
            });
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Error fetching access token', { error });
            throw error;
        }
    }

    async getHeaders(): Promise<Record<string, string>> {
        if (!this.accessToken || Date.now() >= this.tokenExpiry - 300000) {
            throw new Error('Access token expired or not initialized');
        }
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/octet-stream'
        };
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            LogManager.log(LogLevel.Debug, 'Testing GCP connectivity');

            if (!this.accessToken) {
                LogManager.log(LogLevel.Error, 'No access token available');
                return {
                    success: false,
                    message: "No access token available"
                };
            }

            const url = this.paths.getBucketUrl(this.bucket) +
                `?prefix=${encodeURIComponent(this.paths.addVaultPrefix(''))}`;

            LogManager.log(LogLevel.Debug, 'Making GCP request', {
                url,
                hasToken: !!this.accessToken,
                tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'none'
            });

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

            const responseText = await response.text();
            LogManager.log(LogLevel.Error, 'GCP request failed', {
                status: response.status,
                statusText: response.statusText,
                responseBody: responseText
            });

            throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
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
