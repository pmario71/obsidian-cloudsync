import { AbstractManager, File } from "./AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { Scenario, SyncRule } from "./types/sync";
import { CacheManager } from "./CacheManager";

export class SyncAnalyzer {
    private localFiles: File[] = [];
    private remoteFiles: File[] = [];

    constructor(
        private readonly local: AbstractManager,
        private readonly remote: AbstractManager,
        private readonly cache: CacheManager
    ) {}

    async analyze(): Promise<Scenario[]> {
        const scenarios: Scenario[] = [];

        try {
            [this.localFiles, this.remoteFiles] = await Promise.all([
                this.local.getFiles(),
                this.remote.getFiles()
            ]);

            LogManager.log(LogLevel.Info, `${this.remote.name} ☁️: ${this.remoteFiles.length}, 💻: ${this.localFiles.length}`);

            this.analyzeLocalFiles(scenarios);
            this.analyzeRemoteFiles(scenarios);

            if (scenarios.length > 0) {
                LogManager.log(LogLevel.Info, `\u00A0\u00A0\u00A0\u00A0🔄: ${scenarios.length}`);
            }

            return scenarios;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to analyze sync requirements', error);
            throw error;
        }
    }

    private analyzeLocalFiles(scenarios: Scenario[]): void {
        this.localFiles.forEach((localFile) => {
            const remoteFile = this.remoteFiles.find(
                (f) => f.name === localFile.name
            );

            if (!remoteFile) {
                this.handleMissingRemoteFile(localFile, scenarios);
            } else if (localFile.md5 !== remoteFile.md5) {
                this.handleFileDifference(localFile, remoteFile, scenarios);
            }
        });
    }

    private analyzeRemoteFiles(scenarios: Scenario[]): void {
        this.remoteFiles.forEach((remoteFile) => {
            const localFile = this.localFiles.find((f) => f.name === remoteFile.name);
            if (!localFile) {
                this.handleMissingLocalFile(remoteFile, scenarios);
            }
        });
    }

    private handleMissingRemoteFile(localFile: File, scenarios: Scenario[]): void {
        const cachedMd5 = this.cache.getMd5(localFile.name);

        if (!cachedMd5) {
            // Case C: New local file, not in cache
            scenarios.push({
                local: localFile,
                remote: null,
                rule: "LOCAL_TO_REMOTE",
            });
            LogManager.log(LogLevel.Debug, `New local file, uploading: ${localFile.name}`);
        } else if (cachedMd5 === localFile.md5) {
            // Case A: File exists in cache with same MD5, unchanged since last sync
            scenarios.push({
                local: localFile,
                remote: null,
                rule: "DELETE_LOCAL",
            });
            LogManager.log(LogLevel.Debug, `File unchanged since last sync, deleting locally: ${localFile.name}`);
        } else {
            // Case B: File exists in cache but MD5 different, modified locally
            scenarios.push({
                local: localFile,
                remote: null,
                rule: "LOCAL_TO_REMOTE",
            });
            LogManager.log(LogLevel.Debug, `Local file modified, re-uploading: ${localFile.name}`);
        }
    }

    private handleMissingLocalFile(remoteFile: File, scenarios: Scenario[]): void {
        if (this.cache.hasFile(remoteFile.name)) {
            // Case A: File exists in cache, was deleted locally
            scenarios.push({
                local: null,
                remote: remoteFile,
                rule: "DELETE_REMOTE",
            });
            LogManager.log(LogLevel.Debug, `File deleted locally, removing from remote: ${remoteFile.name}`);
        } else {
            // Case B: New remote file, not in cache
            scenarios.push({
                local: null,
                remote: remoteFile,
                rule: "REMOTE_TO_LOCAL",
            });
            LogManager.log(LogLevel.Debug, `New remote file, downloading: ${remoteFile.name}`);
        }
    }

    private handleFileDifference(localFile: File, remoteFile: File, scenarios: Scenario[]): void {
        const cachedMd5 = this.cache.getMd5(localFile.name);

        if (cachedMd5 && cachedMd5 === remoteFile.md5) {
            // Case A: Cache matches remote, local was modified
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "LOCAL_TO_REMOTE",
            });
            LogManager.log(LogLevel.Debug, `Local changes detected, uploading: ${localFile.name}`);
        } else if (cachedMd5 && cachedMd5 === localFile.md5) {
            // Case B: Cache matches local, remote was modified
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "REMOTE_TO_LOCAL",
            });
            LogManager.log(LogLevel.Debug, `Remote changes detected, downloading: ${localFile.name}`);
        } else {
            // Case C: Cache matches neither, conflict detected
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "DIFF_MERGE",
            });
            LogManager.log(LogLevel.Debug, `Conflict detected, needs merge: ${localFile.name}`);
        }
    }
}
