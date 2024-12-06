import { CloudSyncSettings } from '../sync/types';

export interface AWSConfig {
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
}

export interface AWSHeaders {
    'content-type': string;
    'x-amz-content-sha256': string;
    'x-amz-date': string;
    'Authorization': string;
    [key: string]: string;  // Add index signature to allow additional string keys
}

export interface AWSTestResult {
    success: boolean;
    message: string;
    details?: any;
}

export interface AWSRequestConfig {
    method: string;
    path: string;
    queryParams: Record<string, string>;
    host: string;
    amzdate: string;
    contentType?: string;
    body?: Buffer;  // Specify body as Buffer type
}
