import { encodeCloudPath, decodeCloudPath } from '../sync/pathEncoding';
import { normalizePath } from 'obsidian';
import { LogManager } from '../LogManager';
import { LogLevel } from '../sync/types';

export class AWSPaths {
    private readonly normalizedVaultPrefix: string;
    private readonly encodedVaultPrefix: string;

    constructor(private readonly vaultPrefix: string) {
        this.normalizedVaultPrefix = normalizePath(vaultPrefix);
        // Don't encode the vault prefix - it's used for comparison only
        this.encodedVaultPrefix = this.normalizedVaultPrefix;
        LogManager.log(LogLevel.Debug, 'Initialized AWS paths', {
            vaultPrefix,
            normalized: this.normalizedVaultPrefix,
            encoded: this.encodedVaultPrefix,
            hex: [...this.encodedVaultPrefix].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        });
    }

    getVaultPrefix(): string {
        return this.normalizedVaultPrefix;
    }

    private decodeXMLEntities(text: string): string {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    localToRemoteName(path: string): string {
        if (!path) {
            LogManager.log(LogLevel.Debug, 'Empty path in localToRemoteName');
            return '';
        }

        const normalized = normalizePath(path);
        // Don't encode the path - it will be encoded when used in URLs
        const encoded = normalized;

        LogManager.log(LogLevel.Debug, 'Local to remote path conversion', {
            original: path,
            normalized,
            encoded,
            hex: [...encoded].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        });

        return encoded;
    }

    remoteToLocalName(path: string): string {
        if (!path) {
            LogManager.log(LogLevel.Debug, 'Empty path in remoteToLocalName');
            return '';
        }

        // First decode any XML entities (e.g., &#x12; -> \x12)
        const decodedXML = this.decodeXMLEntities(path);
        LogManager.log(LogLevel.Debug, 'Decoded XML entities', {
            original: path,
            decodedXML,
            xmlHex: [...decodedXML].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        });

        // Then decode the path
        const decoded = decodeCloudPath(decodedXML);
        const normalized = normalizePath(decoded);

        LogManager.log(LogLevel.Debug, 'Remote to local path conversion', {
            original: path,
            decodedXML,
            decoded,
            normalized,
            hex: [...normalized].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        });

        return normalized;
    }

    addVaultPrefix(path: string): string {
        if (!path) {
            LogManager.log(LogLevel.Debug, 'Empty path in addVaultPrefix');
            return this.normalizedVaultPrefix;
        }

        const normalized = normalizePath(path);
        if (normalized === '/') {
            return this.normalizedVaultPrefix;
        }
        if (normalized === this.normalizedVaultPrefix) {
            return this.normalizedVaultPrefix;
        }
        if (normalized.startsWith(this.normalizedVaultPrefix + '/')) {
            return normalized;
        }

        // Don't encode the path - it will be encoded when used in URLs
        const prefixed = `${this.normalizedVaultPrefix}/${normalized}`;

        LogManager.log(LogLevel.Debug, 'Added vault prefix to path', {
            original: path,
            normalized,
            prefixed,
            hex: [...prefixed].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        });

        return prefixed;
    }

    removeVaultPrefix(path: string): string {
        if (!path) {
            LogManager.log(LogLevel.Debug, 'Empty path in removeVaultPrefix');
            return '';
        }

        const normalized = normalizePath(path);
        if (normalized === this.normalizedVaultPrefix) {
            return '/';
        }

        const prefix = `${this.normalizedVaultPrefix}/`;
        if (normalized.startsWith(prefix)) {
            const unprefixed = normalized.slice(prefix.length);

            LogManager.log(LogLevel.Debug, 'Removed vault prefix from path', {
                original: path,
                normalized,
                unprefixed,
                hex: [...unprefixed].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
            });

            return unprefixed;
        }

        LogManager.log(LogLevel.Debug, 'Path does not have vault prefix', {
            path: normalized,
            prefix,
            hex: [...normalized].map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        });

        return normalized;
    }
}
