import { normalizePath } from 'obsidian';
import { encodeCloudPath, decodeCloudPath } from '../sync/pathEncoding';

export class AzurePaths {
    constructor(private readonly containerName: string) {}

    normalizeCloudPath(path: string): string {
        return normalizePath(path);
    }

    getBlobUrl(account: string, blobName: string, sasToken: string): string {
        const token = sasToken.startsWith('?') ? sasToken.substring(1) : sasToken;
        const encodedBlobName = encodeCloudPath(normalizePath(blobName));
        return `https://${account}.blob.core.windows.net/${this.containerName}/${encodedBlobName}?${token}`;
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
        return encodeCloudPath(normalizePath(path));
    }

    decodePathProperly(path: string): string {
        return decodeCloudPath(path);
    }
}
