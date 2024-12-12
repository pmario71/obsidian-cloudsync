import { AbstractManager, File } from "../sync/AbstractManager";
import { CloudSyncSettings, LogLevel } from "../sync/types";
import { LogManager } from "../LogManager";
import { AWSAuth } from "./auth";
import { AWSSigning } from "./signing";
import { AWSFiles } from "./files";
import { AWSPaths } from "./paths";

export class AWSManager extends AbstractManager {
    public readonly name: string = 'AWS';

    private bucket = '';
    private region = '';
    private accessKey = '';
    private secretKey = '';
    private endpoint = '';
    private auth: AWSAuth;
    private signing: AWSSigning;
    private fileOps: AWSFiles;
    private readonly paths: AWSPaths;
    private readonly vaultPrefix: string;

    constructor(settings: CloudSyncSettings, vaultPrefix: string) {
        super(settings);
        this.vaultPrefix = vaultPrefix;
        this.paths = new AWSPaths(this.vaultPrefix);
        LogManager.log(LogLevel.Debug, 'AWS manager initialized', {
            vault: this.vaultPrefix
        });
    }

    private validateSettings(): void {
        LogManager.log(LogLevel.Debug, 'Validating AWS configuration');
        if (!this.settings.aws.accessKey || this.settings.aws.accessKey.trim() === '') {
            throw new Error('AWS access key is required');
        }
        if (!this.settings.aws.secretKey || this.settings.aws.secretKey.trim() === '') {
            throw new Error('AWS secret key is required');
        }
        if (!this.settings.aws.bucket || this.settings.aws.bucket.trim() === '') {
            throw new Error('AWS bucket name is required');
        }
        LogManager.log(LogLevel.Debug, 'AWS configuration validated');
    }

    private async initializeClient(skipRegionDiscovery = false): Promise<void> {
        LogManager.log(LogLevel.Debug, 'Initializing AWS client');

        this.bucket = this.settings.aws.bucket.trim();
        this.accessKey = this.settings.aws.accessKey.trim();
        this.secretKey = this.settings.aws.secretKey.trim();
        this.region = this.settings.aws.region || 'us-east-1';
        this.signing = new AWSSigning(this.accessKey, this.secretKey, this.region);

        const endpoint = `https://s3.${this.region}.amazonaws.com`;
        this.auth = new AWSAuth(this.bucket, endpoint, this.signing, this.vaultPrefix);

        if (!skipRegionDiscovery && !this.settings.aws.region) {
            LogManager.log(LogLevel.Debug, 'Discovering bucket region');
            this.region = await this.auth.discoverRegion();
            this.endpoint = `https://s3.${this.region}.amazonaws.com`;
            this.signing = new AWSSigning(this.accessKey, this.secretKey, this.region);
            this.auth = new AWSAuth(this.bucket, this.endpoint, this.signing, this.vaultPrefix);
            LogManager.log(LogLevel.Debug, `Region discovered: ${this.region}`);
        } else {
            this.endpoint = endpoint;
        }

        this.fileOps = new AWSFiles(this.bucket, this.endpoint, this.signing, this.paths);

        LogManager.log(LogLevel.Debug, 'AWS client configuration', {
            region: this.region,
            bucket: this.bucket,
            endpoint: this.endpoint
        });
    }

    async authenticate(): Promise<void> {
        try {
            LogManager.log(LogLevel.Trace, 'Authenticating with AWS');
            this.validateSettings();
            await this.initializeClient();

            const result = await this.auth.testConnectivity();
            if (!result.success) {
                throw new Error(result.message);
            }

            LogManager.log(LogLevel.Trace, 'AWS authentication successful');
        } catch (error) {
            LogManager.log(LogLevel.Error, 'AWS authentication failed', error);
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: unknown }> {
        try {
            LogManager.log(LogLevel.Trace, 'Testing AWS connectivity');
            this.validateSettings();
            await this.initializeClient();

            const result = await this.auth.testConnectivity();
            if (result.success) {
                LogManager.log(LogLevel.Debug, 'AWS connectivity test successful');
            } else {
                LogManager.log(LogLevel.Debug, 'AWS connectivity test failed', result);
            }
            return result;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'AWS connectivity test failed', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Unknown error",
                details: error
            };
        }
    }

    async discoverRegion(): Promise<string> {
        try {
            LogManager.log(LogLevel.Trace, 'Discovering bucket region');
            this.validateSettings();
            await this.initializeClient(true);

            const region = await this.auth.discoverRegion();
            this.region = region;
            this.endpoint = `https://s3.${region}.amazonaws.com`;
            this.signing = new AWSSigning(this.accessKey, this.secretKey, this.region);
            this.auth = new AWSAuth(this.bucket, this.endpoint, this.signing, this.vaultPrefix);
            this.fileOps = new AWSFiles(this.bucket, this.endpoint, this.signing, this.paths);

            LogManager.log(LogLevel.Debug, `Bucket region discovered: ${region}`);
            return region;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to discover bucket region', error);
            throw error;
        }
    }

    readFile(file: File): Promise<Buffer> {
        LogManager.log(LogLevel.Debug, `Reading file from S3: ${file.name}`);
        return this.fileOps.readFile(file);
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        LogManager.log(LogLevel.Debug, `Writing file to S3: ${file.name} (${content.length} bytes)`);
        await this.fileOps.writeFile(file, content);
    }

    async deleteFile(file: File): Promise<void> {
        LogManager.log(LogLevel.Debug, `Deleting file from S3: ${file.name}`);
        await this.fileOps.deleteFile(file);
    }

    async getFiles(): Promise<File[]> {
        LogManager.log(LogLevel.Trace, 'Listing files in S3 bucket');
        const files = await this.fileOps.getFiles(this.vaultPrefix);
        this.files = files;
        LogManager.log(LogLevel.Debug, `Found ${files.length} files in S3 bucket`);
        return files;
    }
}
