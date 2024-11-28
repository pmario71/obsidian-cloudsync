export class AWSPaths {
    private readonly encodedVaultPrefix: string;

    constructor(private vaultPrefix: string) {
        // Encode the vault prefix once during construction
        this.encodedVaultPrefix = this.localToRemoteName(vaultPrefix);
    }

    /**
     * Converts a local filesystem name to a URI-safe cloud name
     * Handles multiple encoding prevention and preserves path structure
     */
    localToRemoteName(localPath: string): string {
        // First normalize slashes to forward slashes
        const normalized = localPath.split(/[/\\]/).join('/');

        // Split path into segments and encode each segment individually
        return normalized.split('/').map(segment => {
            if (!segment) return '';

            // If segment is already encoded, don't encode it again
            if (/%[0-9A-F]{2}/i.test(segment)) {
                return segment;
            }

            // Encode the segment if it's not already encoded
            return encodeURIComponent(segment);
        }).join('/');
    }

    /**
     * Converts a URI-safe cloud name back to a local filesystem name
     * Handles multiple decoding prevention
     */
    remoteToLocalName(remotePath: string): string {
        // First normalize slashes
        const normalized = remotePath.split(/[/\\]/).join('/');

        // Split path and decode each segment
        return normalized.split('/').map(segment => {
            if (!segment) return '';

            try {
                // Only decode if it's actually encoded
                return /%[0-9A-F]{2}/i.test(segment) ? decodeURIComponent(segment) : segment;
            } catch {
                // If decoding fails, return as-is
                return segment;
            }
        }).join('/');
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
