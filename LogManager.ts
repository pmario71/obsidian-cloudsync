import { LogLevel } from "./types";

export class LogManager {
    private static logFunction: (message: string, type?: 'info' | 'error' | 'trace' | 'success' | 'debug') => void =
        () => {}; // Default no-op function

    public static setLogFunction(fn: (message: string, type?: 'info' | 'error' | 'trace' | 'success' | 'debug') => void) {
        LogManager.logFunction = fn;
    }

    private static normalizePath(str: string): string {
        return str.replace(/\\/g, '/');
    }

    private static safeStringify(value: any): string {
        const seen = new WeakSet();

        const process = (val: any): any => {
            // Handle string values - normalize if it looks like a path
            if (typeof val === 'string') {
                return this.normalizePath(val);
            }

            // Handle basic types directly
            if (typeof val !== 'object' || val === null) {
                return val;
            }

            // Handle Error objects specially
            if (val instanceof Error) {
                return {
                    name: val.name,
                    message: this.normalizePath(val.message),
                    stack: this.normalizePath(val.stack || '')
                };
            }

            // Handle circular references
            if (seen.has(val)) {
                return '[Circular]';
            }
            seen.add(val);

            // Handle AWS SDK objects specially
            if (val.constructor) {
                if (val.constructor.name.includes('Command')) {
                    return `[AWS ${val.constructor.name}]`;
                }
                if (val.constructor.name === 'S3Client') {
                    return '[AWS S3Client]';
                }
            }

            // For arrays, process each value
            if (Array.isArray(val)) {
                return val.map(v => process(v));
            }

            // For objects, process each value
            const obj: any = {};
            const entries = Object.entries(val).filter(([k, v]) => typeof v !== 'function' && !k.startsWith('_'));

            // If object has only one property and it's a path-like string, return its value directly
            if (entries.length === 1 && typeof entries[0][1] === 'string' &&
                (entries[0][1].includes('/') || entries[0][1].includes('\\'))) {
                return process(entries[0][1]);
            }

            // Otherwise process all properties
            for (const [k, v] of entries) {
                obj[k] = process(v);
            }
            return obj;
        };

        const processed = process(value);
        return typeof processed === 'object' ? JSON.stringify(processed) : String(processed);
    }

    public static log(level: LogLevel, message: string, data?: any): void {
        let logMessage = this.normalizePath(message);
        let logType: 'info' | 'error' | 'trace' | 'success' | 'debug';

        // Add data to message if provided
        if (data !== undefined) {
            try {
                logMessage += ` ${this.safeStringify(data)}`;
            } catch (e) {
                logMessage += ` [Unable to stringify data: ${e.message}]`;
            }
        }

        // Map LogLevel to log type
        switch (level) {
            case LogLevel.None:
                return; // Don't log anything for None level
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

        // Let main.ts handle the log level filtering
        LogManager.logFunction(logMessage, logType);
    }
}
