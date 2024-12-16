import { encodeURIPath, decodeURIPath } from './encoding';

export class AWSPaths {
    private readonly encodedVaultPrefix: string;

    constructor(private readonly vaultPrefix: string) {
        this.encodedVaultPrefix = this.localToRemoteName(vaultPrefix);
    }

    localToRemoteName(localPath: string): string {
        const normalized = localPath.split(/[/\\]/).join('/');
        return encodeURIPath(normalized);
    }

    remoteToLocalName(remotePath: string): string {
        const normalized = remotePath.split(/[/\\]/).join('/');
        return decodeURIPath(normalized);
    }

    normalizeCloudPath(path: string): string {
        return path.split(/[/\\]/).join('/');
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
        return this.localToRemoteName(path);
    }
}
