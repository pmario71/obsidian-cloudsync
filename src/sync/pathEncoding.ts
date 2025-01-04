export function encodeCloudPath(path: string): string {
    const segments = path.split('/');
    const encodedSegments = segments.map(segment => {
        if (!segment) return '';

        let result = '';
        for (let i = 0; i < segment.length; ) {
            const char = segment[i];
            if (isPercentEncoded(segment, i)) {
                result += char + segment[i + 1] + segment[i + 2];
                i += 3;
                continue;
            }

            result += encodeChar(char);
            i++;
        }
        return result;
    });

    const encodedPath = encodedSegments.join('/');
    return encodedPath;
}

function isPercentEncoded(segment: string, i: number): boolean {
    return segment[i] === '%' && i + 2 < segment.length &&
           /^[0-9A-Fa-f]{2}$/.test(segment[i + 1] + segment[i + 2]);
}

function encodeChar(char: string): string {
    switch (char) {
        case '%': return '%25';
        case ' ': return '%20';
        case '!': return '%21';
        case "'": return '%27';
        case '(': return '%28';
        case ')': return '%29';
        case '*': return '%2A';
        case '~': return '~';
        default:
            return /[A-Za-z0-9\-._]/.test(char) ? char : encodeURIComponent(char);
    }
}

export function decodeCloudPath(path: string): string {
    const segments = path.split('/');
    const decodedSegments = segments.map(segment => {
        if (!segment) return '';
        try {
            return decodeURIComponent(segment);
        } catch (e) {
            return segment;
        }
    });
    return decodedSegments.join('/');
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
