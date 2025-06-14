import { normalizePath } from 'obsidian';
import { LogManager } from '../LogManager';
import { LogLevel } from './types';
import { encodeCloudPath, decodeCloudPath } from './pathEncoding';

export abstract class CloudPathHandler {
    protected readonly normalizedVaultPrefix: string;

    constructor(protected readonly vaultPrefix: string) {
        this.normalizedVaultPrefix = normalizePath(vaultPrefix);
        LogManager.log(LogLevel.Debug, `Initialized ${this.getProviderName()} paths`, {
            vaultPrefix: this.vaultPrefix,
            normalized: this.normalizedVaultPrefix
        });
    }
    protected abstract getProviderName(): string;
    
    getVaultPrefix(): string {
        return this.normalizedVaultPrefix;
    }

    normalizeCloudPath(path: string): string {
        return normalizePath(path);
    }

    addVaultPrefix(path: string): string {
        const normalized = normalizePath(path);
        if (normalized === '/') {
            return this.normalizedVaultPrefix;
        }
        if (normalized === this.normalizedVaultPrefix) {
            return this.normalizedVaultPrefix;
        }
        if (normalized.startsWith(this.normalizedVaultPrefix + '/')) {
            return normalized;
        }
        return `${this.normalizedVaultPrefix}/${normalized}`;
    }

    removeVaultPrefix(path: string): string {
        if (path === this.normalizedVaultPrefix) {
            return '/';
        }
        const prefix = `${this.normalizedVaultPrefix}/`;
        if (path.startsWith(prefix)) {
            return path.slice(prefix.length);
        }
        return path;
    }

    localToRemoteName(path: string): string {
        if (!path) {
            LogManager.log(LogLevel.Debug, 'Empty path in localToRemoteName');
            return '';
        }

        const normalized = normalizePath(path);
        LogManager.log(LogLevel.Debug, 'Local to remote path conversion', {
            original: path,
            normalized
        });

        return normalized;
    }
    
    remoteToLocalName(path: string): string {
        if (!path) {
            LogManager.log(LogLevel.Debug, 'Empty path in remoteToLocalName');
            return '';
        }

        const decoded = this.decodeRemotePath(path);
        const normalized = normalizePath(decoded);

        LogManager.log(LogLevel.Debug, 'Remote to local path conversion', {
            original: path,
            decoded,
            normalized
        });

        return normalized;
    }
    protected encodePath(path: string): string {
        return encodeCloudPath(path);
    }
    protected decodeRemotePath(path: string): string {
        return decodeCloudPath(path);
    }

    abstract getObjectUrl(bucket: string, path: string): string;
    abstract getContainerUrl(bucket: string): string;
}
