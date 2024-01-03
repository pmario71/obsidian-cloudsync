import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { Readable } from 'stream';
import { File } from '../classes/Synchronize';
import { FileManager } from './FileManager';

export class S3FileManager extends FileManager {
    private s3: S3Client;
    private accessKeyId: string
    private secretAccessKey: string
    private bucketName: string
    private region: string

    constructor(accessKeyId: string, secretAccessKey: string, bucketName: string, region: string) {
        super();
        this.accessKeyId = accessKeyId;
        this.secretAccessKey = secretAccessKey;
        this.isAuthenticated = false;
        this.bucketName = bucketName;
        this.region = region;
        this.s3 = new S3Client
        this.authenticate()

        /*
        this.s3 = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey,
            },
        });
        */

    }

    public authenticate(): void {
        try {
            this.s3 = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId: this.accessKeyId,
                    secretAccessKey: this.secretAccessKey
                }
            });
            this.isAuthenticated = true;
        } catch (error) {
            console.error('Failed to authenticate:', error);
            this.isAuthenticated = false;
        }
    }

    public path(file: File): string {
        return encodeURIComponent(file.name);
    }

    async readFile(file: File): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: file.remoteName
        });

        const data = await this.s3.send(command);

        const body = data.Body as Readable;
        if (!body) {
            throw new Error('Received unexpected data type from S3');
        }

        const bodyContents = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            body.on('data', (chunk: Buffer) => chunks.push(chunk));
            body.on('error', reject);
            body.on('end', () => resolve(Buffer.concat(chunks)));
        });

        return bodyContents;
    }

    public async writeFile(file: File, content: Buffer): Promise<void> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: file.remoteName,
            Body: content,
            ContentType: file.mime,
            Metadata: {
                originalLastModified: file.lastModified.toISOString()
            }
        });

        await this.s3.send(command);
    }

    public async deleteFile(file: File): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: file.remoteName
        });

        await this.s3.send(command);
    }

    public async getFiles(): Promise<File[]> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName
        });

        const data = await this.s3.send(command) as ListObjectsV2CommandOutput;
        const files: File[] = data.Contents?.map((file: { Key?: string, LastModified?: Date, Size?: number, ETag?: string }) => ({
            name: decodeURIComponent(file.Key!),
            localName: '',
            remoteName: file.Key!,
            mime: '',
            lastModified: file.LastModified!,
            size: file.Size!,
            md5: file.ETag!.replace(/"/g, ''),
            isDirectory: false
        })) || [];

        return files;
    }

}