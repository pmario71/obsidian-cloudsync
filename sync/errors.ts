export class CloudSyncError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CloudSyncError';
    }
}

export class AuthenticationError extends CloudSyncError {
    constructor(provider: string, details?: string) {
        const detailsMessage = details ? `: ${details}` : '';
        super(`Authentication failed for ${provider}${detailsMessage}`);
        this.name = 'AuthenticationError';
    }
}

export class ConnectivityError extends CloudSyncError {
    constructor(provider: string, details?: string) {
        const detailsMessage = details ? `: ${details}` : '';
        super(`Connection failed to ${provider}${detailsMessage}`);
        this.name = 'ConnectivityError';
    }
}

export class SyncError extends CloudSyncError {
    constructor(operation: string, details?: string) {
        const detailsMessage = details ? `: ${details}` : '';
        super(`Sync operation failed during ${operation}${detailsMessage}`);
        this.name = 'SyncError';
    }
}

export class FileOperationError extends CloudSyncError {
    constructor(operation: 'read' | 'write' | 'delete', path: string, details?: string) {
        const detailsMessage = details ? `: ${details}` : '';
        super(`File ${operation} failed for ${path}${detailsMessage}`);
        this.name = 'FileOperationError';
    }
}

export class ConfigurationError extends CloudSyncError {
    constructor(setting: string, details?: string) {
        const detailsMessage = details ? `: ${details}` : '';
        super(`Invalid configuration for ${setting}${detailsMessage}`);
        this.name = 'ConfigurationError';
    }
}

export class CacheError extends CloudSyncError {
    constructor(operation: string, details?: string) {
        const detailsMessage = details ? `: ${details}` : '';
        super(`Cache operation failed during ${operation}${detailsMessage}`);
        this.name = 'CacheError';
    }
}
