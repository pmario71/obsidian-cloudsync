import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { BlobServiceClient } from '@azure/storage-blob';


const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

interface File {
  name: string;
  mime: string;
  timestamp: Date;
  size: number;
  md5: string;
  isDirectory: boolean;
}

type SyncRule =
  "LOCAL_TO_REMOTE" |
  "REMOTE_TO_LOCAL" |
  "DIFF_MERGE" |
  "DELETE_LOCAL" |
  "DELETE_REMOTE";

interface Scenario {
  local: File | null;
  remote: File | null;
  rule: SyncRule;
}

function syncActions(local: File[], remote: File[], lastSync: Date): Scenario[] {
  const scenarios: Scenario[] = [];

  // Handle local files
  local.forEach(localFile => {
    const remoteFile = remote.find(f => f.name === localFile.name);

    if (!remoteFile) {
      if (localFile.timestamp > lastSync) {
        // New file since last sync, needs to be copied to remote
        scenarios.push({ local: localFile, remote: null, rule: "LOCAL_TO_REMOTE" });
      }
    } else if (localFile.md5 !== remoteFile.md5) {
      // File exists on both sides but differs, merge differences
      scenarios.push({ local: localFile, remote: remoteFile, rule: "DIFF_MERGE" });
    }
  });

  // Handle remote files
  remote.forEach(remoteFile => {
    const localFile = local.find(f => f.name === remoteFile.name);

    if (!localFile) {
      if (remoteFile.timestamp > lastSync) {
        // New file since last sync, needs to be copied to local
        scenarios.push({ local: null, remote: remoteFile, rule: "REMOTE_TO_LOCAL" });
      } else {
        // File existed during last sync but is missing locally, delete on remote
        scenarios.push({ local: null, remote: remoteFile, rule: "DELETE_REMOTE" });
      }
    }
  });

  return scenarios;
}


abstract class FileManager {
  protected files: File[];
  protected lastSync: Date | null;
  protected isAuthenticated: boolean;

  constructor() {
    this.files = [];
    this.lastSync = null;
    this.isAuthenticated = false;
  }

  // Method to authenticate
  public abstract authenticate(credentials: any): void;

  public abstract path(file: File): string;

  // Method to get the list of files
  public getFiles(): Promise<File[]> {
    return Promise.resolve(this.files);
  }

  // Method to set or update the last sync date
  public setLastSync(date: Date): void {
    this.lastSync = date;
  }

  // Method to get the last sync date
  public getLastSync(): Date | null {
    return this.lastSync;
  }

  // Abstract methods for file operations - to be implemented in derived classes
  abstract readFile(file: File):  Promise<string>; // Assuming read returns file content as a string
  abstract writeFile(file: File, content: string): void; // Write file content
  abstract deleteFile(name: string): void;

  // Additional helper methods can be added as needed.
}

class LocalFileManager extends FileManager {
  private directory: string;

  constructor(directory: string) {
    super();
    this.directory = directory;
  }

  public authenticate(): Promise<void> {
    // No authentication needed for local file system
    this.isAuthenticated = true;
    return Promise.resolve();
  }

  public path(file: File): string {
    return path.join(this.directory, file.name);
  }

  public async readFile(file: File): Promise<string> {
    const content = await readFileAsync(this.path(file), 'utf8');
    return content
  }

  public async writeFile(file: File, content: string): Promise<void> {
    const filePath = path.join(this.directory, file.name);
    await writeFileAsync(filePath, content, 'utf8');
  }

  public async deleteFile(name: string): Promise<void> {
    const filePath = path.join(this.directory, name);
    await unlinkAsync(filePath);
  }

