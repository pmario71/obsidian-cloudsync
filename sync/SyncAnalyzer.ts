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
        LogManager.log(LogLevel.Trace, 'Analyzing sync requirements...');
        const scenarios: Scenario[] = [];

        try {
            [this.localFiles, this.remoteFiles] = await Promise.all([
                this.local.getFiles(),
                this.remote.getFiles()
            ]);

            LogManager.log(LogLevel.Trace, `Found ${this.localFiles.length} local files and ${this.remoteFiles.length} files in ${this.remote.name}`);

            this.analyzeLocalFiles(scenarios);
            this.analyzeRemoteFiles(scenarios);

            if (scenarios.length > 0) {
                // Just log total number of changes
                LogManager.log(LogLevel.Info, `${this.remote.name} changes: ${scenarios.length}`);
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
        // If file exists locally but not remotely, it should be uploaded
        scenarios.push({
            local: localFile,
            remote: null,
            rule: "LOCAL_TO_REMOTE",
        });
        LogManager.log(LogLevel.Debug, `Local file needs upload: ${localFile.name}`);
    }

    private handleMissingLocalFile(remoteFile: File, scenarios: Scenario[]): void {
        // If file exists remotely but not locally, and it's in cache, it was deleted locally
        if (this.cache.hasFile(remoteFile.name)) {
            scenarios.push({
                local: null,
                remote: remoteFile,
                rule: "DELETE_REMOTE",
            });
            LogManager.log(LogLevel.Debug, `File deleted locally: ${remoteFile.name}`);
        } else {
            // If not in cache, it's a new remote file
            scenarios.push({
                local: null,
                remote: remoteFile,
                rule: "REMOTE_TO_LOCAL",
            });
            LogManager.log(LogLevel.Debug, `New remote file detected: ${remoteFile.name}`);
        }
    }

    private handleFileDifference(localFile: File, remoteFile: File, scenarios: Scenario[]): void {
        const cachedMd5 = this.cache.getMd5(localFile.name);
        if (cachedMd5 && cachedMd5 === remoteFile.md5) {
            // Remote unchanged, local changed - upload local changes
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "LOCAL_TO_REMOTE",
            });
            LogManager.log(LogLevel.Debug, `Local changes detected: ${localFile.name}`);
        } else if (cachedMd5 && cachedMd5 === localFile.md5) {
            // Local unchanged, remote changed - download remote changes
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "REMOTE_TO_LOCAL",
            });
            LogManager.log(LogLevel.Debug, `Remote changes detected: ${localFile.name}`);
        } else {
            // Both changed or cache missing - need merge
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "DIFF_MERGE",
            });
            LogManager.log(LogLevel.Debug, `Conflicting changes detected: ${localFile.name}`);
        }
    }
}
