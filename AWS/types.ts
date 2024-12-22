
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
    [key: string]: string;
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
    body?: Uint8Array;
}
