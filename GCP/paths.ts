import { normalizePath } from 'obsidian';
import { encodeCloudPath, decodeCloudPath } from '../sync/pathEncoding';
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";

export class GCPPaths {
    private readonly encodedVaultPrefix: string;
    private readonly normalizedVaultPrefix: string;

    constructor(private readonly vaultPrefix: string) {
        this.normalizedVaultPrefix = normalizePath(vaultPrefix);
        this.encodedVaultPrefix = encodeCloudPath(this.normalizedVaultPrefix);

        LogManager.log(LogLevel.Debug, 'Initialized GCP paths', {
            vaultPrefix: this.vaultPrefix,
            normalized: this.normalizedVaultPrefix,
            encoded: this.encodedVaultPrefix
        });
    }

    normalizeCloudPath(path: string): string {
        return normalizePath(path);
    }

    localToRemoteName(path: string): string {
        const normalized = normalizePath(path);
        const remotePath = encodeCloudPath(normalized);

        LogManager.log(LogLevel.Debug, 'Converted local path to remote:', {
            input: path,
            normalized,
            remotePath
        });

        return remotePath;
    }

    remoteToLocalName(path: string): string {
        return normalizePath(decodeCloudPath(path));
    }

    getVaultPrefix(): string {
        return this.encodedVaultPrefix;
    }

    addVaultPrefix(path: string): string {
        const normalized = normalizePath(path);
        if (normalized === '/') {
            return this.encodedVaultPrefix;
        }
        if (normalized === this.normalizedVaultPrefix) {
            return this.encodedVaultPrefix;
        }
        if (normalized.startsWith(this.normalizedVaultPrefix + '/')) {
            const relativePath = normalized.slice(this.normalizedVaultPrefix.length + 1);
            return `${this.encodedVaultPrefix}/${this.localToRemoteName(relativePath)}`;
        }
        return `${this.encodedVaultPrefix}/${this.localToRemoteName(normalized)}`;
    }

    removeVaultPrefix(path: string): string {
        if (path === this.encodedVaultPrefix) {
            return '/';
        }
        const prefix = `${this.encodedVaultPrefix}/`;
        if (path.startsWith(prefix)) {
            return path.slice(prefix.length);
        }
        return path;
    }

    getObjectUrl(bucket: string, path: string): string {
        const url = new URL('https://storage.googleapis.com');
        const encodedPath = this.localToRemoteName(path);
        const pathSegments = [bucket, ...encodedPath.split('/').filter(Boolean)];

        url.pathname = '/' + pathSegments.join('/');
        LogManager.log(LogLevel.Debug, 'Generated object URL:', {
            bucket,
            path,
            encodedPath,
            url: url.toString()
        });
        return url.toString();
    }

    getBucketUrl(bucket: string): string {
        return `https://storage.googleapis.com/${bucket}`;
    }
}
