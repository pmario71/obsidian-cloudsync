import { S3 } from 'aws-sdk';

import { File } from '../classes/Synchronize';
import { FileManager } from './FileManager';

export class S3FileManager extends FileManager {
    private s3: S3;
    private bucketName: string;

    constructor(accessKeyId: string, secretAccessKey: string, bucketName: string) {
        super();
        this.s3 = new S3({
            accessKeyId,
            secretAccessKey
        });
        this.bucketName = bucketName;
    }

    // Implement the abstract method from the base class
    public authenticate(credentials: any): void {
        // Implement authentication logic here
    }

    public path(file: File): string {
        return encodeURIComponent(file.name);
    }

    async readFile(file: File): Promise<Buffer> {
        const params = {
            Bucket: this.bucketName,
            Key: file.remoteName
        };

        const data = await this.s3.getObject(params).promise();
        return data.Body as Buffer;
    }

    public async writeFile(file: File, content: Buffer): Promise<void> {
        const params = {
            Bucket: this.bucketName,
            Key: file.remoteName,
            Body: content,
            ContentType: file.mime,
            Metadata: {
                originalLastModified: file.lastModified.toISOString()
            }
        };

        await this.s3.putObject(params).promise();
    }

    public async deleteFile(file: File): Promise<void> {
        const params = {
            Bucket: this.bucketName,
            Key: file.remoteName
        };

        await this.s3.deleteObject(params).promise();
    }

    public async getFiles(): Promise<File[]> {
        const params = {
            Bucket: this.bucketName
        };

        const data = await this.s3.listObjectsV2(params).promise();
        const files: File[] = data.Contents?.map(file => ({
            name: decodeURIComponent(file.Key!),
            localName: '',
            remoteName: file.Key!,
            mime: '',
            lastModified: file.LastModified!,
            size: file.Size!,
            md5: file.ETag!,
            isDirectory: false
        })) || [];

        return files;
    }

}