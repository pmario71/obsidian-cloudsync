import { CloudPathHandler } from '../sync/CloudPathHandler';
import { LogManager } from '../LogManager';
import { LogLevel } from '../sync/types';

export class AzurePathHandler extends CloudPathHandler {
    constructor(
        vaultPrefix: string,
        private readonly containerName: string
    ) {
        super(vaultPrefix);
    }

    protected getProviderName(): string {
        return 'Azure';
    }

    protected override decodeRemotePath(path: string): string {
        // Azure paths are literal filenames, no decoding needed
        return path;
    }

    getObjectUrl(account: string, blobName: string, sasToken: string): string {
        const token = sasToken.startsWith('?') ? sasToken.substring(1) : sasToken;
        const encodedContainer = this.encodePath(this.containerName);
        const encodedBlobName = encodeURIComponent(blobName);
        const url = `https://${account}.blob.core.windows.net/${encodedContainer}/${encodedBlobName}?${token}`;

        LogManager.log(LogLevel.Trace, `Generated Azure URL for blob: ${blobName} -> ${url}`);
        return url;
    }

    getContainerUrl(account: string, sasToken: string, operation?: string): string {
        const encodedContainer = this.encodePath(this.containerName);
        const baseUrl = `https://${account}.blob.core.windows.net/${encodedContainer}?restype=container`;
        const parts = [];

        if (operation === 'list') {
            parts.push('comp=list');
        }

        if (sasToken) {
            const token = sasToken.startsWith('?') ? sasToken.substring(1) : sasToken;
            parts.push(token);
        }

        return parts.length > 0 ? baseUrl + '&' + parts.join('&') : baseUrl;
    }
}
