import { posix } from 'path-browserify';

export class AzurePaths {
    constructor(private containerName: string) {}

    normalizeCloudPath(path: string): string {
        // Always use forward slashes for cloud paths
        return path.split(/[/\\]/).join('/');
    }

    getBlobUrl(account: string, blobName: string, sasToken: string): string {
        // Ensure the sasToken doesn't start with '?' since we add it
        const token = sasToken.startsWith('?') ? sasToken.substring(1) : sasToken;
        return `https://${account}.blob.core.windows.net/${this.containerName}/${blobName}?${token}`;
    }

    getContainerUrl(account: string, sasToken: string, operation?: string): string {
        // Start with base URL
        let url = `https://${account}.blob.core.windows.net/${this.containerName}?restype=container`;

        // Add operation if specified
        if (operation === 'list') {
            url += '&comp=list';
        }

        // Add SAS token if provided, ensuring we don't duplicate the '?'
        if (sasToken) {
            const token = sasToken.startsWith('?') ? sasToken.substring(1) : sasToken;
            url += `&${token}`;
        }

        return url;
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
                // Fix specific characters according to Azure Blob requirements
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
            // Handle Azure Blob specific encodings first
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
}
