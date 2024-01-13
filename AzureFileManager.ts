import { File } from './Synchronize';
import { FileManager } from './AbstractFileManager';
import { promisify } from 'util';
import * as fs from 'fs';
import * as xml2js from 'xml2js';

export const readFileAsync = promisify(fs.readFile);
export const writeFileAsync = promisify(fs.writeFile);
export const unlinkAsync = promisify(fs.unlink);
export const readdirAsync = promisify(fs.readdir);
export const statAsync = promisify(fs.stat);

export class AzureFileManager extends FileManager {
  private accountName: string;
  private containerName: string;
  private sasToken: string;
  private domain: string;

  constructor(accountName: string, sasToken: string, containerName: string) {
    super();
    this.accountName = accountName;
    this.containerName = containerName;
    this.sasToken = sasToken;
    if (this.sasToken.startsWith('?')) {
      this.sasToken = this.sasToken.slice(1);
    }
    this.domain = this.accountName + '.blob.core.windows.net';

    this.isOnline();
  }

  async isOnline(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const url = `https://${this.domain}/?restype=service&comp=properties&${this.sasToken}`;
      try {
        const response = await fetch(url);
        resolve(response.ok);
      } catch (error) {
        console.error(`Fetch failed for ${this.domain}`);
        reject(error);
      }
    });
  }

  public async authenticate(): Promise<void> {}

  public path(file: File): string {
    return encodeURIComponent(file.name);
  }

  async readFile(file: File): Promise<Buffer> {
    const url = `https://${this.accountName}.blob.core.windows.net/${
      this.containerName
    }/${decodeURIComponent(file.remoteName)}?${this.sasToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.arrayBuffer();

    return Buffer.from(data);
  }

  public async writeFile(file: File, content: Buffer): Promise<void> {
    const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${file.remoteName}?${this.sasToken}`;
    const response = await fetch(url, {
      method: 'PUT',
      body: content,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-ms-blob-type': 'BlockBlob',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  public async deleteFile(file: File): Promise<void> {
    const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${file.remoteName}?${this.sasToken}`;
    const response = await fetch(url, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  public async getFiles(): Promise<File[]> {
    let files: File[] = [];
    const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}?restype=container&comp=list&${this.sasToken}`;

    try {
      const response = await fetch(url); //{mode: 'no-cors'}
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.text();
      const result = await xml2js.parseStringPromise(data);
      const blobs = result.EnumerationResults.Blobs[0].Blob;

      files = blobs.map((blob: any) => {
        const properties = blob.Properties[0];
        const md5Hash = properties['Content-MD5'][0]
          ? Buffer.from(properties['Content-MD5'][0], 'base64').toString('hex')
          : '';

        return {
          name: decodeURIComponent(blob.Name[0]),
          localName: '',
          remoteName: blob.Name[0],
          mime: properties['Content-Type'][0] || '',
          lastModified: properties['Last-Modified'][0]
            ? new Date(properties['Last-Modified'][0])
            : new Date(),
          size: properties['Content-Length'][0]
            ? Number(properties['Content-Length'][0])
            : 0,
          md5: md5Hash,
          isDirectory: false,
        };
      });
    } catch (error) {
      console.error('Error accessing Azure Blob Storage:', error);
    }
    return files;
  }
}

async function blobToArrayBuffer(blob: ReadableStream): Promise<ArrayBuffer> {
  return new Response(blob).arrayBuffer();
}
