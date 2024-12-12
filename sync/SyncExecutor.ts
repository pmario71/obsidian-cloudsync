import { AbstractManager } from "./AbstractManager";
import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { Scenario } from "./types/sync";
import { FileOperations } from "./FileOperations";
import { CacheManager } from "./CacheManager";
import { ProgressTracker } from "./ProgressTracker";
import { diffMerge } from "./mergeUtils";

export class SyncExecutor {
    constructor(
        private readonly local: AbstractManager,
        private readonly remote: AbstractManager,
        private readonly fileOps: FileOperations,
        private readonly cache: CacheManager
    ) {}

    async execute(scenarios: Scenario[]): Promise<void> {
        LogManager.log(LogLevel.Trace, `Starting sync of ${scenarios.length} changes with ${this.remote.name}...`);
        const progress = new ProgressTracker(scenarios, this.remote.name);

        try {
            for (const scenario of scenarios) {
                await this.executeScenario(scenario, progress);
            }

            await this.finalizeSync();
            LogManager.log(LogLevel.Info, `${this.remote.name} ✅`, undefined, false, true);
        } catch (error) {
            LogManager.log(LogLevel.Error, `${this.remote.name} sync failed`, error);
            throw error;
        }
    }

    private async executeScenario(scenario: Scenario, progress: ProgressTracker): Promise<void> {
        try {
            const fileName = scenario.local?.name ?? scenario.remote?.name;
            progress.logScenarioStart(scenario.rule, fileName!);

            switch (scenario.rule) {
                case "LOCAL_TO_REMOTE":
                    if (scenario.local) {
                        await this.fileOps.copyToRemote(scenario.local);
                    }
                    break;
                case "REMOTE_TO_LOCAL":
                    if (scenario.remote) {
                        await this.fileOps.copyToLocal(scenario.remote);
                    }
                    break;
                case "DELETE_LOCAL":
                    if (scenario.local) {
                        await this.fileOps.deleteFromLocal(scenario.local);
                    }
                    break;
                case "DELETE_REMOTE":
                    if (scenario.remote) {
                        await this.fileOps.deleteFromRemote(scenario.remote);
                    }
                    break;
                case "DIFF_MERGE":
                    if (scenario.local && scenario.remote) {
                        await this.handleDiffMerge(scenario);
                    }
                    break;
                default:
                    break;
            }

            progress.updateProgress(scenario.rule);

        } catch (error) {
            const fileName = scenario.local?.name ?? scenario.remote?.name;
            progress.logScenarioError(scenario.rule, fileName!, error);
            throw error;
        }
    }

    private async handleDiffMerge(scenario: Scenario): Promise<void> {
        await diffMerge(
            scenario.local!,
            (f) => this.local.readFile(f),
            (f) => this.remote.readFile(f),
            (f, c) => this.local.writeFile(f, c),
            (f, c) => this.remote.writeFile(f, c)
        );
    }

    private async finalizeSync(): Promise<void> {
        this.cache.updateLastSync();
        const remoteFiles = await this.remote.getFiles();
        await this.cache.writeCache(remoteFiles);
    }
}
