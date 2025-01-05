
export interface GCPConfig {
    privateKey: string;
    clientEmail: string;
    bucket: string;
}

export interface GCPTestResult {
    success: boolean;
    message: string;
    details?: {
        error?: Error;
        statusCode?: number;
        response?: unknown;
    };
}

export interface GCPAuthConfig {
    credentials: {
        client_email: string;
        private_key: string;
    };
    scopes: string[];
}

export interface GCPFileMetadata {
    Key: string[];
    LastModified: string[];
    ETag: string[];
    Size: string[];
}
