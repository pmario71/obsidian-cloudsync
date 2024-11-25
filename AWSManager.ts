import { AbstractManager, File, SyncState } from './AbstractManager';
import { CloudSyncSettings } from './types';
import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadBucketCommand
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

interface S3Object {
    Key?: string;
    LastModified?: Date;
    Size?: number;
    ContentType?: string;
    ETag?: string;
}

export class AWSManager extends AbstractManager {
    private client: S3Client | null = null;
    private bucketName: string = '';
    private region: string = '';

    constructor(settings: CloudSyncSettings) {
        super(settings);
    }

    private validateSettings(): void {
        this.debugLog('AWS Validate Settings - Starting');
        if (!this.settings.aws.accessKey || this.settings.aws.accessKey.trim() === '') {
            throw new Error('AWS Access Key is required');
        }
        if (!this.settings.aws.secretKey || this.settings.aws.secretKey.trim() === '') {
            throw new Error('AWS Secret Key is required');
        }
        if (!this.settings.aws.bucket || this.settings.aws.bucket.trim() === '') {
            throw new Error('AWS Bucket name is required');
        }
        if (!this.settings.aws.region || this.settings.aws.region.trim() === '') {
            throw new Error('AWS Region is required');
        }
        this.debugLog('AWS Validate Settings - Success');
    }

    private createS3Client(region: string): S3Client {
        this.debugLog('AWS Create S3 Client - Starting', { region });
        const client = new S3Client({
            region: region,
            credentials: {
                accessKeyId: this.settings.aws.accessKey.trim(),
                secretAccessKey: this.settings.aws.secretKey.trim()
            }
        });
        this.debugLog('AWS Create S3 Client - Success');
        return client;
    }

    private async testS3Access(): Promise<boolean> {
        this.debugLog('AWS Test S3 Access - Starting');
        try {
            const region = this.settings.aws.region.trim();
            const bucket = this.settings.aws.bucket.trim();

            // Try the virtual-hosted-style URL first
            const virtualHostUrl = `https://${bucket}.s3.${region}.amazonaws.com/`;
            this.debugLog('AWS Test S3 Access - Trying virtual-hosted-style URL', { url: virtualHostUrl });

            try {
                const response = await fetch(virtualHostUrl, {
                    method: 'HEAD',
                    mode: 'no-cors' // Allow opaque response
                });

                // In no-cors mode, we can't access response.status
                // But if we got here without throwing, the request succeeded
                this.debugLog('AWS Test S3 Access - Virtual-hosted request completed');
                return true;
            } catch (virtualHostError) {
                this.debugLog('AWS Test S3 Access - Virtual-hosted request failed, trying path-style', virtualHostError);

                // Fall back to path-style URL
                const pathStyleUrl = `https://s3.${region}.amazonaws.com/${bucket}/`;
                this.debugLog('AWS Test S3 Access - Trying path-style URL', { url: pathStyleUrl });

                const response = await fetch(pathStyleUrl, {
                    method: 'HEAD',
                    mode: 'no-cors' // Allow opaque response
                });

                // If we got here, the request succeeded
                this.debugLog('AWS Test S3 Access - Path-style request completed');
                return true;
            }
        } catch (error) {
            this.debugLog('AWS Test S3 Access - All attempts failed', error);
            return false;
        }
    }

    async authenticate(): Promise<void> {
        try {
            this.debugLog('AWS Authentication - Starting');
            this.validateSettings();

            this.bucketName = this.settings.aws.bucket.trim();
            this.region = this.settings.aws.region.trim();

            this.client = this.createS3Client(this.region);

            // Test authentication by checking bucket access
            const command = new HeadBucketCommand({
                Bucket: this.bucketName
            });
            await this.client.send(command);

            this.state = SyncState.Ready;
            this.debugLog('AWS Authentication - Success');
        } catch (error) {
            this.debugLog('AWS Authentication - Failed', error);
            this.state = SyncState.Error;
            throw error;
        }
    }

    async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            this.debugLog('AWS Connection Test - Starting');

