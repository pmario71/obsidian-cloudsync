import { posix } from 'path';

export class GCPPaths {
    constructor(private vaultPrefix: string) {}

    normalizeCloudPath(path: string): string {
        // Ensure consistent forward slash usage for cloud paths
        return path.split('/').join(posix.sep);
    }

    addVaultPrefix(remoteName: string): string {
        // If remoteName already has the vault prefix, don't add it again
        if (remoteName.startsWith(`${this.vaultPrefix}/`)) {
            return remoteName;
        }
        // If remoteName is already a full path (e.g., testing/assets/file.jpg), use it as is
        if (remoteName.includes('/')) {
            return remoteName;
        }
        return `${this.vaultPrefix}/${remoteName}`;
    }

    removeVaultPrefix(path: string): string {
        const prefix = `${this.vaultPrefix}/`;
        return path.startsWith(prefix) ? path.slice(prefix.length) : path;
    }

    encodePathProperly(path: string): string {
        return encodeURIComponent(path).replace(/%2F/g, '/');
    }

    getObjectUrl(bucket: string, path: string): string {
        return `https://${bucket}.storage.googleapis.com/${this.encodePathProperly(path)}`;
    }

    getBucketUrl(bucket: string): string {
        return `https://${bucket}.storage.googleapis.com`;
    }
}
