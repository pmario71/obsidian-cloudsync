import { encodeURIPath, decodeURIPath } from './encoding';

export class AWSPaths {
    private readonly encodedVaultPrefix: string;

    constructor(private vaultPrefix: string) {
        // Encode the vault prefix once during construction
        this.encodedVaultPrefix = this.localToRemoteName(vaultPrefix);
    }

    /**
     * Converts a local filesystem name to a URI-safe cloud name
     * Uses AWS S3-specific encoding requirements
     */
    localToRemoteName(localPath: string): string {
        // First normalize slashes to forward slashes
        const normalized = localPath.split(/[/\\]/).join('/');
        return encodeURIPath(normalized);
    }

    /**
     * Converts a URI-safe cloud name back to a local filesystem name
     */
    remoteToLocalName(remotePath: string): string {
        // First normalize slashes
        const normalized = remotePath.split(/[/\\]/).join('/');
        return decodeURIPath(normalized);
    }

    /**
     * Ensures path uses consistent forward slashes
     */
    normalizeCloudPath(path: string): string {
        return path.split(/[/\\]/).join('/');
    }

    /**
     * Adds vault prefix to remote path
     */
    addVaultPrefix(remoteName: string): string {
        // First normalize the path
        const normalized = this.normalizeCloudPath(remoteName);

        // If remoteName already has the vault prefix, don't add it again
        if (normalized.startsWith(`${this.encodedVaultPrefix}/`)) {
            return normalized;
        }

        // If remoteName is already a full path, use it as is
        if (normalized.includes('/')) {
            return `${this.encodedVaultPrefix}/${normalized}`;
        }

        return `${this.encodedVaultPrefix}/${normalized}`;
    }

    /**
     * Removes vault prefix from remote path
     */
    removeVaultPrefix(path: string): string {
        const normalized = this.normalizeCloudPath(path);
        const prefix = `${this.encodedVaultPrefix}/`;
        return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
    }

    /**
     * Legacy method kept for compatibility
     * @deprecated Use localToRemoteName instead
     */
    encodePathProperly(path: string): string {
        return this.localToRemoteName(path);
    }
}
