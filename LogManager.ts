import { LogLevel } from "./types";

export class LogManager {
    private static logFunction: (message: string, type?: 'info' | 'error' | 'trace' | 'success' | 'debug') => void =
        () => {}; // Default no-op function

    public static setLogFunction(fn: (message: string, type?: 'info' | 'error' | 'trace' | 'success' | 'debug') => void) {
        LogManager.logFunction = fn;
    }

    private static safeStringify(obj: any): string {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
            // Handle basic types directly
            if (typeof value !== 'object' || value === null) {
                return value;
            }

            // Handle Error objects specially
            if (value instanceof Error) {
                return {
                    name: value.name,
                    message: value.message,
                    stack: value.stack
                };
            }

            // Handle circular references
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);

            // Handle AWS SDK objects specially
            if (value.constructor && value.constructor.name.includes('Command')) {
                return `[AWS ${value.constructor.name}]`;
            }
            if (value.constructor && value.constructor.name === 'S3Client') {
                return '[AWS S3Client]';
            }

            // For other objects, try to include safe properties
            const safeObj: any = {};
            for (const prop in value) {
                try {
                    if (typeof value[prop] !== 'function' && !prop.startsWith('_')) {
                        safeObj[prop] = value[prop];
                    }
                } catch (e) {
                    // Skip properties that can't be accessed
                }
            }
            return safeObj;
        });
    }

    public static log(level: LogLevel, message: string, data?: any): void {
        let logMessage = message;
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
