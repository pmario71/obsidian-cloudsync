import { LogLevel } from '../types';
import { LogManager } from '../LogManager';
import { requestUrl } from 'obsidian';
import { AWSSigning } from './signing';
import { AWSTestResult } from './types';
import * as xml2js from 'xml2js';

export class AWSAuth {
    constructor(
        private bucket: string,
        private endpoint: string,
        private signing: AWSSigning,
        private vaultPrefix: string
    ) {}

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    async testConnectivity(): Promise<AWSTestResult> {
        try {
            this.log(LogLevel.Debug, 'AWS Connection Test - Starting');

            const queryParams = {
                'list-type': '2',
                'max-keys': '1',
                'prefix': this.vaultPrefix + '/'
            };

            const headers = await this.signing.signRequest({
                method: 'GET',
                path: `/${this.bucket}`,
                queryParams,
                host: new URL(this.endpoint).host,
                amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
            });

            const queryString = Object.entries(queryParams)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');

            const url = `${this.endpoint}/${this.bucket}?${queryString}`;

            this.log(LogLevel.Debug, 'Test request details', {
                endpoint: this.endpoint,
                bucket: this.bucket,
                queryString,
                url,
                headers
            });

            const response = await requestUrl({
                url,
                method: 'GET',
                headers
            });

            this.log(LogLevel.Debug, 'Test response received', {
                status: response.status,
                headers: response.headers
            });

            if (response.status !== 200) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorXml = await xml2js.parseStringPromise(response.text);
                    if (errorXml.Error) {
                        const code = errorXml.Error.Code?.[0];
                        const message = errorXml.Error.Message?.[0];
                        errorMessage = `${code}: ${message}`;
                    }
                } catch (e) {
                    this.log(LogLevel.Debug, 'Error parsing response', e);
                }
                throw new Error(errorMessage);
            }

            this.log(LogLevel.Debug, 'AWS Connection Test - Success');
            return {
                success: true,
                message: 'Successfully connected to AWS S3'
            };
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Connection Test - Failed', error);
            return {
                success: false,
                message: `AWS connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }

    async discoverRegion(): Promise<string> {
        try {
            // Initialize with us-east-1 for discovery
            const discoveryEndpoint = 'https://s3.us-east-1.amazonaws.com';

            this.log(LogLevel.Debug, 'Discovering bucket region', {
                bucket: this.bucket,
                endpoint: discoveryEndpoint
            });

            const headers = await this.signing.signRequest({
                method: 'GET',
                path: `/${this.bucket}`,
                queryParams: {},
                host: new URL(discoveryEndpoint).host,
                amzdate: new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
            });

            const response = await requestUrl({
                url: `${discoveryEndpoint}/${this.bucket}`,
                method: 'GET',
                headers
            });

            // Check for region in response headers
            const regionHeader = response.headers['x-amz-bucket-region'];
            if (regionHeader) {
                this.log(LogLevel.Debug, 'Found bucket region from header', {
                    region: regionHeader
                });
                return regionHeader;
            }

            // Check for 301 redirect
            if (response.status === 301) {
                try {
                    const errorXml = await xml2js.parseStringPromise(response.text);
                    if (errorXml.Error?.Endpoint) {
                        const endpoint = errorXml.Error.Endpoint[0];
                        const match = endpoint.match(/s3[.-]([^.]+)\.amazonaws\.com/);
                        if (match) {
                            const region = match[1];
                            this.log(LogLevel.Debug, 'Found bucket region from redirect', {
                                region
                            });
                            return region;
                        }
                    }
                } catch (e) {
                    this.log(LogLevel.Debug, 'Error parsing redirect response', e);
                }
            }

            // If we get here and status is not 200, parse error
            if (response.status !== 200) {
                try {
                    const errorXml = await xml2js.parseStringPromise(response.text);
                    if (errorXml.Error) {
                        const code = errorXml.Error.Code?.[0];
                        const message = errorXml.Error.Message?.[0];
                        throw new Error(`${code}: ${message}`);
                    }
                } catch (e) {
                    if (e.message.includes(':')) {
                        throw e;
                    }
                    throw new Error(`Request failed, status ${response.status}`);
                }
            }

            // Default to us-east-1 if no region found
            this.log(LogLevel.Debug, 'No region found, defaulting to us-east-1');
            return 'us-east-1';
        } catch (error) {
            this.log(LogLevel.Error, 'Error discovering bucket region', error);
            throw new Error(`Failed to discover bucket region: ${error.message}`);
        }
    }
}
