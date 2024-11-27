import { AbstractManager, File, ScanState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import {
    S3Client,
    HeadBucketCommand,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
    S3ServiceException
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { Readable } from "stream";

export class AWSManager extends AbstractManager {
    private s3Client: S3Client | null = null;
    private bucket: string = '';

    constructor(settings: CloudSyncSettings) {
        super(settings);
        this.log(LogLevel.Debug, 'AWS Manager Constructor - Complete');
    }

    public getProviderName(): string {
        return 'aws';
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        let testClient: S3Client | null = null;
        try {
            this.log(LogLevel.Debug, 'AWS Connection Test - Starting');
            this.validateSettings();

            // Create a new client instance specifically for testing
            testClient = this.createS3Client();
            const bucket = this.settings.aws.bucket.trim();

            try {
                // First try a simple HEAD request
                await testClient.send(new HeadBucketCommand({ Bucket: bucket }));
            } catch (headError) {
                // If HEAD fails, try listing objects (some policies might restrict HEAD)
                if (headError instanceof S3ServiceException) {
                    await testClient.send(new ListObjectsV2Command({
                        Bucket: bucket,
                        MaxKeys: 1
                    }));
                } else {
                    throw headError;
                }
            }

            this.log(LogLevel.Info, 'AWS Connection Test - Success');
            return {
                success: true,
                message: 'Successfully connected to AWS S3'
            };
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Connection Test - Failed', error);

            // Provide more specific error messages
            let errorMessage = 'Unknown error occurred';
            if (error instanceof S3ServiceException) {
                switch (error.$metadata.httpStatusCode) {
                    case 403:
                        errorMessage = 'Access denied. Please check your AWS credentials and bucket permissions.';
                        break;
                    case 404:
                        errorMessage = 'Bucket not found. Please check your bucket name.';
                        break;
                    case 301:
                    case 307:
                        errorMessage = 'Region mismatch. Please check your bucket region.';
                        break;
                    default:
                        errorMessage = error.message || 'Service error occurred';
                }
            } else if (error instanceof Error) {
                if (error.message.includes('ENOTFOUND')) {
                    errorMessage = 'Network error. Please check your internet connection.';
                } else if (error.message.includes('ETIMEDOUT')) {
                    errorMessage = 'Connection timed out. Please check your network.';
                } else {
                    errorMessage = error.message;
                }
            }

            return {
                success: false,
                message: `AWS connection failed: ${errorMessage}`,
                details: error
            };
        } finally {
            // Clean up the test client
            try {
                await testClient?.destroy();
            } catch (destroyError) {
                this.log(LogLevel.Debug, 'AWS Test Client Cleanup - Failed', destroyError);
            }
        }
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Debug, 'AWS Authentication - Starting');
            this.validateSettings();
            this.s3Client = this.createS3Client();
            this.state = ScanState.Ready;
            this.log(LogLevel.Trace, 'AWS Authentication - Success');
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Authentication - Failed', error);
            this.state = ScanState.Error;
            throw error;
        }
    }

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, 'AWS Read File - Starting', { file: file.remoteName });
        if (!this.s3Client) {
            throw new Error('Not authenticated');
        }

        try {
            const command = new GetObjectCommand({
                Bucket: this.settings.aws.bucket,
                Key: file.remoteName
            });
            const data = await this.s3Client.send(command);
            const body = data.Body as Readable;

            if (!body) {
                throw new Error('Empty response body');
            }

            const chunks: Buffer[] = [];
            for await (const chunk of body) {
                chunks.push(Buffer.from(chunk));
            }

            const buffer = Buffer.concat(chunks);
            this.log(LogLevel.Debug, 'AWS Read File - Success', {
                file: file.remoteName,
                size: buffer.length
            });
            return buffer;
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Read File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.log(LogLevel.Debug, 'AWS Write File - Starting', {
            file: file.remoteName,
            size: content.length
        });

        if (!this.s3Client) {
            throw new Error('Not authenticated');
        }

        try {
            const command = new PutObjectCommand({
                Bucket: this.settings.aws.bucket,
                Key: file.remoteName,
                Body: content,
                ContentType: file.mime
            });
            await this.s3Client.send(command);
            this.log(LogLevel.Debug, 'AWS Write File - Success', { file: file.remoteName });
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Write File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.log(LogLevel.Debug, 'AWS Delete File - Starting', { file: file.remoteName });
        if (!this.s3Client) {
            throw new Error('Not authenticated');
        }

        try {
            const command = new DeleteObjectCommand({
                Bucket: this.settings.aws.bucket,
                Key: file.remoteName
            });
            await this.s3Client.send(command);
            this.log(LogLevel.Debug, 'AWS Delete File - Success', { file: file.remoteName });
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Delete File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.log(LogLevel.Debug, 'AWS Get Files - Starting');
        if (!this.s3Client) {
            throw new Error('Not authenticated');
        }

        try {
            const command = new ListObjectsV2Command({
                Bucket: this.settings.aws.bucket
            });
            const data = await this.s3Client.send(command);
            const files: File[] = data.Contents?.map((item) => ({
                name: item.Key!,
                localName: item.Key!,
                remoteName: item.Key!,
                mime: 'application/octet-stream',
                lastModified: item.LastModified!,
                size: item.Size!,
                md5: item.ETag?.replace(/"/g, '') || '',
                isDirectory: false
            })) || [];

            this.files = files;
            this.log(LogLevel.Debug, 'AWS Get Files - Success', { fileCount: files.length });
            return files;
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Get Files - Failed', error);
            throw error;
        }
    }

    private validateSettings(): void {
        this.log(LogLevel.Debug, 'AWS Validate Settings - Starting');
        if (!this.settings.aws.accessKey || this.settings.aws.accessKey.trim() === '') {
            throw new Error('AWS access key is required');
        }
        if (!this.settings.aws.secretKey || this.settings.aws.secretKey.trim() === '') {
            throw new Error('AWS secret key is required');
        }
        if (!this.settings.aws.region || this.settings.aws.region.trim() === '') {
            throw new Error('AWS region is required');
        }
        if (!this.settings.aws.bucket || this.settings.aws.bucket.trim() === '') {
            throw new Error('AWS bucket name is required');
        }
        this.log(LogLevel.Debug, 'AWS Validate Settings - Success');
    }

    private createS3Client(): S3Client {
        this.log(LogLevel.Debug, 'AWS Create S3 Client - Starting');
        const s3Client = new S3Client({
            region: this.settings.aws.region,
            credentials: {
                accessKeyId: this.settings.aws.accessKey,
                secretAccessKey: this.settings.aws.secretKey,
            },
            maxAttempts: 3,
            requestHandler: {
                httpHandler: new NodeHttpHandler({
                    socketTimeout: 3000
                })
            },
            forcePathStyle: true,
        });
        this.log(LogLevel.Debug, 'AWS Create S3 Client - Success');
        return s3Client;
    }
}
