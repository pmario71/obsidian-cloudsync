import { LogManager } from "../LogManager";
import { LogLevel } from "./types";
import { SyncRule } from "./types/sync";
import { Strings } from "./utils/strings";

export class ProgressTracker {
    private readonly progressLines: Map<SyncRule, number> = new Map();
    private readonly completedCounts: Record<SyncRule, number>;
    private readonly totalCounts: Record<SyncRule, number>;
    private currentRule: SyncRule | null = null;

    constructor(scenarios: { rule: SyncRule }[], private readonly remoteName: string) {
        this.totalCounts = scenarios.reduce((acc, s) => {
            acc[s.rule] = (acc[s.rule] || 0) + 1;
            return acc;
        }, {} as Record<SyncRule, number>);

        this.completedCounts = {} as Record<SyncRule, number>;
        const rules = Object.keys(this.totalCounts) as SyncRule[];
        for (const rule of rules) {
            this.completedCounts[rule] = 0;
        }

        let currentLine = 0;
        rules.forEach(rule => {
            this.progressLines.set(rule, currentLine++);
            const action = this.formatAction(rule);
            LogManager.log(LogLevel.Trace, `${action}: ${this.totalCounts[rule]}`);
        });
    }

    private formatAction(rule: SyncRule): string {
        switch (rule) {
            case "LOCAL_TO_REMOTE":
                return Strings.LOCAL_TO_REMOTE;
            case "REMOTE_TO_LOCAL":
                return Strings.REMOTE_TO_LOCAL;
            case "DELETE_LOCAL":
                return Strings.DELETE_LOCAL;
            case "DELETE_REMOTE":
                return Strings.DELETE_REMOTE;
            case "DIFF_MERGE":
                return Strings.DIFF_MERGE;
            default:
                return rule.toLowerCase().replace(/_/g, ' ');
        }
    }

    updateProgress(rule: SyncRule): void {
        this.completedCounts[rule]++;
        const action = this.formatAction(rule);

        const createNewLine = this.currentRule !== rule;
        if (createNewLine) {
            this.currentRule = rule;
        }

        LogManager.log(
            LogLevel.Info,
            `\u00A0\u00A0\u00A0\u00A0${action} ${this.completedCounts[rule]}/${this.totalCounts[rule]}`,
            undefined,
            !createNewLine
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
        const rules = Object.keys(this.totalCounts) as SyncRule[];
        const summaryParts: string[] = [];

        for (const rule of rules) {
            const count = this.totalCounts[rule];
            if (count > 0) {
                summaryParts.push(`${this.formatAction(rule)}: ${count}`);
            }
        }

        return summaryParts.join(', ');
    }
}
