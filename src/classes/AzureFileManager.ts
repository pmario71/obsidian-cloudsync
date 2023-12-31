import { BlobServiceClient, BlobItem, BlockBlobClient } from '@azure/storage-blob';
import { File } from '../classes/Synchronize';
import { FileManager } from './FileManager';

/////////////////////////////////////////////////////////////////
export class AzureFileManager extends FileManager {
    private blobServiceClient!: BlobServiceClient;
    private connectionString: string;
    private storageAccount: string;
    private containerName: string;

    constructor(azureConnectString: string, azureStorageAccount: string, azureDir: string) {
        super();
        this.isAuthenticated = false;
        this.connectionString = azureConnectString;
        this.storageAccount = azureStorageAccount;
        this.containerName = azureDir;
        this.authenticate();
    }

    public authenticate(): Promise<void> {
        try {
            this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
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
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(file.remoteName);

        const downloadResponse = await blockBlobClient.download(0);

        const streamToBuffer = async (readableStream: NodeJS.ReadableStream): Promise<Buffer> => {
            return new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];
                readableStream.on('data', (data) => {
                    chunks.push(data instanceof Buffer ? data : Buffer.from(data));
                });
                readableStream.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
                readableStream.on('error', reject);
            });
        };

        const blobContent = downloadResponse.readableStreamBody ? await streamToBuffer(downloadResponse.readableStreamBody) : Buffer.from([]);
        return blobContent;
    }

    public async writeFile(file: File, content: Buffer): Promise<void> {
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(file.remoteName);
        const options = {
            blobHTTPHeaders: {
              blobContentType: file.mime,
            },
            metadata: {
              originalLastModified: file.lastModified.toISOString(),
            },
          };
        await blockBlobClient.upload(content, content.length, options);
    }

    public async deleteFile(file: File): Promise<void> {
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(file.remoteName);

        await blockBlobClient.delete();
      }

    public async getFiles(directory: string = this.containerName): Promise<File[]> {
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        let files: File[] = [];

        for await (const blob of containerClient.listBlobsFlat()) {
            // Assuming blob.properties.contentMD5 is available and is a Buffer
            const md5 = blob.properties.contentMD5 ? Buffer.from(blob.properties.contentMD5 as ArrayBuffer).toString('hex') : '';
            const blobItem = blob as BlobItem;
            const originalLastModified = blobItem.metadata?.originalLastModified;
            const lastModified = originalLastModified ? new Date(originalLastModified) : blob.properties.lastModified;
            files.push({
                name: decodeURIComponent(blob.name),
                localName: '',
                remoteName: blob.name,
                mime: blob.properties.contentType || '',
                lastModified: lastModified,
                size: blob.properties.contentLength || 0,
                md5: md5,
                isDirectory: false,
            });
        }

        return files;
    }

}
