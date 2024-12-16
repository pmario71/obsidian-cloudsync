export function encodeURIPath(uri: string): string {
    let decodedUri;
    try {
        decodedUri = decodeURIComponent(uri);
    } catch {
        decodedUri = uri;
    }

    return decodedUri.split('/').map(segment => {
        if (!segment) return '';

        return encodeURIComponent(segment)
            .replace(/~/g, '%7E')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\!/g, '%21')
            .replace(/\*/g, '%2A')
            .replace(/\?/g, '%3F')
            .replace(/\+/g, '%20')
            .replace(/%20/g, '%20');
    }).join('/');
}

export function decodeURIPath(remotePath: string): string {
    try {
        let decoded = remotePath
            .replace(/%20/g, ' ')
            .replace(/%21/g, '!')
            .replace(/%27/g, "'")
            .replace(/%28/g, '(')
            .replace(/%29/g, ')')
            .replace(/%2A/g, '*')
            .replace(/%3F/g, '?')
            .replace(/%7E/g, '~');

        return decodeURIComponent(decoded);
    } catch {
        return remotePath;
    }
}
