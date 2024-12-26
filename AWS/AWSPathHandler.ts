import { CloudPathHandler } from '../sync/CloudPathHandler';
import { LogManager } from '../LogManager';
import { LogLevel } from '../sync/types';

export class AWSPathHandler extends CloudPathHandler {
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

        // First decode any XML entities (e.g., &#x12; -> \x12)
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
