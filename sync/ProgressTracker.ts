import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { SyncRule } from "./types/sync";

export class ProgressTracker {
    private readonly progressLines: Map<SyncRule, number> = new Map();
    private readonly completedCounts: Record<SyncRule, number>;
    private readonly totalCounts: Record<SyncRule, number>;
    private currentRule: SyncRule | null = null;

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
            LogManager.log(LogLevel.Trace, `${action}: ${this.totalCounts[rule as SyncRule]}`);
        });
    }

    private formatAction(rule: SyncRule): string {
        switch (rule) {
            case "LOCAL_TO_REMOTE":
                return "💻→☁️";
            case "REMOTE_TO_LOCAL":
                return "☁️→💻";
            case "DELETE_LOCAL":
                return "💻→❌";
            case "DELETE_REMOTE":
                return "☁️→❌";
            case "DIFF_MERGE":
                return "💻⇄☁️";
            default:
                return rule.toLowerCase().replace(/_/g, ' ');
        }
    }

    updateProgress(rule: SyncRule): void {
        this.completedCounts[rule]++;
        const action = this.formatAction(rule);

        // If switching to a new rule type, create new line
        const createNewLine = this.currentRule !== rule;
        if (createNewLine) {
            this.currentRule = rule;
        }

        LogManager.log(
            LogLevel.Info,
            `${action} ${this.completedCounts[rule]}/${this.totalCounts[rule]}`,
            undefined,
            !createNewLine // Update line if continuing same rule, create new line if switching rules
        );
    }

    logScenarioStart(rule: SyncRule, fileName: string): void {
        const action = this.formatAction(rule);
        LogManager.log(LogLevel.Trace, `Processing ${action} for ${fileName}`);
    }

    logScenarioError(rule: SyncRule, fileName: string, error: unknown): void {
        const action = this.formatAction(rule);
        LogManager.log(LogLevel.Error, `Failed to process ${action} for ${fileName}`, error);
    }

    getSummary(): string {
        return Object.entries(this.totalCounts)
            .filter(([_, count]) => count > 0)
            .map(([rule, count]) => `${this.formatAction(rule as SyncRule)}: ${count}`)
            .join(', ');
    }
}
