import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import { HmacSHA256, SHA256, enc, lib } from 'crypto-js';

interface SigningRequest {
    method: string;
    path: string;
    queryParams: Record<string, string>;
    host: string;
    amzdate: string;
    contentType?: string;
    body?: Uint8Array | string;
}

interface SignedHeaders extends Record<string, string> {
    'content-type': string;
    'x-amz-content-sha256': string;
    'x-amz-date': string;
    'Authorization': string;
    [key: string]: string;
}

const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const AWS_ALGORITHM = 'AWS4-HMAC-SHA256';
const AWS_SERVICE = 's3';
const AWS_REQUEST = 'aws4_request';

export class AWSSigning {
    private virtualHostUrl = '';

    constructor(
        private readonly accessKey: string,
        private readonly secretKey: string,
        private readonly region: string
    ) {}

    setVirtualHostUrl(url: string): void {
        this.virtualHostUrl = url;
        LogManager.log(LogLevel.Debug, 'Set virtual host URL', { url });
    }

    private getPayloadHash(body?: Uint8Array | string): string {
        try {
            LogManager.log(LogLevel.Debug, 'Calculating payload hash', {
                hasBody: Boolean(body),
                bodyType: body ? body.constructor.name : 'none',
                bodyLength: body ? body.length : 0
            });

            if (!body) {
                return EMPTY_HASH;
            }

            const data = body instanceof Uint8Array
                ? lib.WordArray.create(body)
                : enc.Utf8.parse(body);

            const hash = SHA256(data);
            const hashHex = hash.toString(enc.Hex);

            LogManager.log(LogLevel.Debug, 'Payload hash calculated', {
                hashHex,
                inputLength: body.length,
                inputType: body.constructor.name
            });

            return hashHex;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to calculate payload hash', error);
            throw new Error(`Failed to calculate payload hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private generateSigningKey(date: string): CryptoJS.lib.WordArray {
        try {
            const kDate = HmacSHA256(date, `AWS4${this.secretKey}`);
            const kRegion = HmacSHA256(this.region, kDate);
            const kService = HmacSHA256(AWS_SERVICE, kRegion);
            return HmacSHA256(AWS_REQUEST, kService);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to generate signing key', error);
            throw new Error(`Failed to generate signing key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private encodeURIComponentRFC3986(str: string): string {
        return encodeURIComponent(str)
            .replace(/!/g, '%21')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\*/g, '%2A')
            .replace(/~/g, '%7E')
            .replace(/\+/g, '%20')
            .replace(/%2F/g, '/');
    }

    private buildCanonicalRequest(
        method: string,
        path: string,
        queryParams: Record<string, string>,
        headers: Record<string, string>,
        payloadHash: string
    ): string {

        const segments = path.replace(/^\/+/, '').split('/');
        const encodedSegments = segments.map(segment => {
            if (!segment) return '';
            const encoded = this.encodeURIComponentRFC3986(segment);
            return encoded;
        });
        const encodedPath = '/' + encodedSegments.join('/');

        const params = new URLSearchParams();
        Object.keys(queryParams)
            .sort((a, b) => a.localeCompare(b))
            .forEach(key => {
                const value = queryParams[key];
                const encodedKey = this.encodeURIComponentRFC3986(key);
                const encodedValue = value ? this.encodeURIComponentRFC3986(value) : '';
                params.append(encodedKey, encodedValue);
            });

        const canonicalQuerystring = params.toString()
            .replace(/\+/g, '%20')
            .replace(/%7E/g, '~');

        LogManager.log(LogLevel.Debug, 'Building canonical request', {
            method,
            originalPath: path,
            encodedPath,
            canonicalQuerystring
        });

        const signedHeaders = Object.keys(headers).sort((a, b) => a.localeCompare(b));
        const canonicalHeaders = signedHeaders
            .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
            .join('');

        const signedHeadersString = signedHeaders.map(h => h.toLowerCase()).join(';');

        const canonicalRequest = [
            method,
            encodedPath,
            canonicalQuerystring,
            canonicalHeaders,
            signedHeadersString,
            payloadHash
        ].join('\n');

        LogManager.log(LogLevel.Debug, 'Canonical request built', {
            canonicalRequest
        });

        return canonicalRequest;
    }

    signRequest(request: SigningRequest): SignedHeaders {
        try {
            const {
                method,
                path,
                queryParams,
                host,
                amzdate,
                contentType = 'application/octet-stream',
                body
            } = request;

            const effectiveHost = this.virtualHostUrl ? new URL(this.virtualHostUrl).host : host;

            const dateStamp = amzdate.slice(0, 8);
            const payloadHash = this.getPayloadHash(body);

            const headers: Record<string, string> = {
                'host': effectiveHost,
                'content-type': contentType,
                'x-amz-content-sha256': payloadHash,
                'x-amz-date': amzdate
            };

            const canonicalRequest = this.buildCanonicalRequest(
                method,
                path,
                queryParams,
                headers,
                payloadHash
            );

            LogManager.log(LogLevel.Debug, 'Canonical Request', {
                method,
                path,
                queryParams,
                payloadHash,
                canonicalRequest
            });

            const credentialScope = `${dateStamp}/${this.region}/${AWS_SERVICE}/${AWS_REQUEST}`;
            const stringToSign = [
                AWS_ALGORITHM,
                amzdate,
                credentialScope,
                SHA256(canonicalRequest).toString(enc.Hex)
            ].join('\n');

            const signingKey = this.generateSigningKey(dateStamp);
            const signature = HmacSHA256(stringToSign, signingKey).toString(enc.Hex);

            const signedHeadersString = Object.keys(headers).sort((a, b) => a.localeCompare(b)).map(h => h.toLowerCase()).join(';');
            const authorizationHeader =
                `${AWS_ALGORITHM} ` +
                `Credential=${this.accessKey}/${credentialScope}, ` +
                `SignedHeaders=${signedHeadersString}, ` +
                `Signature=${signature}`;

            const requestHeaders: SignedHeaders = {
                'content-type': contentType,
                'x-amz-content-sha256': payloadHash,
                'x-amz-date': amzdate,
                'Authorization': authorizationHeader
            };

            LogManager.log(LogLevel.Debug, 'Request Headers', requestHeaders);
            return requestHeaders;
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to sign request', error);
            throw new Error(`Failed to sign request: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
