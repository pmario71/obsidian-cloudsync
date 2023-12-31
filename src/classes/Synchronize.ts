import { FileManager } from './FileManager';
import { writeFile, readFile } from 'fs';
import { promisify } from 'util';


export interface File {
  name: string;
  localName: string;
  remoteName: string;
  mime: string;
  lastModified: Date;
  size: number;
  md5: string;
  isDirectory: boolean;
}

export interface Scenario {
  local: File | null;
  remote: File | null;
  rule: SyncRule;
}

export type SyncRule =
  "LOCAL_TO_REMOTE" |
  "REMOTE_TO_LOCAL" |
  "DIFF_MERGE" |
  "DELETE_LOCAL" |
  "DELETE_REMOTE" |
  "TO_CACHE";

export class Synchronize {
  local: FileManager;
  remote: FileManager;
  localFiles: File[];
  remoteFiles: File[];
  fileName: string = "/Users/miha/Library/CloudStorage/OneDrive-Personal/logseq/personal/.cloudsync.json";
  fileCache: Map<string, string>;
  lastSync: Date;

  //we need a caching table for remote files - names, timestamps and MD5s (so we can track what files we know about)

  constructor(local: FileManager, remote: FileManager) {
    this.local = local;
    this.remote = remote;
    this.localFiles = [];
    this.remoteFiles = [];
    this.fileCache = new Map();
    this.lastSync = new Date(0);
  }

  async readFileCache(): Promise<void> {
    const readFileAsync = promisify(readFile);
    try {
      const fileCacheJson = await readFileAsync(this.fileName, 'utf-8');
      const { lastSync, fileCache } = JSON.parse(fileCacheJson);
      this.lastSync = new Date(lastSync);
      this.fileCache = new Map(fileCache);
      console.log("ok");
    } catch (error) {
      this.lastSync = new Date(0);
      this.fileCache.clear();
      console.log("err");
    }
  }

  async writeFileCache(files: File[]): Promise<void> {
    const writeFileAsync = promisify(writeFile);
    this.fileCache.clear();
    files.forEach(file => {
      this.fileCache.set(file.name, file.md5);
    });
    const fileCacheArray = Array.from(this.fileCache.entries());
    const fileCacheJson = JSON.stringify({ lastSync: this.lastSync, fileCache: fileCacheArray });
    await writeFileAsync(this.fileName, fileCacheJson);
  }

  async syncActions(): Promise<Scenario[]> {
    const scenarios: Scenario[] = [];
    this.localFiles = await this.local.getFiles();
    this.remoteFiles = await this.remote.getFiles();
    await this.readFileCache();

    // Handle local files
    this.localFiles.forEach(localFile => {
      const remoteFile = this.remoteFiles.find(f => f.name === localFile.name);

      if (!remoteFile) {
        if (!this.fileCache.has(localFile.name)) {
          // Not in the cache; new file since last sync, needs to be copied to remote
          scenarios.push({ local: localFile, remote: null, rule: "LOCAL_TO_REMOTE" });
        } else {
          // File existed during last sync but is now missing remotely, delete locally
          scenarios.push({ local: localFile, remote: null, rule: "DELETE_LOCAL" });
        }
      } else if (localFile.md5 !== remoteFile.md5) {
        const cachedMd5 = this.fileCache.get(localFile.name);
        if (cachedMd5 && cachedMd5 === remoteFile.md5) {
        // File exists on both sides but remote file didn't change, copy to remote
          scenarios.push({ local: localFile, remote: remoteFile, rule: "LOCAL_TO_REMOTE" });
        } else if (cachedMd5 && cachedMd5 === localFile.md5) {
          // File exists on both sides but local file didn't change, copy to local
          scenarios.push({ local: localFile, remote: remoteFile, rule: "REMOTE_TO_LOCAL" });
        } else {
        // File exists on both sides and changed on both sides, merge the differences
          scenarios.push({ local: localFile, remote: remoteFile, rule: "DIFF_MERGE" });
        }
      }
    });

    // Handle remote files
    this.remoteFiles.forEach(remoteFile => {
      const localFile = this.localFiles.find(f => f.name === remoteFile.name);

      if (!localFile) {
        if (!this.fileCache.has(remoteFile.name)) {
          // Not in the cache; new file since last sync, needs to be copied to local
          scenarios.push({ local: null, remote: remoteFile, rule: "REMOTE_TO_LOCAL" });
        } else {
          // File existed during last sync but is now missing locally, delete on remote
          scenarios.push({ local: null, remote: remoteFile, rule: "DELETE_REMOTE" });
        }
      } else {
        scenarios.push({ local: localFile, remote: remoteFile, rule: "TO_CACHE" });
      }
    });

    this.lastSync = new Date();

    const processedFiles = scenarios
      .filter(scenario => scenario.rule === 'TO_CACHE')
      .map(scenario => scenario.remote)
      .filter(file => file !== null) as File[];

    await this.writeFileCache(processedFiles);
    return scenarios;
  }

  async copyAllToRemote(scenarios: Scenario[]): Promise<void> {
    const promises = scenarios
      .filter(scenario => scenario.rule === 'LOCAL_TO_REMOTE')
      .map(scenario => {
        if (scenario.local) {
          return this.copyToRemote(scenario.local);
        }
        return Promise.resolve();
      });
    await Promise.all(promises);
  }

  async copyAllToLocal(scenarios: Scenario[]): Promise<void> {
    const promises = scenarios
      .filter(scenario => scenario.rule === 'REMOTE_TO_LOCAL')
      .map(scenario => {
        if (scenario.remote) {
          return this.copyToLocal(scenario.remote);
        }
        return Promise.resolve();
      });
    await Promise.all(promises);
  }

  async deleteAllLocal(scenarios: Scenario[]): Promise<void> {
    const promises = scenarios
      .filter(scenario => scenario.rule === 'DELETE_LOCAL')
      .map(scenario => {
        if (scenario.local) {
          return this.deleteFromLocal(scenario.local);
        }
        return Promise.resolve();
      });
    await Promise.all(promises);
  }

  async deleteAllRemote(scenarios: Scenario[]): Promise<void> {
    const promises = scenarios
      .filter(scenario => scenario.rule === 'DELETE_REMOTE')
      .map(scenario => {
        if (scenario.remote) {
          return this.deleteFromRemote(scenario.remote);
        }
        return Promise.resolve();
      });
    await Promise.all(promises);
  }

  async copyToRemote(file: File): Promise<void>  {
    const content = await this.local.readFile(file);
    await this.remote.writeFile(file, content);
  }

  async copyToLocal(file: File): Promise<void>  {
    const content = await this.remote.readFile(file);
    await this.local.writeFile(file, content);
  }

  async deleteFromRemote(file: File): Promise<void> {
    await this.remote.deleteFile(file);
  }

  async deleteFromLocal(file: File): Promise<void> {
    await this.local.deleteFile(file);
  }

  async diffMerge(file: File): Promise<void> {
    // Implement the logic to merge differences
  }
}
