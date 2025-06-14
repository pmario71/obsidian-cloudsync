import { CloudPathHandler } from '../../src/sync/CloudPathHandler';
import { normalizePath } from 'obsidian';
import { encodeCloudPath, decodeCloudPath } from '../../src/sync/pathEncoding';
import { LogManager } from '../../src/LogManager';
import { LogLevel } from '../../src/sync/types';

// Mocks
jest.mock('obsidian', () => ({
    normalizePath: jest.fn((str: string) => str.replace('\\', '/'))
}), { virtual: true });

jest.mock('../../src/sync/pathEncoding', () => ({
    encodeCloudPath: jest.fn((path: string) => `ENCODED:${path}`),
    decodeCloudPath: jest.fn((path: string) => `DECODED:${path}`)
}));

jest.mock('../../src/LogManager', () => ({
    LogManager: {
        log: jest.fn()
    }
}));

// Minimal concrete subclass for testing
class TestCloudPathHandler extends CloudPathHandler {
    public getVaultPrefix(): string {
        return this.vaultPrefix;
    }

    protected getProviderName(): string {
        return 'TestProvider';
    }
    getObjectUrl(bucket: string, path: string): string {
        return `object://${bucket}/${path}`;
    }
    getContainerUrl(bucket: string): string {
        return `container://${bucket}`;
    }
}

describe('CloudPathHandler', () => {
    const vaultPrefix = 'vault\\prefix';
    let handler: TestCloudPathHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new TestCloudPathHandler(vaultPrefix);
    });

    // it('constructor normalizes vaultPrefix and logs', () => {
    //     expect(normalizePath).toHaveBeenCalledWith(vaultPrefix);
    //     expect(handler.getVaultPrefix()).toBe('vault/prefix');
    //     expect(LogManager.log).toHaveBeenCalledWith(
    //         LogLevel.Debug,
    //         expect.stringContaining('Initialized'),
    //         expect.objectContaining({
    //             vaultPrefix,
    //             normalized: 'vault/prefix'
    //         })
    //     );
    // });

    // it('getVaultPrefix returns normalized prefix', () => {
    //     expect(handler.getVaultPrefix()).toBe('vault/prefix');
    // });

    it('normalizeCloudPath normalizes path', () => {
        expect(handler.normalizeCloudPath('foo\\bar')).toBe('foo/bar');
        expect(normalizePath).toHaveBeenCalledWith('foo\\bar');
    });

    describe('addVaultPrefix', () => {
        it('returns normalizedVaultPrefix for root path', () => {
            expect(handler.addVaultPrefix('/')).toBe('vault/prefix');
        });
        it('returns normalizedVaultPrefix for already-prefixed path', () => {
            expect(handler.addVaultPrefix('vault/prefix')).toBe('vault/prefix');
        });
        it('returns path if already starts with prefix + /', () => {
            expect(handler.addVaultPrefix('vault/prefix/foo')).toBe('vault/prefix/foo');
        });
        it('adds prefix if not present', () => {
            expect(handler.addVaultPrefix('foo/bar')).toBe('vault/prefix/foo/bar');
        });
    });

    describe('removeVaultPrefix', () => {
        it('returns root for exact prefix', () => {
            expect(handler.removeVaultPrefix('vault/prefix')).toBe('/');
        });
        it('removes prefix if present', () => {
            expect(handler.removeVaultPrefix('vault/prefix/foo/bar')).toBe('foo/bar');
        });
        it('returns path unchanged if prefix not present', () => {
            expect(handler.removeVaultPrefix('other/path')).toBe('other/path');
        });
    });

    describe('localToRemoteName', () => {
        it('returns empty string and logs for empty path', () => {
            expect(handler.localToRemoteName('')).toBe('');
            expect(LogManager.log).toHaveBeenCalledWith(
                LogLevel.Debug,
                expect.stringContaining('Empty path')
            );
        });
        it('normalizes and logs non-empty path', () => {
            const result = handler.localToRemoteName('foo\\bar');
            expect(result).toBe('foo/bar');
            expect(LogManager.log).toHaveBeenCalledWith(
                LogLevel.Debug,
                expect.stringContaining('Local to remote path conversion'),
                expect.objectContaining({
                    original: 'foo\\bar',
                    normalized: 'foo/bar'
                })
            );
        });
    });

    describe('remoteToLocalName', () => {
        it('returns empty string and logs for empty path', () => {
            expect(handler.remoteToLocalName('')).toBe('');
            expect(LogManager.log).toHaveBeenCalledWith(
                LogLevel.Debug,
                expect.stringContaining('Empty path')
            );
        });
        it('decodes, normalizes, and logs non-empty path', () => {
            const result = handler.remoteToLocalName('foo/bar');
            expect(decodeCloudPath).toHaveBeenCalledWith('foo/bar');
            expect(result).toBe('DECODED:foo/bar');
            expect(LogManager.log).toHaveBeenCalledWith(
                LogLevel.Debug,
                expect.stringContaining('Remote to local path conversion'),
                expect.objectContaining({
                    original: 'foo/bar',
                    decoded: 'DECODED:foo/bar',
                    normalized: 'DECODED:foo/bar'
                })
            );
        });
    });

    describe('encodePath', () => {
        it('calls encodeCloudPath', () => {
            expect(handler['encodePath']('abc')).toBe('ENCODED:abc');
            expect(encodeCloudPath).toHaveBeenCalledWith('abc');
        });
    });

    describe('decodeRemotePath', () => {
        it('calls decodeCloudPath', () => {
            expect(handler['decodeRemotePath']('xyz')).toBe('DECODED:xyz');
            expect(decodeCloudPath).toHaveBeenCalledWith('xyz');
        });
    });

    // describe('abstract methods', () => {
    //     it('getObjectUrl and getContainerUrl work in subclass', () => {
    //         expect(handler.getObjectUrl('bucket', 'path')).toBe('object://bucket/path');
    //         expect(handler.getContainerUrl('bucket')).toBe('container://bucket');
    //     });
    //     it('throws if abstract methods not implemented', () => {
    //         // @ts-expect-error
    //         class IncompleteHandler extends CloudPathHandler {
    //             protected getProviderName() { return 'Incomplete'; }
    //             getObjectUrl() { throw new Error('Not implemented'); }
    //             getContainerUrl() { throw new Error('Not implemented'); }
    //         }
    //         const incomplete = new IncompleteHandler('prefix');
    //         expect(() => incomplete.getObjectUrl('b', 'p')).toThrow('Not implemented');
    //         expect(() => incomplete.getContainerUrl('b')).toThrow('Not implemented');
    //     });
    // });
});