  public async getFiles(directory: string = this.directory): Promise<File[]> {
    const ignoreList = ['node_modules', '.git', 'bak', '.obsidian', '.DS_Store'];

    if (ignoreList.includes(path.basename(directory))) {
      return [];
    }
    const fileNames = await readdirAsync(directory);
    const files = await Promise.all(fileNames.map(async (name) => {
      if (ignoreList.includes(name)) {
        return [];
      }
      const filePath = path.join(directory, name);
      const stats = await statAsync(filePath);

      if (stats.isDirectory()) {
        // If it's a directory, recursively get the files in the directory
        return this.getFiles(filePath);
      } else {
        // If it's a file, read it and compute its MD5 hash
        const content = await readFileAsync(filePath);
        const hash = createHash('md5').update(content).digest('hex');

        // Create a cloud storage friendly name
        const cloudPath = encodeURIComponent(path.relative(this.directory, filePath).replace(/\\/g, '/'));

        return {
          name: path.relative(this.directory, filePath).replace(/\\/g, '/'),
          mime: 'text/markdown',
          size: stats.size,
          lastModified: stats.mtime,
          timestamp: new Date(),
          md5: hash,
          isDirectory: stats.isDirectory(),
        };
      }
    }));

    // Flatten the array of files and directories
    this.files = files.flat();
    this.files = this.files.filter(file => !file.isDirectory);

    return this.files;
  }
}

class AzureFileManager extends FileManager {
  private blobServiceClient: BlobServiceClient;
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

  public async readFile(file: File): Promise<string> {
    return '';
  }

  public async writeFile(file: File, content: string): Promise<void> {
  }

  public async deleteFile(name: string): Promise<void> {
  }

  // Override getFiles method
  public async getFiles(directory: string = this.containerName): Promise<File[]> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    let files: File[] = [];

    for await (const blob of containerClient.listBlobsFlat()) {
        // Assuming blob.properties.contentMD5 is available and is a Buffer
        const md5 = blob.properties.contentMD5 ? Buffer.from(blob.properties.contentMD5 as ArrayBuffer).toString('hex') : '';
        files.push({
            name: decodeURIComponent(blob.name),
            mime: blob.properties.contentType || '',
            timestamp: blob.properties.lastModified,
            size: blob.properties.contentLength || 0,
            md5: md5,
            isDirectory: false,
        });
    }

    return files;
  }

  // Implement other methods...
}

///////////////////////////////////////////////////////////
//                       main loop                       //
///////////////////////////////////////////////////////////
async function main() {
  const localDir = '/Users/miha/Library/CloudStorage/OneDrive-Personal/logseq/personal';
  //const localDir = 'c/Users/miha/OneDrive/logseq/personal';
  const azureConnString = 'DefaultEndpointsProtocol=https;AccountName=obsidianmihak;AccountKey=awjHmbFKFfvFM87Y5k2JQ7UvVDogrF5k9j2lw+jLlroivYyJ03s2/EfISXxudD1NUhWa+DMIBvyi+ASthN95tA==;EndpointSuffix=core.windows.net';
  const azureStorageAccount = 'obsidianmihak'
  const azureDir = 'obsidian'

//////////////////////////////////////////////////////////

  const localVault = new LocalFileManager(localDir);
  const azureVault = new AzureFileManager(azureConnString, azureStorageAccount, azureDir);

  try {
    const localFiles = await localVault.getFiles();
    console.log('Local files:', localFiles.length);
    console.log(localFiles[0]);
    console.log(localVault.path(localFiles[0]));

    //const content = await localVault.readFile(localFiles[64]);
    //console.log(content);

    //const remoteFiles = await azureVault.getFiles();
    //console.log('Remote files:', remoteFiles.length);

    //const actions = syncActions(localFiles, remoteFiles, new Date('2023-12-07T20:00:27.000Z'))
    //console.log('Actions:', actions.length);

    //const localToRemoteActions = actions.filter(action => action.rule === 'LOCAL_TO_REMOTE');
    //console.log('LOCAL_TO_REMOTE actions:', localToRemoteActions.map(action => ({ name: action.local.name, cloudPath: action.local.cloudPath })));

  } catch (error) {
    console.error('Failed to get files:', error);
  }
}

main();