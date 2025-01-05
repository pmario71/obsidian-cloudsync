import { AzurePathHandler } from '../../src/Azure/AzurePathHandler';
import { normalizePath } from 'obsidian';

// Mock dependencies
jest.mock('obsidian', () => ({
    normalizePath: (str: string) => str.replace(/\\/g, '/')
}), { virtual: true });

jest.mock('../../src/LogManager', () => ({
    LogManager: {
        log: jest.fn()
    }
}));

describe('AzurePathHandler', () => {
    let handler: AzurePathHandler;
    const vaultPrefix = 'Test Vault';
    const containerName = 'test-container';
    const account = 'testaccount';
    const sasToken = 'sv=2020-04-08&ss=b&srt=sco&sp=rwdlac&sig=test';

    beforeEach(() => {
        handler = new AzurePathHandler(vaultPrefix, containerName);
        handler.setCredentials(account, sasToken);
    });

    describe('URL Generation', () => {
        it('should generate correct blob URL', () => {
            const blobName = 'test/path/file.md';
            const url = handler.getBlobUrl(account, blobName, sasToken);

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}/${encodeURIComponent(blobName)}?${sasToken}`
            );
        });

        it('should handle SAS token with leading question mark', () => {
            const blobName = 'test.md';
            const url = handler.getBlobUrl(account, blobName, '?' + sasToken);

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}/${encodeURIComponent(blobName)}?${sasToken}`
            );
        });

        it('should generate correct container URL for listing', () => {
            const url = handler.getAzureContainerUrl(account, sasToken, 'list');

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}?restype=container&comp=list&${sasToken}`
            );
        });

        it('should generate correct base container URL', () => {
            const url = handler.getAzureContainerUrl(account, sasToken);

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}?restype=container&${sasToken}`
            );
        });

        it('should throw error when getting object URL without credentials', () => {
            handler = new AzurePathHandler(vaultPrefix, containerName);
            expect(() => handler.getObjectUrl('', 'test.md')).toThrow('Azure credentials not set');
        });

        it('should throw error when getting container URL without credentials', () => {
            handler = new AzurePathHandler(vaultPrefix, containerName);
            expect(() => handler.getContainerUrl('')).toThrow('Azure credentials not set');
        });
    });

    describe('Path Handling', () => {
        it('should properly encode paths', () => {
            const paths = [
                'test file.md',
                'folder/subfolder/file.md',
                'special@#$chars.md',
                'unicode/文件.md'
            ];

            for (const path of paths) {
                const encoded = handler.encodePathProperly(path);
                expect(encoded).toBeDefined();
                expect(typeof encoded).toBe('string');
                // The exact encoding expectations would depend on your implementation
                expect(encoded).not.toBe('');
            }
        });

        // Note: decodePathProperly in AzurePathHandler just returns the path as-is
        it('should handle path decoding', () => {
            const paths = [
                'test%20file.md',
                'folder/subfolder/file.md',
                'special%40%23%24chars.md'
            ];

            for (const path of paths) {
                const decoded = handler.decodePathProperly(path);
                // AzurePathHandler's decodePathProperly returns the path unchanged
                expect(decoded).toBe(path);
            }
        });
    });

    describe('Vault Prefix Handling', () => {
        it('should add vault prefix correctly', () => {
            const testCases = [
                { input: '/', expected: vaultPrefix },
                { input: 'test.md', expected: `${vaultPrefix}/test.md` },
                { input: 'folder/file.md', expected: `${vaultPrefix}/folder/file.md` },
                { input: vaultPrefix, expected: vaultPrefix },
                { input: `${vaultPrefix}/test.md`, expected: `${vaultPrefix}/test.md` }
            ];

            for (const { input, expected } of testCases) {
                expect(handler.addVaultPrefix(input)).toBe(expected);
            }
        });

        it('should remove vault prefix correctly', () => {
            const testCases = [
                { input: vaultPrefix, expected: '/' },
                { input: `${vaultPrefix}/test.md`, expected: 'test.md' },
                { input: `${vaultPrefix}/folder/file.md`, expected: 'folder/file.md' },
                { input: 'no-prefix/test.md', expected: 'no-prefix/test.md' }
            ];

            for (const { input, expected } of testCases) {
                expect(handler.removeVaultPrefix(input)).toBe(expected);
            }
        });
    });

    describe('Path Normalization', () => {
        // Note: normalizeCloudPath in AzurePathHandler uses obsidian's normalizePath
        it('should normalize paths according to obsidian rules', () => {
            expect(handler.normalizeCloudPath('test\\file.md')).toBe('test/file.md');
            expect(handler.normalizeCloudPath('folder//file.md')).toBe('folder//file.md');
            expect(handler.normalizeCloudPath('./test/file.md')).toBe('./test/file.md');
        });

        it('should handle empty paths', () => {
            expect(handler.normalizeCloudPath('')).toBe('');
        });
    });

    describe('Local-Remote Name Conversion', () => {
        it('should convert local to remote names', () => {
            const testCases = [
                { input: 'test.md', expected: 'test.md' },
                { input: 'folder/file.md', expected: 'folder/file.md' },
                { input: '', expected: '' }
            ];

            for (const { input, expected } of testCases) {
                expect(handler.localToRemoteName(input)).toBe(expected);
            }
        });

        it('should convert remote to local names', () => {
            const testCases = [
                { input: 'test.md', expected: 'test.md' },
                { input: 'folder/file.md', expected: 'folder/file.md' },
                { input: '', expected: '' }
            ];

            for (const { input, expected } of testCases) {
                expect(handler.remoteToLocalName(input)).toBe(expected);
            }
        });
    });
});
