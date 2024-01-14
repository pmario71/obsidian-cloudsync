import { File } from './Synchronize';
import { FileManager } from './AbstractFileManager';
import { promisify } from 'util';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import { generateBlobSASQueryParameters, ContainerSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';

export const readFileAsync = promisify(fs.readFile);
export const writeFileAsync = promisify(fs.writeFile);
export const unlinkAsync = promisify(fs.unlink);
export const readdirAsync = promisify(fs.readdir);
export const statAsync = promisify(fs.stat);

export class AzureFileManager extends FileManager {
  private accountName: string;
  private containerName: string;
  private accountKey: string
  private sasToken: string;
  private authPromise: Promise<void>;
  public consoleUrl: string;

  constructor(accountName: string, accountKey: string, containerName: string) {
    super();
    this.accountName = accountName;
    this.containerName = containerName;
    this.accountKey = accountKey;
    this.authPromise = this.authenticate();
  }

  async isOnline(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
    });
  }

  public async authenticate(): Promise<void> {
    const sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
    const permissions: ContainerSASPermissions = ContainerSASPermissions.parse("rwdl");

    const startDate = new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setHours(startDate.getHours() + 24); // Set the expiry date to 24 hours ahead

    this.sasToken = generateBlobSASQueryParameters({
      containerName: this.containerName,
      permissions: permissions,
      startsOn: startDate,
      expiresOn: expiryDate,
    }, sharedKeyCredential).toString();
    this.consoleUrl = 'https://portal.azure.com/#view/Microsoft_Azure_Storage/ContainerMenuBlade/~/overview/storageAccountId/%2Fsubscriptions%2F2c158093-6ea3-4fca-b3af-1b4dc3488fd4%2FresourceGroups%2FObsidian%2Fproviders%2FMicrosoft.Storage%2FstorageAccounts%2Fobsidianmihak/path/test/etag/%220x8DC13F8352520A0%22/defaultEncryptionScope/%24account-encryption-key/denyEncryptionScopeOverride~/false/defaultId//publicAccessVal/None'

    const now = new Date();
    const minutesLeft = Math.floor((expiryDate.getTime() - now.getTime()) / 60000);

    console.log(`SAS token is valid for another ${minutesLeft} minutes.`);
  }

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
    console.log('name', file.name);
    console.log('remotename', file.remoteName);
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
