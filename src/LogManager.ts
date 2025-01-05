import { LogLevel } from "./sync/types";
import { normalizePath, Notice } from "obsidian";

type LogType = 'info' | 'error' | 'trace' | 'success' | 'debug' | 'delimiter';

export class LogManager {
    private static logFunction: (message: string, type?: LogType, update?: boolean, important?: boolean) => void =
        () => {};

    public static setLogFunction(fn: (message: string, type?: LogType, update?: boolean, important?: boolean) => void): void {
        LogManager.logFunction = fn;
    }

    private static safeStringify(value: unknown): string {
        const seen = new WeakSet();

        const process = (val: unknown): unknown => {
            if (typeof val === 'string') {
                return val;
            }

            if (typeof val !== 'object' || val === null) {
                return val;
            }

            if (val instanceof Error) {
                return {
                    name: val.name,
                    message: normalizePath(val.message),
                    stack: normalizePath(val.stack ?? '')
                };
            }

            if (seen.has(val)) {
                return '[Circular]';
            }
            seen.add(val);

            if (val.constructor) {
                if (val.constructor.name.includes('Command')) {
                    return `[S3 ${val.constructor.name}]`;
                }
                if (val.constructor.name === 'S3Client') {
                    return '[S3 Client]';
                }
            }

            if (Array.isArray(val)) {
                return val.map(v => process(v));
            }

            const obj: Record<string, unknown> = {};
            if (typeof val === 'object' && val !== null) {
                const keys = Object.keys(val).filter(k => {
                    const value = (val as Record<string, unknown>)[k];
                    return typeof value !== 'function' && !k.startsWith('_');
                });

                if (keys.length === 1) {
                    return process((val as Record<string, unknown>)[keys[0]]);
                }

                for (const key of keys) {
                    obj[key] = process((val as Record<string, unknown>)[key]);
                }
            }
            return obj;
        };

        const processed = process(value);
        return typeof processed === 'object' ? JSON.stringify(processed) : String(processed);
    }

    public static log(level: LogLevel, message: string, data?: unknown, update?: boolean, important?: boolean): void {
        let logMessage = normalizePath(message);
        let logType: Exclude<LogType, 'delimiter'>;

        if (data !== undefined) {
            try {
                logMessage += ` ${this.safeStringify(data)}`;
            } catch (e) {
                logMessage += ` [Unable to stringify data: ${e.message}]`;
            }
        }

        switch (level) {
            case LogLevel.None:
                return;
            case LogLevel.Error:
                logType = 'error';
                break;
            case LogLevel.Info:
                logType = 'info';
                break;
            case LogLevel.Trace:
                logType = 'trace';
                break;
            case LogLevel.Debug:
                logType = 'debug';
                break;
            default:
                logType = 'info';
        }

        LogManager.logFunction(logMessage, logType, update, important);
    }

    public static addDelimiter(): void {
        LogManager.logFunction('', 'delimiter');
    }
}

export function showNotice(message: string): Notice {
    return new Notice(message);
}
