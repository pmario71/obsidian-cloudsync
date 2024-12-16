import { posix } from 'path-browserify';

export class AzurePaths {
    constructor(private containerName: string) {}

    normalizeCloudPath(path: string): string {
        return path.split(/[/\\]/).join('/');
    }

    getBlobUrl(account: string, blobName: string, sasToken: string): string {
        const token = sasToken.startsWith('?') ? sasToken.substring(1) : sasToken;
        return `https://${account}.blob.core.windows.net/${this.containerName}/${blobName}?${token}`;
    }

    getContainerUrl(account: string, sasToken: string, operation?: string): string {
        let url = `https://${account}.blob.core.windows.net/${this.containerName}?restype=container`;

        if (operation === 'list') {
            url += '&comp=list';
        }

        if (sasToken) {
            const token = sasToken.startsWith('?') ? sasToken.substring(1) : sasToken;
            url += `&${token}`;
        }

        return url;
    }

    encodePathProperly(path: string): string {
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
                .replace(/\!/g, '%21')
                .replace(/\*/g, '%2A')
                .replace(/\?/g, '%3F')
                .replace(/\+/g, '%20')
                .replace(/%20/g, '%20');
        }).join('/');
    }

    decodePathProperly(path: string): string {
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
}
