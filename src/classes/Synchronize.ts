import { FileManager } from './FileManager';
import { writeFile, readFile } from 'fs';
import { promisify } from 'util';
import { diff_match_patch } from 'diff-match-patch';


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
    } catch (error) {
      this.lastSync = new Date(0);
      this.fileCache.clear();
    }
  }

  async writeFileCache(processedFiles: File[]): Promise<void> {
    const writeFileAsync = promisify(writeFile);
    this.fileCache.clear();
    processedFiles.forEach(file => {
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
    return scenarios;
  }

async runAllScenarios(scenarios: Scenario[]): Promise<void> {
  const promises = scenarios.map(async scenario => {
    try {
      if (scenario.rule === 'LOCAL_TO_REMOTE' && scenario.local) {
        const content = await this.local.readFile(scenario.local);
        return this.remote.writeFile(scenario.local, content);
      }
      if (scenario.rule === 'REMOTE_TO_LOCAL' && scenario.remote) {
        const content = await this.remote.readFile(scenario.remote);
        return this.local.writeFile(scenario.remote, content);
      }
      if (scenario.rule === 'DELETE_LOCAL' && scenario.local) {
        return this.local.deleteFile(scenario.local);
      }
      if (scenario.rule === 'DELETE_REMOTE' && scenario.remote) {
        return this.remote.deleteFile(scenario.remote);
      }
      if (scenario.rule === 'DIFF_MERGE' && scenario.local && scenario.remote) {
        return this.diffMerge(scenario.local);
      }
    } catch (error) {
      console.error(`Failed to run scenario: ${scenario.rule}`, error);
    }
    return Promise.resolve();
  });
  await Promise.all(promises);
  this.lastSync = new Date();
  this.remoteFiles = await this.remote.getFiles();
  await this.writeFileCache(this.remoteFiles);
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

  async diffMergeAll(scenarios: Scenario[]): Promise<void> {
    const promises = scenarios
      .filter(scenario => scenario.rule === 'DIFF_MERGE')
      .map(scenario => {
        if (scenario.local && scenario.remote) {
          return this.diffMerge(scenario.local);
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
    // Start reading local and remote files at the same time
    const [localBuffer, remoteBuffer] = await Promise.all([
      this.local.readFile(file),
      this.remote.readFile(file)
    ]);

    // Convert buffers to strings and lines
    const localContent = localBuffer.toString();
    const remoteContent = remoteBuffer.toString();
    const localLines = localContent.split('\n');
    const remoteLines = remoteContent.split('\n');

    // Create a new diff_match_patch instance
    const dmp = new diff_match_patch();

    // Compute the differences between local and remote content
    const diffs = dmp.diff_main(localLines.join('\n'), remoteLines.join('\n'));
    dmp.diff_cleanupSemantic(diffs);

    // Initialize mergedLines with localLines
    let mergedLines = [...localLines];

    // Iterate over the diffs
    for (const [operation, text] of diffs) {
      // If the operation is an insertion, insert the lines at the correct position
      if (operation === diff_match_patch.DIFF_INSERT) {
        const lines = text.split('\n');
        lines.pop(); // Remove the last element, which is always an empty string
        const index = mergedLines.indexOf(localLines[0]);
        mergedLines.splice(index, 0, ...lines);
      }
    }
    const mergedBuffer = Buffer.from(mergedLines.join('\n'));
    // Start writing the merged buffer to local and remote files at the same time
    await Promise.all([
      this.local.writeFile(file, mergedBuffer),
      this.remote.writeFile(file, mergedBuffer)
    ]);
  }

}
