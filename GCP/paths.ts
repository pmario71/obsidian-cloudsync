import { posix } from 'path-browserify';

export class GCPPaths {
    private readonly encodedVaultPrefix: string;

    constructor(private vaultPrefix: string) {
        this.encodedVaultPrefix = this.localToRemoteName(vaultPrefix);
    }

    localToRemoteName(localPath: string): string {
        const normalized = localPath.split(/[/\\]/).join('/');
        return this.encodePathProperly(normalized);
    }

    remoteToLocalName(remotePath: string): string {
        const normalized = remotePath.split(/[/\\]/).join('/');
        return this.decodePathProperly(normalized);
    }

    normalizeCloudPath(path: string): string {
        return path.split(/[/\\]/).join('/');
    }

    getVaultPrefix(): string {
        return this.vaultPrefix;
    }

    addVaultPrefix(remoteName: string): string {
        const normalized = this.normalizeCloudPath(remoteName);

        if (normalized.startsWith(`${this.encodedVaultPrefix}/`)) {
            return normalized;
        }

        if (normalized.includes('/')) {
            return `${this.encodedVaultPrefix}/${normalized}`;
        }

        return `${this.encodedVaultPrefix}/${normalized}`;
    }

    removeVaultPrefix(path: string): string {
        const normalized = this.normalizeCloudPath(path);
        const prefix = `${this.encodedVaultPrefix}/`;
        return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
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

    getObjectUrl(bucket: string, path: string): string {
        return `https://${bucket}.storage.googleapis.com/${this.encodePathProperly(path)}`;
    }

    getBucketUrl(bucket: string): string {
        return `https://${bucket}.storage.googleapis.com`;
    }
}
