import { LogManager } from "../LogManager";
import { LogLevel } from "../sync/types";
import * as CryptoJS from 'crypto-js';

export class AWSSigning {
    constructor(
        private readonly accessKey: string,
        private readonly secretKey: string,
        private readonly region: string
    ) {}

    async getPayloadHash(body?: Uint8Array | string): Promise<string> {
        LogManager.log(LogLevel.Debug, 'Calculating payload hash', {
            hasBody: Boolean(body),
            bodyType: body ? body.constructor.name : 'none',
            bodyLength: body ? body.length : 0
        });

        if (!body) {
            return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        }

        let data: CryptoJS.lib.WordArray;
        if (body instanceof Uint8Array) {
            data = CryptoJS.lib.WordArray.create(body);
        } else {
            data = CryptoJS.enc.Utf8.parse(body);
        }

        const hash = CryptoJS.SHA256(data);
        const hashHex = hash.toString(CryptoJS.enc.Hex);

        LogManager.log(LogLevel.Debug, 'Payload hash calculated', {
            hashHex,
            inputLength: body.length,
            inputType: body.constructor.name
        });

        return hashHex;
    }

    async generateSigningKey(date: string): Promise<CryptoJS.lib.WordArray> {
        const kDate = CryptoJS.HmacSHA256(date, `AWS4${this.secretKey}`);
        const kRegion = CryptoJS.HmacSHA256(this.region, kDate);
        const kService = CryptoJS.HmacSHA256('s3', kRegion);
        return CryptoJS.HmacSHA256('aws4_request', kService);
    }

    async signRequest(request: {
        method: string;
        path: string;
        queryParams: Record<string, string>;
        host: string;
        amzdate: string;
        contentType?: string;
        body?: Uint8Array | string;
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
        const params = new URLSearchParams();
        Object.keys(queryParams)
            .sort()
            .forEach(key => params.append(key, queryParams[key]));
        const canonicalQuerystring = params.toString()
            .replace(/\+/g, '%20')
            .replace(/%7E/g, '~');

        const signedHeaders = Object.keys(headers).sort();
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
            CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex)
        ].join('\n');

        const signingKey = await this.generateSigningKey(dateStamp);
        const signature = CryptoJS.HmacSHA256(stringToSign, signingKey).toString(CryptoJS.enc.Hex);

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
