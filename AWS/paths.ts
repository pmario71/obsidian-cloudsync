import { encodeURIPath, decodeURIPath } from './encoding';
import { normalizePath } from 'obsidian';

export class AWSPaths {
    private readonly encodedVaultPrefix: string;

    constructor(private readonly vaultPrefix: string) {
        this.encodedVaultPrefix = encodeURIPath(normalizePath(vaultPrefix));
    }

    localToRemoteName(path: string): string {
        return encodeURIPath(normalizePath(path));
    }

    remoteToLocalName(path: string): string {
        return normalizePath(decodeURIPath(path));
    }

    addVaultPrefix(path: string): string {
        const normalized = normalizePath(path);
        if (normalized.startsWith(this.encodedVaultPrefix)) {
            return normalized;
        }
        return `${this.encodedVaultPrefix}/${normalized}`;
    }

    removeVaultPrefix(path: string): string {
        const normalized = normalizePath(path);
        const prefix = `${this.encodedVaultPrefix}/`;
        return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
    }
}
