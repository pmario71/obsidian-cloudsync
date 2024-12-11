import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";

export class AWSSigning {
    constructor(
        private readonly accessKey: string,
        private readonly secretKey: string,
        private readonly region: string
    ) {}

    async getPayloadHash(body?: Buffer | string): Promise<string> {
        LogManager.log(LogLevel.Debug, 'Calculating payload hash', {
            hasBody: Boolean(body),
            bodyType: body ? body.constructor.name : 'none',
            bodyLength: body ? body.length : 0
        });

        if (!body) {
            return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        }

        let data: Uint8Array;
        if (Buffer.isBuffer(body)) {
            data = body;
        } else {
            data = new TextEncoder().encode(body);
        }

        const hash = await crypto.subtle.digest('SHA-256', data);
        const hashHex = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        LogManager.log(LogLevel.Debug, 'Payload hash calculated', {
            hashHex,
            inputLength: data.byteLength,
            inputType: body.constructor.name
        });

        return hashHex;
    }

    async generateSigningKey(date: string): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(`AWS4${this.secretKey}`),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key =>
            crypto.subtle.sign('HMAC', key, encoder.encode(date))
        );

        const regionKey = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(key),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key =>
            crypto.subtle.sign('HMAC', key, encoder.encode(this.region))
        );

        const serviceKey = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(regionKey),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key =>
            crypto.subtle.sign('HMAC', key, encoder.encode('s3'))
        );

        return crypto.subtle.importKey(
            'raw',
            new Uint8Array(serviceKey),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key =>
            crypto.subtle.sign('HMAC', key, encoder.encode('aws4_request'))
        );
    }

    async signRequest(request: {
        method: string;
        path: string;
        queryParams: Record<string, string>;
        host: string;
        amzdate: string;
        contentType?: string;
        body?: Buffer | string;
    }): Promise<Record<string, string>> {
        const {
            method,
            path,
            queryParams,
            host,
            amzdate,
            contentType = 'application/octet-stream',
            body
        } = request;

        const dateStamp = amzdate.slice(0, 8);

        LogManager.log(LogLevel.Debug, 'Sign Request - Starting', {
            method,
            path,
            queryParams,
            host,
            amzdate,
            contentType,
            hasBody: Boolean(body),
            bodyType: body ? body.constructor.name : 'none',
            bodyLength: body ? body.length : 0
        });

        const payloadHash = await this.getPayloadHash(body);

        const headers: Record<string, string> = {
            'host': host,
            'content-type': contentType,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzdate
        };

        const canonicalUri = path;
        const canonicalQuerystring = Object.entries(queryParams)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');

        const signedHeaders = Object.keys(headers).sort((a, b) => a.localeCompare(b));
        const canonicalHeaders = signedHeaders
            .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
            .join('');

        const signedHeadersString = signedHeaders.map(h => h.toLowerCase()).join(';');

        const canonicalRequest = [
            method,
            canonicalUri,
            canonicalQuerystring,
            canonicalHeaders,
            signedHeadersString,
            payloadHash
        ].join('\n');

        LogManager.log(LogLevel.Debug, 'Canonical Request', {
            method,
            canonicalUri,
            canonicalQuerystring,
            signedHeaders: signedHeadersString,
            payloadHash,
            canonicalRequest
        });

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
        const stringToSign = [
            algorithm,
            amzdate,
            credentialScope,
            await this.getPayloadHash(canonicalRequest)
        ].join('\n');

        const signingKey = await this.generateSigningKey(dateStamp);
        const signature = await crypto.subtle.importKey(
            'raw',
            signingKey,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        ).then(key =>
            crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign))
        ).then(signature =>
            Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
        );

        const authorizationHeader = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeadersString}, Signature=${signature}`;

        const requestHeaders = {
            'content-type': contentType,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzdate,
            'Authorization': authorizationHeader
        };

        LogManager.log(LogLevel.Debug, 'Request Headers', requestHeaders);

        return requestHeaders;
    }
}
