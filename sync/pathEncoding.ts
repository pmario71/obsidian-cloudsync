export function encodeCloudPath(path: string): string {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(path);
    } catch {
        decodedPath = path;
    }

    return decodedPath.split('/').map(segment => {
        if (!segment) return '';

        return encodeURIComponent(segment)
            .replace(/~/g, '%7E')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/!/g, '%21')
            .replace(/\*/g, '%2A')
            .replace(/\?/g, '%3F')
            .replace(/\+/g, '%20')
            .replace(/%20/g, '%20');
    }).join('/');
}

export function decodeCloudPath(path: string): string {
    try {
        let decoded = path
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
        return path;
    }
}

export function addPrefix(path: string, prefix: string): string {
    if (path.startsWith(prefix)) {
        return path;
    }
    return `${prefix}/${path}`;
}

export function removePrefix(path: string, prefix: string): string {
    const fullPrefix = `${prefix}/`;
    return path.startsWith(fullPrefix) ? path.slice(fullPrefix.length) : path;
}
