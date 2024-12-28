import { CloudPathHandler } from '../sync/CloudPathHandler';
import { LogManager } from '../LogManager';
import { LogLevel } from '../sync/types';

export class GCPPathHandler extends CloudPathHandler {
    protected getProviderName(): string {
        return 'GCP';
    }

    protected override encodePath(path: string): string {
        // GCP requires specific URL encoding
        const encoded = encodeURIComponent(path);
        LogManager.log(LogLevel.Trace, `Encoded path for GCP: ${path} -> ${encoded}`);
        return encoded;
    }

    getObjectUrl(bucket: string, path: string): string {
        const url = new URL('https://storage.googleapis.com');
        const encodedPath = this.encodePath(path);
        const pathSegments = [bucket, ...encodedPath.split('/').filter(Boolean)];

        url.pathname = '/' + pathSegments.join('/');
        LogManager.log(LogLevel.Debug, 'Generated object URL:', {
            bucket,
            path,
            encodedPath,
            url: url.toString()
        });
        return url.toString();
    }

    getBucketUrl(bucket: string): string {
        return `https://storage.googleapis.com/${bucket}`;
    }

    getContainerUrl(bucket: string): string {
        return this.getBucketUrl(bucket);
    }

    encodePathForGCP(path: string): string {
        return this.encodePath(path);
    }
}
