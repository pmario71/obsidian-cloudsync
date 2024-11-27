export class AWSPaths {
    constructor(private vaultPrefix: string) {}

    normalizeCloudPath(path: string): string {
        // First decode if already encoded
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(path);
        } catch {
            decodedPath = path;
        }
        // Always use forward slashes for cloud paths
        return decodedPath.split(/[/\\]/).join('/');
    }

    addVaultPrefix(remoteName: string): string {
        // First decode if already encoded
        const decodedName = this.normalizeCloudPath(remoteName);

        // Always use "testing" as the vault prefix for paths
        const prefix = "testing";

        // If remoteName already has the vault prefix, don't add it again
        if (decodedName.startsWith(`${prefix}/`)) {
            return decodedName;
        }
        // If remoteName is already a full path (e.g., testing/assets/file.jpg), use it as is
        if (decodedName.includes('/')) {
            return `${prefix}/${decodedName}`;
        }
        return `${prefix}/${decodedName}`;
    }

    removeVaultPrefix(path: string): string {
        // First decode if already encoded
        const decodedPath = this.normalizeCloudPath(path);
        const prefix = "testing/";
        return decodedPath.startsWith(prefix) ? decodedPath.slice(prefix.length) : decodedPath;
    }

    encodePathProperly(path: string): string {
        // First normalize to ensure consistent slashes and decode any existing encoding
        const normalizedPath = this.normalizeCloudPath(path);
        // Then encode each path segment, preserving slashes
        return normalizedPath.split('/').map(segment =>
            segment ? encodeURIComponent(segment) : ''
        ).join('/');
    }
}
