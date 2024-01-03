import { Storage } from '@google-cloud/storage';
import { File } from '../classes/Synchronize';
import { FileManager } from './AbstractFileManager';

export class GCPFileManager extends FileManager {
    private storage: Storage;
    private projectId: string;
    private keyFilename: string;
    private bucketName: string;

    constructor(projectId: string, keyFilename: string, bucketName: string) {
        super();
        this.storage = new Storage;
        this.projectId = projectId;
        this.keyFilename = keyFilename;
        this.bucketName = bucketName;
    }

    public authenticate(): Promise<void> {
        try {
            this.storage = new Storage({ projectId: this.projectId, keyFilename: this.keyFilename });
            this.isAuthenticated = true;
        } catch (error) {
            console.error('Failed to authenticate:', error);
            this.isAuthenticated = false;
        }
        return Promise.resolve();
    }
    public path(file: File): string {
        return encodeURIComponent(file.name);
    }

    async readFile(file: File): Promise<Buffer> {
        const bucket = this.storage.bucket(this.bucketName);
        const [data] = await bucket.file(file.remoteName).download();
        return data;
    }

    public async writeFile(file: File, content: Buffer): Promise<void> {
        const bucket = this.storage.bucket(this.bucketName);
        await bucket.file(file.remoteName).save(content, {
            contentType: file.mime,
            metadata: {
                originalLastModified: file.lastModified.toISOString()
            }
        });
    }

    public async deleteFile(file: File): Promise<void> {
        const bucket = this.storage.bucket(this.bucketName);
        await bucket.file(file.remoteName).delete();
    }

    public async getFiles(): Promise<File[]> {
        const bucket = this.storage.bucket(this.bucketName);
        const [files] = await bucket.getFiles();
        return Promise.all(files.map(async file => {
            const [metadata] = await file.getMetadata();
            const md5Hash = metadata.md5Hash ? Buffer.from(metadata.md5Hash, 'base64').toString('hex') : '';
            return {
                name: decodeURIComponent(file.name),
                localName: '',
                remoteName: file.name,
                mime: metadata.contentType || '',
                lastModified: metadata.updated ? new Date(metadata.updated) : new Date(),
                size: metadata.size ? Number(metadata.size) : 0,
                md5: md5Hash,
                isDirectory: false
            };
        }));
    }
}