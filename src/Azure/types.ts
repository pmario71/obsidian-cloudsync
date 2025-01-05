
export interface IAzurePaths {
    normalizeCloudPath(path: string): string;
    getBlobUrl(account: string, blobName: string, sasToken: string): string;
    getContainerUrl(account: string, sasToken: string, operation?: string): string;
    encodePathProperly(path: string): string;
    decodePathProperly(path: string): string;
}

export interface AzureConfig {
    account: string;
    accessKey: string;
}

export interface AzureTestResult {
    success: boolean;
    message: string;
    details?: {
        error?: Error;
        statusCode?: number;
        response?: unknown;
    };
}

export interface AzureBlobProperties {
    'Content-MD5': string[];
    'Content-Type': string[];
    'Last-Modified': string[];
    'Content-Length': string[];
}

export interface AzureBlob {
    Name: string[];
    Properties: AzureBlobProperties[];
}

export interface AzureListBlobsResult {
    EnumerationResults: {
        Blobs: [{
            Blob: AzureBlob[];
        }];
    };
}

export interface AzureSasOptions {
    permissions: {
        read: boolean;
        write: boolean;
        delete: boolean;
        list: boolean;
    };
    services: {
        blob: boolean;
    };
    resourceTypes: {
        container: boolean;
        object: boolean;
    };
    startsOn: Date;
    expiresOn: Date;
}
