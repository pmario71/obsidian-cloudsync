import { AWSHeaders, AWSRequestConfig } from './types';
import { LogLevel } from '../types';
import { LogManager } from '../LogManager';
import { encodeURIPath } from './encoding';

export class AWSSigning {
    constructor(
        private accessKey: string,
        private secretKey: string,
        private region: string
    ) {}

    private log(level: LogLevel, message: string, data?: any): void {
        LogManager.log(level, message, data);
    }

    private async getPayloadHash(body?: Buffer | string): Promise<string> {
        this.log(LogLevel.Debug, 'Calculating payload hash', {
            hasBody: !!body,
            bodyType: body ? body.constructor.name : 'none',
            bodyLength: body ? body.length : 0
        });

        if (!body) {
            // Return hash of empty string for empty payloads
            return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        }

        let arrayBuffer: ArrayBuffer;
        if (Buffer.isBuffer(body)) {
            // For Buffer, use it directly
            arrayBuffer = body;
        } else {
            // For string, encode to UTF-8
            arrayBuffer = new TextEncoder().encode(body);
        }

        const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashHex = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        this.log(LogLevel.Debug, 'Payload hash calculated', {
            hashHex,
            inputLength: arrayBuffer.byteLength,
            inputType: body.constructor.name
        });

        return hashHex;
    }

    private async generateSigningKey(datestamp: string): Promise<ArrayBuffer> {
        const enc = new TextEncoder();
        const kDate = await crypto.subtle.importKey(
            'raw',
            enc.encode(`AWS4${this.secretKey}`),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key => crypto.subtle.sign(
            'HMAC',
            key,
            enc.encode(datestamp)
        ));

        const kRegion = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(kDate),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key => crypto.subtle.sign(
            'HMAC',
            key,
            enc.encode(this.region)
        ));

        const kService = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(kRegion),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key => crypto.subtle.sign(
            'HMAC',
            key,
            enc.encode('s3')
        ));

        return crypto.subtle.importKey(
            'raw',
            new Uint8Array(kService),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key => crypto.subtle.sign(
            'HMAC',
            key,
            enc.encode('aws4_request')
        ));
    }

    async signRequest(config: AWSRequestConfig): Promise<AWSHeaders> {
        const { method, path, queryParams, host, amzdate, contentType = 'application/octet-stream', body } = config;
        const datestamp = amzdate.slice(0, 8);

        this.log(LogLevel.Debug, 'Sign Request - Starting', {
            method,
            path,
            queryParams,
            host,
            amzdate,
            contentType,
            hasBody: !!body,
            bodyType: body ? body.constructor.name : 'none',
            bodyLength: body ? body.length : 0
        });

        // Calculate payload hash
        const payloadHash = await this.getPayloadHash(body);

        // Prepare headers for signing (including host which is required for signing)
        const headersToSign: Record<string, string> = {
            'host': host,
            'content-type': contentType,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzdate
        };

        // Create canonical request
        const canonicalUri = encodeURIPath(path.startsWith('/') ? path : `/${path}`);
        const canonicalQuerystring = Object.entries(queryParams)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

        const sortedHeaderKeys = Object.keys(headersToSign).sort();
        const canonicalHeaders = sortedHeaderKeys
            .map(key => `${key.toLowerCase()}:${headersToSign[key]}\n`)
            .join('');

        const signedHeaders = sortedHeaderKeys
            .map(key => key.toLowerCase())
            .join(';');

        const canonicalRequest = [
            method,
            canonicalUri,
            canonicalQuerystring,
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].join('\n');

        this.log(LogLevel.Debug, 'Canonical Request', {
            method,
            canonicalUri,
            canonicalQuerystring,
            signedHeaders,
            payloadHash,
            canonicalRequest
        });

        // Create string to sign
        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${datestamp}/${this.region}/s3/aws4_request`;
        const stringToSign = [
            algorithm,
            amzdate,
            credentialScope,
            await this.getPayloadHash(canonicalRequest)
        ].join('\n');

        // Generate signature
        const signature = await crypto.subtle.importKey(
            'raw',
            await this.generateSigningKey(datestamp),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key => crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(stringToSign)
        )).then(signed => Array.from(new Uint8Array(signed))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(''));

        const authorization = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        // Return headers for the actual request (excluding host)
        const requestHeaders: AWSHeaders = {
            'content-type': contentType,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzdate,
            'Authorization': authorization
        };

        this.log(LogLevel.Debug, 'Request Headers', requestHeaders);

        return requestHeaders;
    }
}
