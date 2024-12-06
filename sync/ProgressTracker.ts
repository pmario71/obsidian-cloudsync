import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { SyncRule } from "./types/sync";

export class ProgressTracker {
    private readonly progressLines: Map<SyncRule, number> = new Map();
    private readonly completedCounts: Record<SyncRule, number>;
    private readonly totalCounts: Record<SyncRule, number>;

    constructor(scenarios: { rule: SyncRule }[]) {
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
            const action = rule.toLowerCase().replace(/_/g, ' ');
            this.log(LogLevel.Info, `${action}: 0/${this.totalCounts[rule as SyncRule]}`);
        });
    }

    private log(level: LogLevel, message: string, data?: any, update?: boolean): void {
        LogManager.log(level, message, data, update);
    }

    updateProgress(rule: SyncRule): void {
        this.completedCounts[rule]++;
        const action = rule.toLowerCase().replace(/_/g, ' ');
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
        this.log(LogLevel.Trace, `Processing ${rule} for ${fileName}`);
    }

    logScenarioError(rule: SyncRule, fileName: string, error: any): void {
        this.log(LogLevel.Error, `Failed to process ${rule} for ${fileName}`, error);
    }

    getSummary(): string {
        return Object.entries(this.totalCounts)
            .filter(([_, count]) => count > 0)
            .map(([rule, count]) => `${rule}: ${count}`)
            .join(', ');
    }
}
