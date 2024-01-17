import { File } from "./Synchronize";
import { FileManager } from "./AbstractFileManager";
import { promisify } from "util";
import * as fs from "fs";
import * as xml2js from "xml2js";
import {
  generateAccountSASQueryParameters,
  AccountSASPermissions,
  AccountSASServices,
  AccountSASResourceTypes,
  StorageSharedKeyCredential,
  BlobServiceClient
} from "@azure/storage-blob";

export const readFileAsync = promisify(fs.readFile);
export const writeFileAsync = promisify(fs.writeFile);
export const unlinkAsync = promisify(fs.unlink);
export const readdirAsync = promisify(fs.readdir);
export const statAsync = promisify(fs.stat);

export class AzureFileManager extends FileManager {
  private accountName: string;
  private containerName: string;
  private accountKey: string;
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
    return new Promise(async (resolve, reject) => {});
  }

  public async authenticate(): Promise<void> {

    //const sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
    //const blobServiceClient = new BlobServiceClient(`https://${this.accountName}.blob.core.windows.net`,sharedKeyCredential);
    //const containerClient = blobServiceClient.getContainerClient(this.containerName);

    const permissions = new AccountSASPermissions();
    permissions.read = true;
    permissions.write = true;
    permissions.delete = true;
    permissions.list = true;

    const services = new AccountSASServices();
    services.blob = true;

    const resourceTypes = new AccountSASResourceTypes();
    resourceTypes.container = true;
    resourceTypes.object = true;

    const startDate = new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setHours(startDate.getHours() + 1);

    const sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, this.accountKey);

    this.sasToken = generateAccountSASQueryParameters({
      permissions: permissions,
      services: services.toString(),
      resourceTypes: resourceTypes.toString(),
      startsOn: startDate,
      expiresOn: expiryDate,
    }, sharedKeyCredential).toString();

    console.log(this.sasToken)
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
    console.log("name", file.name);
    console.log("remotename", file.remoteName);
    const response = await fetch(url, {
      method: "PUT",
      body: content,
      headers: {
        "Content-Type": "application/octet-stream",
        "x-ms-blob-type": "BlockBlob",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  public async deleteFile(file: File): Promise<void> {
    const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${file.remoteName}?${this.sasToken}`;
    const response = await fetch(url, {
      method: "DELETE",
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

      if (blobs) {
        files = blobs.map((blob: any) => {
          const properties = blob.Properties[0];
          const md5Hash = properties["Content-MD5"][0]
            ? Buffer.from(properties["Content-MD5"][0], "base64").toString("hex")
            : "";

          return {
            name: decodeURIComponent(blob.Name[0]),
            localName: "",
            remoteName: blob.Name[0],
            mime: properties["Content-Type"][0] || "",
            lastModified: properties["Last-Modified"][0]
              ? new Date(properties["Last-Modified"][0])
              : new Date(),
            size: properties["Content-Length"][0]
              ? Number(properties["Content-Length"][0])
              : 0,
            md5: md5Hash,
            isDirectory: false,
          };
        });
      }
    } catch (error) {
      console.error("Error accessing Azure Blob Storage:", error);
    }
    return files;
  }
}

async function blobToArrayBuffer(blob: ReadableStream): Promise<ArrayBuffer> {
  return new Response(blob).arrayBuffer();
}
