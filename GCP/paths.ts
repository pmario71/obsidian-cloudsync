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
