import { CloudPathHandler } from '../sync/CloudPathHandler';
import { LogManager } from '../LogManager';
import { LogLevel } from '../sync/types';

export class AWSPathHandler extends CloudPathHandler {
    protected readonly encodedVaultPrefix: string;

    constructor(vaultPrefix: string) {
        super(vaultPrefix);
        this.encodedVaultPrefix = this.normalizedVaultPrefix;
        LogManager.log(LogLevel.Debug, 'Initialized AWS paths', {
            vaultPrefix,
            normalized: this.normalizedVaultPrefix,
            encoded: this.encodedVaultPrefix,
            hex: [...this.encodedVaultPrefix].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        });
    }

    protected getProviderName(): string {
        return 'AWS';
    }

    private decodeXMLEntities(text: string): string {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    override remoteToLocalName(path: string): string {
        if (!path) {
            LogManager.log(LogLevel.Debug, 'Empty path in remoteToLocalName');
            return '';
        }

        const decodedXML = this.decodeXMLEntities(path);
        LogManager.log(LogLevel.Debug, 'Decoded XML entities', {
            original: path,
            decodedXML
        });

        return super.remoteToLocalName(decodedXML);
    }

    getObjectUrl(bucket: string, path: string): string {
        const encodedPath = this.encodePath(path);
        return `https://${bucket}.s3.amazonaws.com/${encodedPath}`;
    }

    getContainerUrl(bucket: string): string {
        return `https://${bucket}.s3.amazonaws.com`;
    }
}
