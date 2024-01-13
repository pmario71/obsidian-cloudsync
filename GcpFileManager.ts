import { GoogleAuth } from 'google-auth-library';
import { File } from './Synchronize';
import { FileManager } from './AbstractFileManager';
import fetch from 'node-fetch';
import * as xml2js from 'xml2js';

export class GCPFileManager extends FileManager {
  private privateKey: string;
  private clientEmail: string;
  private bucketName: string;
  private accessToken: string = '';
  private authPromise: Promise<void>;

  constructor(
    privatekey: string,
    clientemail: string,
    bucketname: string,
  ) {
    super();
    this.privateKey = privatekey.replace(/\\n/g, '\n');
    this.clientEmail = clientemail;
    this.bucketName = bucketname;
    this.authPromise = this.authenticate();
  }

  isOnline(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public async authenticate(): Promise<void> {
    const auth = new GoogleAuth({
      credentials: {
        client_email: this.clientEmail,
        private_key: this.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/devstorage.full_control'],
    });
    const client = await auth.getClient();
    const response = await client.getAccessToken();
    this.accessToken = response.token ?? '';
  }

  public path(file: File): string {
    return encodeURIComponent(file.name);
  }

  async readFile(file: File): Promise<Buffer> {
    const fileName = encodeURIComponent(file.remoteName);
    const url = `https://${this.bucketName}.storage.googleapis.com/${fileName}`;
    await this.authPromise;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async writeFile(file: File, content: Buffer): Promise<void> {
    const fileName = encodeURIComponent(file.name);
    const url = `https://${this.bucketName}.storage.googleapis.com/${fileName}`;
    await this.authPromise;
    await fetch(url, {
      method: 'PUT',
      body: content,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': file.mime,
      },
    });
  }

  async deleteFile(file: File): Promise<void> {
    const fileName = encodeURIComponent(file.remoteName);
    const url = `https://${this.bucketName}.storage.googleapis.com/${fileName}`;
    await this.authPromise;
    await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  public async getFiles(): Promise<File[]> {
    const url = `https://${this.bucketName}.storage.googleapis.com`;
    await this.authPromise;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    const data = await response.text();
    const result = await xml2js.parseStringPromise(data);
    const items = result.ListBucketResult.Contents;

    if (!items || items.length === 0) {
      return [];
    }

    return items.map((item: any) => {
      const key = item.Key[0];
      const lastModified = new Date(item.LastModified[0]);
      const eTag = item.ETag[0];
      const size = Number(item.Size[0]);

      return {
        name: decodeURIComponent(key),
        localName: '',
        remoteName: key,
        mime: '', // MIME type is not provided in the XML API response
        lastModified: lastModified,
        size: size,
        md5: eTag.replace(/"/g, ''), // Remove quotes from ETag
        isDirectory: false,
        url: `https://${this.bucketName}.storage.googleapis.com/${encodeURIComponent(key)}`,
      };
    });
  }
}