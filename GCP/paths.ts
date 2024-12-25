import { normalizePath } from 'obsidian';
import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";

export class GCPPaths {
    private readonly normalizedVaultPrefix: string;

    constructor(private readonly vaultPrefix: string) {
        this.normalizedVaultPrefix = normalizePath(vaultPrefix);
        LogManager.log(LogLevel.Debug, 'Initialized GCP paths', {
            vaultPrefix: this.vaultPrefix,
            normalized: this.normalizedVaultPrefix
        });
    }

    normalizeCloudPath(path: string): string {
        // Just normalize path separators, don't decode
        return normalizePath(path);
    }

    getVaultPrefix(): string {
        return this.normalizedVaultPrefix;
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

    encodePathForGCP(path: string): string {
        // Encode path for GCP URL
        const encoded = encodeURIComponent(path);
        LogManager.log(LogLevel.Trace, `Encoded path for GCP: ${path} -> ${encoded}`);
        return encoded;
    }

    getObjectUrl(bucket: string, path: string): string {
        const url = new URL('https://storage.googleapis.com');
        const encodedPath = this.encodePathForGCP(path);
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
