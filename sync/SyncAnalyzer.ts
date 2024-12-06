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

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    async analyze(): Promise<Scenario[]> {
        this.log(LogLevel.Trace, 'Analyzing sync requirements...');
        const scenarios: Scenario[] = [];

        try {
            [this.localFiles, this.remoteFiles] = await Promise.all([
                this.local.getFiles(),
                this.remote.getFiles()
            ]);

            this.log(LogLevel.Info, `Found ${this.localFiles.length} local files and ${this.remoteFiles.length} files in ${this.remote.name}`);

            this.analyzeLocalFiles(scenarios);
            this.analyzeRemoteFiles(scenarios);

            if (scenarios.length > 0) {
                this.log(LogLevel.Trace, `${this.remote.name} sync plan:`, scenarios.reduce((acc, s) => {
                    acc[s.rule] = (acc[s.rule] || 0) + 1;
                    return acc;
                }, {} as Record<SyncRule, number>));
            } else {
                this.log(LogLevel.Info, `All files are in sync with ${this.remote.name}`);
            }

            return scenarios;
        } catch (error) {
            this.log(LogLevel.Error, 'Failed to analyze sync requirements', error);
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
        if (!this.cache.hasFile(localFile.name)) {
            scenarios.push({
                local: localFile,
                remote: null,
                rule: "LOCAL_TO_REMOTE",
            });
            this.log(LogLevel.Debug, `New local file detected: ${localFile.name}`);
        } else {
            scenarios.push({
                local: localFile,
                remote: null,
                rule: "DELETE_LOCAL",
            });
            this.log(LogLevel.Debug, `File deleted remotely: ${localFile.name}`);
        }
    }

    private handleMissingLocalFile(remoteFile: File, scenarios: Scenario[]): void {
        if (!this.cache.hasFile(remoteFile.name)) {
            scenarios.push({
                local: null,
                remote: remoteFile,
                rule: "REMOTE_TO_LOCAL",
            });
            this.log(LogLevel.Debug, `New remote file detected: ${remoteFile.name}`);
        } else {
            scenarios.push({
                local: null,
                remote: remoteFile,
                rule: "DELETE_REMOTE",
            });
            this.log(LogLevel.Debug, `File deleted locally: ${remoteFile.name}`);
        }
    }

    private handleFileDifference(localFile: File, remoteFile: File, scenarios: Scenario[]): void {
        const cachedMd5 = this.cache.getMd5(localFile.name);
        if (cachedMd5 && cachedMd5 === remoteFile.md5) {
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "LOCAL_TO_REMOTE",
            });
            this.log(LogLevel.Debug, `Local changes detected: ${localFile.name}`);
        } else if (cachedMd5 && cachedMd5 === localFile.md5) {
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "REMOTE_TO_LOCAL",
            });
            this.log(LogLevel.Debug, `Remote changes detected: ${localFile.name}`);
        } else {
            scenarios.push({
                local: localFile,
                remote: remoteFile,
                rule: "DIFF_MERGE",
            });
            this.log(LogLevel.Debug, `Conflicting changes detected: ${localFile.name}`);
        }
    }
}
