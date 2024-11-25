import { AbstractManager, File, SyncState } from './AbstractManager';
import { CloudSyncSettings, LogLevel } from './types';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadBucketCommand, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";

export class AWSManager extends AbstractManager {
    private s3Client: S3Client | null = null;
    private bucket: string = '';

    constructor(settings: CloudSyncSettings) {
        super(settings);
    }

    private validateSettings(): void {
        this.log(LogLevel.Debug, 'AWS Validate Settings - Starting');
        if (!this.settings.aws.accessKey || this.settings.aws.accessKey.trim() === '') {
            throw new Error('AWS access key ID is required');
        }
        if (!this.settings.aws.secretKey || this.settings.aws.secretKey.trim() === '') {
            throw new Error('AWS secret access key is required');
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
            maxAttempts: 3
        });
        this.log(LogLevel.Debug, 'AWS Create S3 Client - Success');
        return s3Client;
    }

    async authenticate(): Promise<void> {
        try {
            this.log(LogLevel.Debug, 'AWS Authentication - Starting');
            this.validateSettings();
            this.s3Client = this.createS3Client();
            this.bucket = this.settings.aws.bucket.trim();

            // Test authentication by calling HeadBucket
            await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
            this.state = SyncState.Ready;
            this.log(LogLevel.Trace, 'AWS Authentication - Success');
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Authentication - Failed', error);
            this.state = SyncState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.log(LogLevel.Debug, 'AWS Connection Test - Starting');
            this.validateSettings();
            const s3Client = this.createS3Client();
            const bucket = this.settings.aws.bucket.trim();

            // Test if bucket exists
            await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
            this.log(LogLevel.Info, 'AWS Connection Test - Success');
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

    async readFile(file: File): Promise<Buffer> {
        this.log(LogLevel.Debug, 'AWS Read File - Starting', { file: file.remoteName });
        if (!this.s3Client) {
            throw new Error('Not authenticated');
        }

        try {
            const command = new GetObjectCommand({ Bucket: this.bucket, Key: file.remoteName });
            const response = await this.s3Client.send(command);

            const chunks: Buffer[] = [];
            const stream = response.Body as NodeJS.ReadableStream;
            for await (const chunk of stream) {
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
                Bucket: this.bucket,
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
            const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: file.remoteName });
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
            const files: File[] = [];
            let continuationToken: string | undefined = undefined;
            do {
                const command: ListObjectsV2Command = new ListObjectsV2Command({
                    Bucket: this.bucket,
                    ContinuationToken: continuationToken
                });
                const response: ListObjectsV2CommandOutput = await this.s3Client.send(command);
                if (response.Contents) {
                    for (const object of response.Contents) {
                        if (object.Key) {
                            files.push({
                                name: object.Key,
                                localName: object.Key,
                                remoteName: object.Key,
                                mime: 'application/octet-stream', // S3 doesn't store mime type by default
                                lastModified: object.LastModified || new Date(),
                                size: object.Size || 0,
                                md5: '', // S3 doesn't provide MD5 in list response
                                isDirectory: false
                            });
                        }
                    }
                }
                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            this.files = files;
            this.log(LogLevel.Debug, 'AWS Get Files - Success', { fileCount: files.length });
            return files;
        } catch (error) {
            this.log(LogLevel.Error, 'AWS Get Files - Failed', error);
            throw error;
        }
    }
}
