import { requestUrl } from "obsidian";
import { parseStringPromise } from "xml2js";
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { AWSSigning } from "./signing";

export class AWSAuth {
    constructor(
        private readonly bucket: string,
        private readonly endpoint: string,
        private readonly signing: AWSSigning,
        private readonly vaultPrefix: string
    ) {}

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: unknown }> {
        try {
            LogManager.log(LogLevel.Debug, 'AWS Connection Test - Starting');

            const queryParams = {
                'list-type': '2',
                'max-keys': '1',
                prefix: `${this.vaultPrefix}/`
            };

            const requestHeaders = await this.signing.signRequest({
                method: 'GET',
                path: `/${this.bucket}`,
                queryParams,
                host: new URL(this.endpoint).host,
                amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
            });

            const queryString = Object.entries(queryParams)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');

            const url = `${this.endpoint}/${this.bucket}?${queryString}`;

            LogManager.log(LogLevel.Debug, 'Test request details', {
                endpoint: this.endpoint,
                bucket: this.bucket,
                queryString,
                headers: requestHeaders
            });

            const response = await requestUrl({
                url,
                method: 'GET',
                headers: requestHeaders
            });

            LogManager.log(LogLevel.Debug, 'Test response received', {
                status: response.status,
                headers: response.headers
            });

            if (response.status !== 200) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const parsed = await parseStringPromise(response.text);
                    if (parsed.Error) {
                        const code = parsed.Error.Code?.[0];
                        const message = parsed.Error.Message?.[0];
                        errorMessage = `${code}: ${message}`;
                    }
                } catch (e) {
                    LogManager.log(LogLevel.Debug, 'Error parsing response', e);
                }
                throw new Error(errorMessage);
            }

            LogManager.log(LogLevel.Debug, 'AWS Connection Test - Success');
            return {
                success: true,
                message: "Successfully connected to AWS S3"
            };
        } catch (error) {
            LogManager.log(LogLevel.Error, 'AWS Connection Test - Failed', error);
            return {
                success: false,
                message: `AWS connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                details: error
            };
        }
    }

    async discoverRegion(): Promise<string> {
        try {
            const endpoint = 'https://s3.us-east-1.amazonaws.com';
            LogManager.log(LogLevel.Debug, 'Discovering bucket region', {
                bucket: this.bucket,
                endpoint
            });

            const requestHeaders = await this.signing.signRequest({
                method: 'GET',
                path: `/${this.bucket}`,
                queryParams: {},
                host: new URL(endpoint).host,
                amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
            });

            const response = await requestUrl({
                url: `${endpoint}/${this.bucket}`,
                method: 'GET',
                headers: requestHeaders
            });

            const regionHeader = response.headers['x-amz-bucket-region'];
            if (regionHeader) {
                LogManager.log(LogLevel.Debug, 'Found bucket region from header', {
                    region: regionHeader
                });
                return regionHeader;
            }

            if (response.status === 301) {
                try {
                    const parsed = await parseStringPromise(response.text);
                    if (parsed.Error?.Endpoint) {
                        const match = parsed.Error.Endpoint[0].match(/s3[.-]([^.]+)\.amazonaws\.com/);
                        if (match) {
                            const region = match[1];
                            LogManager.log(LogLevel.Debug, 'Found bucket region from redirect', {
                                region
                            });
                            return region;
                        }
                    }
                } catch (e) {
                    LogManager.log(LogLevel.Debug, 'Error parsing redirect response', e);
                }
            }

            if (response.status !== 200) {
                try {
                    const parsed = await parseStringPromise(response.text);
                    if (parsed.Error) {
                        const code = parsed.Error.Code?.[0];
                        const message = parsed.Error.Message?.[0];
                        throw new Error(`${code}: ${message}`);
                    }
                } catch (error) {
                    if (error.message.includes(':')) {
                        throw error;
                    }
                    throw new Error(`Request failed, status ${response.status}`);
                }
            }

            LogManager.log(LogLevel.Debug, 'No region found, defaulting to us-east-1');
            return 'us-east-1';
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Error discovering bucket region', error);
            throw new Error(`Failed to discover bucket region: ${error.message}`);
        }
    }
}
