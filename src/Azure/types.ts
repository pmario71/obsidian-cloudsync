
export interface AzureConfig {
    account: string;
    accessKey: string;
}

export interface AzureTestResult {
    success: boolean;
    message: string;
    details?: any;
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
