import { normalizePath } from 'obsidian';
import { encodeCloudPath, decodeCloudPath, addPrefix, removePrefix } from '../sync/pathEncoding';

export class GCPPaths {
    private readonly encodedVaultPrefix: string;

    constructor(private vaultPrefix: string) {
        this.encodedVaultPrefix = encodeCloudPath(normalizePath(vaultPrefix));
    }

    normalizeCloudPath(path: string): string {
        return normalizePath(path);
    }

    localToRemoteName(path: string): string {
        return encodeCloudPath(normalizePath(path));
    }

    remoteToLocalName(path: string): string {
        return normalizePath(decodeCloudPath(path));
    }

    getVaultPrefix(): string {
        return this.vaultPrefix;
    }

    addVaultPrefix(path: string): string {
        return addPrefix(normalizePath(path), this.encodedVaultPrefix);
    }

    removeVaultPrefix(path: string): string {
        return removePrefix(normalizePath(path), this.encodedVaultPrefix);
    }

    getObjectUrl(bucket: string, path: string): string {
        const encodedPath = encodeCloudPath(normalizePath(path));
        return `https://${bucket}.storage.googleapis.com/${encodedPath}`;
    }

    getBucketUrl(bucket: string): string {
        return `https://${bucket}.storage.googleapis.com`;
    }
}
