import { AbstractManager, File, ScanState } from '../AbstractManager';
import { CloudSyncSettings, LogLevel } from '../types';
import { AWSPaths } from './paths';
import { AWSSigning } from './signing';
import { AWSFiles } from './files';
import { AWSAuth } from './auth';
import { LogManager } from '../LogManager';
import { AWSTestResult } from './types';

export class AWSManager extends AbstractManager {
    private bucket: string = '';
    private region: string = '';
    private accessKey: string = '';
    private secretKey: string = '';
    private endpoint: string = '';
    private readonly vaultPrefix: string;

    private paths: AWSPaths;
    private signing: AWSSigning;
    private fileOps: AWSFiles;
    private auth: AWSAuth;

    constructor(settings: CloudSyncSettings, vaultName: string) {
        super(settings);
        this.vaultPrefix = vaultName;
        this.paths = new AWSPaths(this.vaultPrefix);
        this.log(LogLevel.Debug, `AWSManager initialized with vault prefix: ${this.vaultPrefix}`);
    }

    public getProviderName(): string {
        return 'aws';
    }

    private validateSettings(): void {
        this.log(LogLevel.Debug, 'AWS Validate Settings - Starting');
        if (!this.settings.aws.accessKey || this.settings.aws.accessKey.trim() === '') {
            throw new Error('AWS access key is required');
        }
        if (!this.settings.aws.secretKey || this.settings.aws.secretKey.trim() === '') {
            throw new Error('AWS secret key is required');
        }
        if (!this.settings.aws.bucket || this.settings.aws.bucket.trim() === '') {
            throw new Error('AWS bucket name is required');
        }
        this.log(LogLevel.Debug, 'AWS Validate Settings - Success');
    }

    private async initializeClient(skipRegionDiscovery: boolean = false): Promise<void> {
        // Initialize core properties
        this.bucket = this.settings.aws.bucket.trim();
        this.accessKey = this.settings.aws.accessKey.trim();
        this.secretKey = this.settings.aws.secretKey.trim();

        // Initialize signing utility with default or stored region
        this.region = this.settings.aws.region || 'us-east-1';
        this.signing = new AWSSigning(this.accessKey, this.secretKey, this.region);

        // Initialize auth module
        const endpoint = `https://s3.${this.region}.amazonaws.com`;
        this.auth = new AWSAuth(this.bucket, endpoint, this.signing, this.vaultPrefix);

        // Discover region if needed
        if (!skipRegionDiscovery && !this.settings.aws.region) {
            this.region = await this.auth.discoverRegion();
            this.endpoint = `https://s3.${this.region}.amazonaws.com`;

            // Reinitialize modules with discovered region
            this.signing = new AWSSigning(this.accessKey, this.secretKey, this.region);
            this.auth = new AWSAuth(this.bucket, this.endpoint, this.signing, this.vaultPrefix);
        } else {
            this.endpoint = endpoint;
        }

        this.fileOps = new AWSFiles(this.bucket, this.endpoint, this.signing, this.paths);

        this.log(LogLevel.Debug, 'AWS Client Initialized', {
            region: this.region,
            bucket: this.bucket,
            endpoint: this.endpoint,
            accessKeyLength: this.accessKey.length
        });
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Debug, 'AWS Authentication - Starting');
            this.validateSettings();
            await this.initializeClient();

            const testResult = await this.auth.testConnectivity();
            if (!testResult.success) {
                throw new Error(testResult.message);
            }

            this.state = ScanState.Ready;
            this.log(LogLevel.Trace, 'AWS Authentication - Success');
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Authentication - Failed', error);
            this.state = ScanState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<AWSTestResult> {
        try {
            this.validateSettings();
            await this.initializeClient();
            return await this.auth.testConnectivity();
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error
            };
        }
    }

    async discoverRegion(): Promise<string> {
        try {
            this.validateSettings();
            // Initialize client without region discovery to prevent circular dependency
            await this.initializeClient(true);
            // Use auth module to discover region
            const region = await this.auth.discoverRegion();
            // Update manager state with discovered region
            this.region = region;
            this.endpoint = `https://s3.${region}.amazonaws.com`;
            // Reinitialize with correct region
            this.signing = new AWSSigning(this.accessKey, this.secretKey, this.region);
            this.auth = new AWSAuth(this.bucket, this.endpoint, this.signing, this.vaultPrefix);
            this.fileOps = new AWSFiles(this.bucket, this.endpoint, this.signing, this.paths);
            return region;
        } catch (error) {
            this.log(LogLevel.Error, 'Region discovery failed', error);
            throw error;
        }
    }

    async readFile(file: File): Promise<Buffer> {
        return this.fileOps.readFile(file);
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        await this.fileOps.writeFile(file, content);
    }

    async deleteFile(file: File): Promise<void> {
        await this.fileOps.deleteFile(file);
    }

    async getFiles(): Promise<File[]> {
        const files = await this.fileOps.getFiles(this.vaultPrefix);
        this.files = files;
        return files;
    }
}
