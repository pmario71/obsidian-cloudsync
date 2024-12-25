export function encodeCloudPath(path: string): string {
    const segments = path.split('/');
    const encodedSegments = segments.map(segment => {
        if (!segment) return '';

        // Process the segment character by character
        let result = '';
        for (let i = 0; i < segment.length; i++) {
            const char = segment[i];

            // If this is a percent sign followed by two hex digits, keep it as-is
            if (char === '%' && i + 2 < segment.length &&
                /^[0-9A-Fa-f]{2}$/.test(segment[i + 1] + segment[i + 2])) {
                result += char + segment[i + 1] + segment[i + 2];
                i += 2;
                continue;
            }

            // Otherwise encode the character
            if (char === '%') {
                result += '%25';
            } else if (char === ' ') {
                result += '%20';
            } else if (char === '!') {
                result += '%21';
            } else if (char === "'") {
                result += '%27';
            } else if (char === '(') {
                result += '%28';
            } else if (char === ')') {
                result += '%29';
            } else if (char === '*') {
                result += '%2A';
            } else if (char === '~') {
                result += '~';  // preserve ~ per RFC3986
            } else if (/[A-Za-z0-9\-\._]/.test(char)) {
                result += char;
            } else {
                result += encodeURIComponent(char);
            }
        }
        return result;
    });

    const encodedPath = encodedSegments.join('/');
    return encodedPath;
}

export function decodeCloudPath(path: string): string {
    // For paths from cloud storage, we want to preserve the exact encoding
    // This ensures literal percent signs and encoded characters stay as-is
    return path;
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