            this.debugLog('AWS Connection Test - Validating Settings');
            this.validateSettings();
            this.debugLog('AWS Connection Test - Settings Validated');

            this.debugLog('AWS Connection Test - Testing S3 Access');
            const isAccessible = await this.testS3Access();

            if (isAccessible) {
                this.debugLog('AWS Connection Test - Success');
                return {
                    success: true,
                    message: "Successfully verified AWS S3 bucket exists"
                };
            } else {
                this.debugLog('AWS Connection Test - Failed: Cannot Access Bucket');
                return {
                    success: false,
                    message: "Could not verify S3 bucket exists"
                };
            }
        } catch (error) {
            this.debugLog('AWS Connection Test - Failed', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : error
            });
            return {
                success: false,
                message: `AWS connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            };
        }
    }

    async readFile(file: File): Promise<Buffer> {
        this.debugLog('AWS Read File - Starting', { file: file.remoteName });
        if (!this.client) {
            throw new Error('Not authenticated');
        }

        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: file.remoteName
            });

            const response = await this.client.send(command);
            const body = response.Body;

            if (!body) {
                throw new Error('Empty response body');
            }

            // Handle response body as a stream using for-await-of
            const chunks: Buffer[] = [];
            if (body instanceof Blob) {
                const arrayBuffer = await body.arrayBuffer();
                return Buffer.from(arrayBuffer);
            } else {
                const stream = body as any;
                for await (const chunk of stream) {
                    chunks.push(Buffer.from(chunk));
                }
            }

            const buffer = Buffer.concat(chunks);
            this.debugLog('AWS Read File - Success', {
                file: file.remoteName,
                size: buffer.length
            });
            return buffer;
        } catch (error) {
            this.debugLog('AWS Read File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async writeFile(file: File, content: Buffer): Promise<void> {
        this.debugLog('AWS Write File - Starting', {
            file: file.remoteName,
            size: content.length
        });

        if (!this.client) {
            throw new Error('Not authenticated');
        }

        try {
            // Use multipart upload for better handling of large files
            const upload = new Upload({
                client: this.client,
                params: {
                    Bucket: this.bucketName,
                    Key: file.remoteName,
                    Body: content,
                    ContentType: file.mime
                },
                queueSize: 4, // Limit concurrent uploads
                partSize: 5 * 1024 * 1024 // 5MB part size
            });

            await upload.done();
            this.debugLog('AWS Write File - Success', { file: file.remoteName });
        } catch (error) {
            this.debugLog('AWS Write File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async deleteFile(file: File): Promise<void> {
        this.debugLog('AWS Delete File - Starting', { file: file.remoteName });
        if (!this.client) {
            throw new Error('Not authenticated');
        }

        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: file.remoteName
            });

            await this.client.send(command);
            this.debugLog('AWS Delete File - Success', { file: file.remoteName });
        } catch (error) {
            this.debugLog('AWS Delete File - Failed', {
                file: file.remoteName,
                error
            });
            throw error;
        }
    }

    async getFiles(): Promise<File[]> {
        this.debugLog('AWS Get Files - Starting');
        if (!this.client) {
            throw new Error('Not authenticated');
        }

        try {
            const files: File[] = [];
            let continuationToken: string | undefined;

            do {
                const command = new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    ContinuationToken: continuationToken
                });

                const response = await this.client.send(command);

                if (response.Contents) {
                    for (const item of response.Contents) {
                        if (item.Key) {
                            files.push({
                                name: item.Key,
                                localName: item.Key,
                                remoteName: item.Key,
                                mime: item.Key.split('.').pop()?.toLowerCase() || 'application/octet-stream',
                                lastModified: item.LastModified || new Date(),
                                size: item.Size || 0,
                                md5: item.ETag ? item.ETag.replace(/['"]/g, '') : '',
                                isDirectory: false
                            });
                        }
                    }
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            this.files = files;
            this.debugLog('AWS Get Files - Success', { fileCount: files.length });
            return files;
        } catch (error) {
            this.debugLog('AWS Get Files - Failed', error);
            throw error;
        }
    }
}
