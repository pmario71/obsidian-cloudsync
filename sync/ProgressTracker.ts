import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { SyncRule } from "./types/sync";

export class ProgressTracker {
    private readonly progressLines: Map<SyncRule, number> = new Map();
    private readonly completedCounts: Record<SyncRule, number>;
    private readonly totalCounts: Record<SyncRule, number>;

    constructor(scenarios: { rule: SyncRule }[], private readonly remoteName: string) {
        // Calculate total counts per rule
        this.totalCounts = scenarios.reduce((acc, s) => {
            acc[s.rule] = (acc[s.rule] || 0) + 1;
            return acc;
        }, {} as Record<SyncRule, number>);

        // Initialize completed counts
        this.completedCounts = Object.entries(this.totalCounts).reduce((acc, [rule, _]) => {
            acc[rule as SyncRule] = 0;
            return acc;
        }, {} as Record<SyncRule, number>);

        // Initialize progress line numbers
        let currentLine = 0;
        Object.keys(this.totalCounts).forEach(rule => {
            this.progressLines.set(rule as SyncRule, currentLine++);
            const action = this.formatAction(rule as SyncRule);
            this.log(LogLevel.Trace, `${action}: ${this.totalCounts[rule as SyncRule]}`);
        });
    }

    private log(level: LogLevel, message: string, data?: any, update?: boolean): void {
        LogManager.log(level, message, data, update);
    }

    private formatAction(rule: SyncRule): string {
        switch (rule) {
            case "LOCAL_TO_REMOTE":
                return `local to ${this.remoteName}`;
            case "REMOTE_TO_LOCAL":
                return `${this.remoteName} to local`;
            case "DELETE_LOCAL":
                return `delete from local`;
            case "DELETE_REMOTE":
                return `delete from ${this.remoteName}`;
            case "DIFF_MERGE":
                return `merge with ${this.remoteName}`;
            default:
                return rule.toLowerCase().replace(/_/g, ' ');
        }
    }

    updateProgress(rule: SyncRule): void {
        this.completedCounts[rule]++;
        const action = this.formatAction(rule);
        const lineNumber = this.progressLines.get(rule);
        if (lineNumber !== undefined) {
            this.log(
                LogLevel.Info,
                `Sync progress - ${this.completedCounts[rule]}/${this.totalCounts[rule]} ${action}`,
                undefined,
                true
            );
        }
    }

    logScenarioStart(rule: SyncRule, fileName: string): void {
        const action = this.formatAction(rule);
        this.log(LogLevel.Trace, `Processing ${action} for ${fileName}`);
    }

    logScenarioError(rule: SyncRule, fileName: string, error: any): void {
        const action = this.formatAction(rule);
        this.log(LogLevel.Error, `Failed to process ${action} for ${fileName}`, error);
    }

    getSummary(): string {
        return Object.entries(this.totalCounts)
            .filter(([_, count]) => count > 0)
            .map(([rule, count]) => `${this.formatAction(rule as SyncRule)}: ${count}`)
            .join(', ');
    }
}
