import { requestUrl, App, normalizePath } from "obsidian";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { AWSSigning } from "./signing";
import { withRetry } from "../sync/utils/commonUtils";
import { CacheManagerService } from "../sync/utils/cacheUtils";

interface ErrorResponse {
    code: string;
    message: string;
}

interface AWSRequestConfig {
    method: string;
    path: string;
    queryParams: Record<string, string>;
    host: string;
    amzdate: string;
}

export class AWSAuth {
    private static readonly DEFAULT_REGION = 'us-east-1';
    private static readonly MAX_RETRIES = 3;

    constructor(
        private readonly bucket: string,
        private readonly endpoint: string,
        private readonly signing: AWSSigning,
        private readonly vaultPrefix: string,
        private readonly app: App
    ) {}

    private parseXMLError(xmlText: string): ErrorResponse | null {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const errorElement = xmlDoc.getElementsByTagName('Error')[0];

        if (!errorElement) {
            return null;
        }

        return {
            code: errorElement.getElementsByTagName('Code')[0]?.textContent ?? 'UnknownError',
            message: errorElement.getElementsByTagName('Message')[0]?.textContent ?? 'Unknown error occurred'
        };
    }

    private formatErrorMessage(error: ErrorResponse | null, status: number): string {
        if (error) {
            return `${error.code}: ${error.message}`;
        }
        return `HTTP error! status: ${status}`;
    }

    private async makeSignedRequest(config: AWSRequestConfig) {
        const requestHeaders = this.signing.signRequest(config);
        const queryString = new URLSearchParams(config.queryParams).toString();
        const url = queryString ?
            `${this.endpoint}/${this.bucket}?${queryString}` :
            `${this.endpoint}/${this.bucket}`;

        LogManager.log(LogLevel.Debug, 'Making signed request', {
            url,
            method: config.method,
            headers: requestHeaders
        });

        return await requestUrl({
            url,
            method: config.method,
            headers: requestHeaders
        });
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: unknown }> {
        return withRetry(async () => {
            try {
                LogManager.log(LogLevel.Debug, 'S3 Connection Test - Starting');

                const response = await this.makeSignedRequest({
                    method: 'GET',
                    path: `/${this.bucket}`,
                    queryParams: {
                        'list-type': '2',
                        'max-keys': '1',
                        'prefix': `${this.vaultPrefix}/`
                    },
                    host: new URL(this.endpoint).host,
                    amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
                });

                if (response.status !== 200) {
                    const error = this.parseXMLError(response.text);
                    throw new Error(this.formatErrorMessage(error, response.status));
                }

                // Check if prefix is empty (no files)
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(response.text, "text/xml");
                const hasContents = xmlDoc.getElementsByTagName('Contents').length > 0;

                if (!hasContents) {
                    LogManager.log(LogLevel.Debug, 'New S3 prefix detected, invalidating cache');
                    const cacheService = CacheManagerService.getInstance();
                    const cachePath = normalizePath(`${this.app.vault.configDir}/plugins/cloudsync/cloudsync-aws.json`);
                    await cacheService.invalidateCache(cachePath);
                    LogManager.log(LogLevel.Debug, 'S3 cache invalidated for new prefix');
                }

                LogManager.log(LogLevel.Debug, 'S3 Connection Test - Success');
                return {
                    success: true,
                    message: "Successfully connected to S3"
                };
            } catch (error) {
                LogManager.log(LogLevel.Error, 'S3 Connection Test - Failed', error);
                return {
                    success: false,
                    message: `S3 connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                    details: error
                };
            }
        }, { maxAttempts: AWSAuth.MAX_RETRIES });
    }

    async discoverRegion(): Promise<string> {
        return withRetry(async () => {
            try {
                const endpoint = `https://s3.${AWSAuth.DEFAULT_REGION}.amazonaws.com`;
                LogManager.log(LogLevel.Debug, 'Discovering bucket region', { bucket: this.bucket });

                const response = await this.makeSignedRequest({
                    method: 'GET',
                    path: `/${this.bucket}`,
                    queryParams: {},
                    host: new URL(endpoint).host,
                    amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
                });

                return this.extractRegionFromResponse(response);
            } catch (error) {
                LogManager.log(LogLevel.Error, 'Error discovering bucket region', error);
                throw new Error(`Failed to discover bucket region: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }, { maxAttempts: AWSAuth.MAX_RETRIES });
    }

    private extractRegionFromResponse(response: { status: number; text: string; headers: Record<string, string> }): string {
        // Check header first
        const regionHeader = response.headers['x-amz-bucket-region'];
        if (regionHeader) {
            LogManager.log(LogLevel.Debug, 'Found bucket region from header', { region: regionHeader });
            return regionHeader;
        }

        // Check redirect response
        if (response.status === 301) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response.text, "text/xml");
            const endpointElement = xmlDoc.getElementsByTagName('Endpoint')[0];

            if (endpointElement?.textContent) {
                const regex = /s3[.-]([^.]+)\.amazonaws\.com/;
                const match = regex.exec(endpointElement.textContent);
                if (match) {
                    const region = match[1];
                    LogManager.log(LogLevel.Debug, 'Found bucket region from redirect', { region });
                    return region;
                }
            }
        }

        // Check for errors
        if (response.status !== 200) {
            const error = this.parseXMLError(response.text);
            throw new Error(this.formatErrorMessage(error, response.status));
        }

        // Default region if no other information found
        LogManager.log(LogLevel.Debug, `No region found, defaulting to ${AWSAuth.DEFAULT_REGION}`);
        return AWSAuth.DEFAULT_REGION;
    }
}
