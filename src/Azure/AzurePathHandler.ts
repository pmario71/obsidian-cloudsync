import { CloudPathHandler } from '../sync/CloudPathHandler';
import { LogManager } from '../LogManager';
import { LogLevel } from '../sync/types';
import { IAzurePaths } from './types';

export class AzurePathHandler extends CloudPathHandler implements IAzurePaths {
    private account = '';
    private sasToken = '';

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
        return path;
    }

    encodePathProperly(path: string): string {
        return this.encodePath(path);
    }

    decodePathProperly(path: string): string {
        return this.decodeRemotePath(path);
    }

    setCredentials(account: string, sasToken: string): void {
        this.account = account;
        this.sasToken = sasToken;
    }

    getBlobUrl(account: string, blobName: string, sasToken: string): string {
        const token = sasToken.startsWith('?') ? sasToken.substring(1) : sasToken;
        const encodedContainer = this.encodePath(this.containerName);
        const encodedBlobName = encodeURIComponent(blobName);
        const url = `https://${account}.blob.core.windows.net/${encodedContainer}/${encodedBlobName}?${token}`;

        LogManager.log(LogLevel.Trace, `Generated Azure URL for blob: ${blobName} -> ${url}`);
        return url;
    }

    getAzureContainerUrl(account: string, sasToken: string, operation?: string): string {
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

    // Implement base class abstract methods
    override getObjectUrl(_bucket: string, path: string): string {
        if (!this.account || !this.sasToken) {
            throw new Error('Azure credentials not set. Call setCredentials first.');
        }
        return this.getBlobUrl(this.account, path, this.sasToken);
    }

    override getContainerUrl(_bucket: string): string {
        if (!this.account || !this.sasToken) {
            throw new Error('Azure credentials not set. Call setCredentials first.');
        }
        return this.getAzureContainerUrl(this.account, this.sasToken);
    }
}
