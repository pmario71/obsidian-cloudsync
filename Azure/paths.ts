import { posix } from 'path';

export class AzurePaths {
    constructor(private containerName: string) {}

    normalizeCloudPath(path: string): string {
        // Ensure consistent forward slash usage for cloud paths
        return path.split('/').join(posix.sep);
    }

    getBlobUrl(account: string, blobName: string, sasToken: string): string {
        return `https://${account}.blob.core.windows.net/${this.containerName}/${blobName}?${sasToken}`;
    }

    getContainerUrl(account: string, sasToken: string, operation?: string): string {
        let url = `https://${account}.blob.core.windows.net/${this.containerName}?restype=container`;

        if (operation === 'list') {
            url += '&comp=list';
        }

        if (sasToken) {
            url += `&${sasToken}`;
        }

        return url;
    }

    encodePathProperly(path: string): string {
        return encodeURIComponent(path).replace(/%2F/g, '/');
    }

    decodePathProperly(path: string): string {
        try {
            return decodeURIComponent(path);
        } catch {
            return path;
        }
    }
}
