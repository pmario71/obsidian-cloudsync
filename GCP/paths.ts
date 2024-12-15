import { posix } from 'path-browserify';

export class GCPPaths {
    private readonly encodedVaultPrefix: string;

    constructor(private vaultPrefix: string) {
        // Encode the vault prefix once during construction using the same encoding as paths
        this.encodedVaultPrefix = this.localToRemoteName(vaultPrefix);
    }

    /**
     * Converts a local filesystem name to a GCP Storage compatible name
     */
    localToRemoteName(localPath: string): string {
        // First normalize slashes to forward slashes
        const normalized = localPath.split(/[/\\]/).join('/');
        return this.encodePathProperly(normalized);
    }

    /**
     * Converts a GCP Storage name back to a local filesystem name
     */
    remoteToLocalName(remotePath: string): string {
        // First normalize slashes
        const normalized = remotePath.split(/[/\\]/).join('/');
        return this.decodePathProperly(normalized);
    }

    /**
     * Ensures path uses consistent forward slashes
     */
    normalizeCloudPath(path: string): string {
        // Always use forward slashes for cloud paths, don't use platform-specific separators
        return path.split(/[/\\]/).join('/');
    }

    /**
     * Get the raw vault prefix (unencoded)
     */
    getVaultPrefix(): string {
        return this.vaultPrefix;
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

        // If remoteName is already a full path, add prefix
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

    encodePathProperly(path: string): string {
        // First decode any existing encoding to prevent double-encoding
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(path);
        } catch {
            decodedPath = path;
        }

        // Split path into segments and encode each segment
        return decodedPath.split('/').map(segment => {
            if (!segment) return '';

            // First encode all special characters
            return encodeURIComponent(segment)
                // Fix specific characters according to GCP Storage requirements
                .replace(/~/g, '%7E')    // Tilde
                .replace(/'/g, '%27')    // Single quote
                .replace(/\(/g, '%28')   // Opening parenthesis
                .replace(/\)/g, '%29')   // Closing parenthesis
                .replace(/\!/g, '%21')   // Exclamation mark
                .replace(/\*/g, '%2A')   // Asterisk
                .replace(/\?/g, '%3F')   // Question mark
                .replace(/\+/g, '%20')   // Convert + back to %20 for spaces
                .replace(/%20/g, '%20'); // Ensure consistent space encoding
        }).join('/');
    }

    decodePathProperly(path: string): string {
        try {
            // Handle GCP Storage specific encodings first
            let decoded = path
                .replace(/%20/g, ' ')    // Space
                .replace(/%21/g, '!')    // Exclamation mark
                .replace(/%27/g, "'")    // Single quote
                .replace(/%28/g, '(')    // Opening parenthesis
                .replace(/%29/g, ')')    // Closing parenthesis
                .replace(/%2A/g, '*')    // Asterisk
                .replace(/%3F/g, '?')    // Question mark
                .replace(/%7E/g, '~');   // Tilde

            // Then decode any remaining percent-encoded characters
            return decodeURIComponent(decoded);
        } catch {
            // If decoding fails, return as-is
            return path;
        }
    }

    getObjectUrl(bucket: string, path: string): string {
        return `https://${bucket}.storage.googleapis.com/${this.encodePathProperly(path)}`;
    }

    getBucketUrl(bucket: string): string {
        return `https://${bucket}.storage.googleapis.com`;
    }
}
