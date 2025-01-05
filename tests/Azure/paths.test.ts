import { AzurePaths } from '../../src/Azure/paths';
import { normalizePath } from 'obsidian';
import { encodeCloudPath } from '../../src/sync/pathEncoding';

// Mock dependencies
jest.mock('obsidian', () => ({
    normalizePath: (str: string) => str.replace(/\\/g, '/')
}), { virtual: true });

jest.mock('../../src/sync/pathEncoding', () => ({
    encodeCloudPath: jest.fn(path => encodeURIComponent(path))
}));

jest.mock('../../src/LogManager', () => ({
    LogManager: {
        log: jest.fn()
    }
}));

describe('AzurePaths', () => {
    let paths: AzurePaths;
    const containerName = 'test-container';
    const account = 'testaccount';
    const sasToken = 'sv=2020-04-08&ss=b&srt=sco&sp=rwdlac&sig=test';

    beforeEach(() => {
        paths = new AzurePaths(containerName);
    });

    describe('getBlobUrl', () => {
        it('should generate correct blob URL', () => {
            const blobName = 'test/path/file.md';
            const url = paths.getBlobUrl(account, blobName, sasToken);

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}/${encodeURIComponent(blobName)}?${sasToken}`
            );
        });

        it('should handle SAS token with leading question mark', () => {
            const blobName = 'test.md';
            const url = paths.getBlobUrl(account, blobName, '?' + sasToken);

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}/${encodeURIComponent(blobName)}?${sasToken}`
            );
        });

        it('should handle special characters in blob name', () => {
            const blobName = 'test file with @#$% chars.md';
            const url = paths.getBlobUrl(account, blobName, sasToken);

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}/${encodeURIComponent(blobName)}?${sasToken}`
            );
        });
    });

    describe('getContainerUrl', () => {
        it('should generate base container URL', () => {
            const url = paths.getContainerUrl(account, sasToken);

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}?restype=container&${sasToken}`
            );
        });

        it('should generate list operation URL', () => {
            const url = paths.getContainerUrl(account, sasToken, 'list');

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}?restype=container&comp=list&${sasToken}`
            );
        });

        it('should handle SAS token with leading question mark', () => {
            const url = paths.getContainerUrl(account, '?' + sasToken);

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}?restype=container&${sasToken}`
            );
        });

        it('should handle empty SAS token', () => {
            const url = paths.getContainerUrl(account, '');

            expect(url).toBe(
                `https://${account}.blob.core.windows.net/${encodeURIComponent(containerName)}?restype=container`
            );
        });
    });

    describe('normalizeCloudPath', () => {
        it('should normalize Windows-style paths', () => {
            expect(paths.normalizeCloudPath('test\\path\\file.md'))
                .toBe('test/path/file.md');
        });

        it('should handle empty path', () => {
            expect(paths.normalizeCloudPath('')).toBe('');
        });
    });

    describe('encodePathProperly', () => {
        it('should normalize and encode paths', () => {
            const testPath = 'test\\path\\file with spaces.md';
            const result = paths.encodePathProperly(testPath);

            // First normalized by obsidian's normalizePath
            const normalized = 'test/path/file with spaces.md';
            // Then encoded by encodeCloudPath
            expect(result).toBe(encodeURIComponent(normalized));
        });

        it('should handle special characters', () => {
            const testPath = 'path/with/@#$%^&*chars.md';
            const result = paths.encodePathProperly(testPath);

            expect(result).toBe(encodeURIComponent(testPath));
        });

        it('should handle empty path', () => {
            expect(paths.encodePathProperly('')).toBe('');
        });
    });

    describe('decodePathProperly', () => {
        it('should return path as-is', () => {
            const testPath = 'test/path/file.md';
            expect(paths.decodePathProperly(testPath)).toBe(testPath);
        });

        it('should handle empty path', () => {
            expect(paths.decodePathProperly('')).toBe('');
        });
    });
});
