import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { CloudPathHandler } from "../sync/CloudPathHandler";
import { App, normalizePath, requestUrl, RequestUrlParam } from "obsidian";
import { CacheManagerService } from "../sync/utils/cacheUtils";

export class GCPAuth {
    private accessToken = '';
    private tokenExpiry = 0;

    constructor(
        private readonly bucket: string,
        private readonly paths: CloudPathHandler,
        private readonly app: App
    ) {}

    processPrivateKey(pemString: string): string {
        LogManager.log(LogLevel.Debug, 'Processing private key...');

        try {
            // First try to parse as JSON in case it's a service account key file
            const parsed = JSON.parse(pemString);
            if (parsed.private_key) {
                pemString = parsed.private_key;
                LogManager.log(LogLevel.Debug, 'Extracted private key from JSON');
            }
        } catch (e) {
            LogManager.log(LogLevel.Debug, 'Key is not in JSON format, treating as raw PEM');
        }

        // Remove any JSON-escaped newlines and extra whitespace
        let cleaned = pemString
            .replace(/\\\\n/g, '') // Remove double-escaped newlines
            .replace(/\\n/g, '')   // Remove JSON escaped newlines
            .replace(/\n/g, '')    // Remove actual newlines
            .replace(/\s+/g, '');  // Remove all whitespace

        LogManager.log(LogLevel.Debug, 'Key after cleaning:', { key: `${cleaned.substring(0, 100)}...` });

        // Extract content between header and footer
        const regex = /-----BEGIN[^-]+-----([^-]+)-----END[^-]+-----/;
        const matches = regex.exec(cleaned);
        if (!matches) {
            LogManager.log(LogLevel.Error, 'Invalid PEM format: Missing header/footer');
            throw new Error('Private key must contain valid PEM header and footer');
        }

        const content = matches[1];
        LogManager.log(LogLevel.Debug, 'Extracted content length:', { length: content.length });

        // Validate Base64 content
        if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
            LogManager.log(LogLevel.Error, 'Invalid base64 content');
            throw new Error('Private key contains invalid base64 content');
        }

        try {
            // Additional Base64 validation by attempting to decode
            atob(content);
        } catch (e) {
            LogManager.log(LogLevel.Error, 'Failed to decode Base64 content');
            throw new Error('Private key contains invalid base64 content');
        }

        // Format content into 64-character lines
        const lines = content.match(/.{1,64}/g) || [];
        const formattedKey = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;

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
            await this.getAccessToken(jwt);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to initialize GCP auth', error);
            throw error;
        }
    }

    private async getAccessToken(jwt: string): Promise<void> {
        LogManager.log(LogLevel.Debug, 'Getting access token');

        try {
            const requestOptions: RequestUrlParam = {
                url: 'https://oauth2.googleapis.com/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwt
                }).toString()
            };

            const response = await requestUrl(requestOptions);
            const responseText = response.text;
            LogManager.log(LogLevel.Debug, 'Token response received', {
                status: response.status
            });

            if (response.status !== 200) {
                LogManager.log(LogLevel.Error, 'Failed to get token', {
                    status: response.status,
                    response: responseText
                });
                throw new Error(`Failed to get access token: ${response.status} - ${responseText}`);
            }

            const data = JSON.parse(responseText);
            if (!data.access_token) {
                LogManager.log(LogLevel.Error, 'No access token in response', { data });
                throw new Error('No access token in response');
            }

            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);
            LogManager.log(LogLevel.Debug, 'Access token retreived successfully', {
                expiresIn: data.expires_in,
                expiry: new Date(this.tokenExpiry).toISOString()
            });
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Error getting access token', { error });
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

            const url = this.paths.getContainerUrl(this.bucket) +
                `?prefix=${encodeURIComponent(this.paths.addVaultPrefix(''))}&alt=json`;

            LogManager.log(LogLevel.Debug, 'Making GCP request', {
                url,
                hasToken: !!this.accessToken,
                tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'none'
            });

            const requestOptions: RequestUrlParam = {
                url,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'  // Request JSON response
                }
            };

            const response = await requestUrl(requestOptions);

            if (response.status >= 200 && response.status < 300) {
                // Check if prefix is empty
                const responseText = response.text;
                let hasItems = false;

                try {
                    // Try parsing as JSON first
                    const responseData = JSON.parse(responseText);
                    hasItems = responseData.items && responseData.items.length > 0;
                } catch (e) {
                    // If JSON parsing fails, try XML
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(responseText, "text/xml");
                    const contents = xmlDoc.getElementsByTagName('Contents');
                    hasItems = contents.length > 0;
                }

                if (!hasItems) {
                    LogManager.log(LogLevel.Debug, 'New GCP prefix detected, invalidating cache');
                    const cacheService = CacheManagerService.getInstance();
                    const cachePath = normalizePath(`${this.app.vault.configDir}/plugins/cloudsync/cloudsync-gcp.json`);
                    await cacheService.invalidateCache(cachePath);
                    LogManager.log(LogLevel.Debug, 'GCP cache invalidated for new prefix');
                }

                LogManager.log(LogLevel.Trace, 'GCP connectivity test successful');
                return {
                    success: true,
                    message: "Successfully connected to GCP Storage"
                };
            }

            const responseText = response.text;
            LogManager.log(LogLevel.Error, 'GCP request failed', {
                status: response.status,
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
