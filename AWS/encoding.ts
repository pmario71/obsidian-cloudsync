/**
 * Encodes URI path according to AWS S3 requirements
 * Handles special characters consistently across the application
 */
export function encodeURIPath(uri: string): string {
    // First decode any existing encoding to prevent double-encoding
    let decodedUri;
    try {
        decodedUri = decodeURIComponent(uri);
    } catch {
        decodedUri = uri;
    }

    // Split path into segments and encode each segment
    return decodedUri.split('/').map(segment => {
        if (!segment) return '';

        // First encode all special characters
        return encodeURIComponent(segment)
            // Fix specific characters according to AWS S3 requirements
            .replace(/~/g, '%7E')    // AWS expects tilde to be encoded
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

/**
 * Decodes a URI-safe cloud name back to a local filesystem name
 */
export function decodeURIPath(remotePath: string): string {
    try {
        // Handle AWS S3 specific encodings first
        let decoded = remotePath
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
        return remotePath;
    }
}
