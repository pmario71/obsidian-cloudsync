import { AzureFiles } from '../../src/Azure/files';
import { AzureAuth } from '../../src/Azure/auth';
import { AzurePathHandler } from '../../src/Azure/AzurePathHandler';
import { File } from '../../src/sync/AbstractManager';
import { App, RequestUrlResponse } from 'obsidian';

// Mock dependencies
jest.mock('obsidian', () => ({
    App: jest.fn(),
    requestUrl: jest.fn()
}), { virtual: true });

jest.mock('../../src/LogManager', () => ({
    LogManager: {
        log: jest.fn()
    }
}));

jest.mock('../../src/sync/utils/cacheUtils', () => ({
    CacheManagerService: {
        getInstance: jest.fn().mockReturnValue({
            invalidateCache: jest.fn().mockResolvedValue(undefined)
        })
    }
}));

describe('AzureFiles', () => {
    let files: AzureFiles;
    let mockAuth: jest.Mocked<AzureAuth>;
    let mockPaths: jest.Mocked<AzurePathHandler>;
    let mockRequestUrl: jest.Mock;

    const account = 'testaccount';
    const sasToken = 'test-token';
    const testFile: File = {
        name: 'test.md',
        localName: 'test.md',
        remoteName: 'test.md',
        mime: 'text/markdown',
        lastModified: new Date(),
        size: 100,
        md5: 'abc123',
        isDirectory: false
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock AzureAuth
        mockAuth = {
            getSasToken: jest.fn().mockReturnValue(sasToken)
        } as unknown as jest.Mocked<AzureAuth>;

        // Mock AzurePathHandler
        mockPaths = {
            setCredentials: jest.fn(),
            getBlobUrl: jest.fn().mockReturnValue('https://test.url'),
            getAzureContainerUrl: jest.fn().mockReturnValue('https://test.container.url'),
            normalizeCloudPath: jest.fn(path => path),
            decodePathProperly: jest.fn(path => path)
        } as unknown as jest.Mocked<AzurePathHandler>;

        // Mock requestUrl
        mockRequestUrl = jest.fn();
        const obsidian = jest.requireMock('obsidian');
        obsidian.requestUrl = mockRequestUrl;

        // Create AzureFiles instance
        files = new AzureFiles(
            account,
            mockPaths,
            mockAuth,
            {
                vault: {
                    configDir: '/test/config/dir'
                }
            } as unknown as App
        );
    });

    describe('readFile', () => {
        it('should read file successfully', async () => {
            const testContent = new Uint8Array([1, 2, 3, 4]);
            mockRequestUrl.mockResolvedValueOnce({
                status: 200,
                arrayBuffer: testContent.buffer,
                text: '',
                headers: {}
            } as RequestUrlResponse);

            const result = await files.readFile(testFile);

            expect(result).toEqual(testContent);
            expect(mockPaths.getBlobUrl).toHaveBeenCalledWith(
                account,
                testFile.remoteName,
                sasToken
            );
        });

        it('should handle HTTP error', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 404,
                text: 'Not Found',
                headers: {}
            } as RequestUrlResponse);

            await expect(files.readFile(testFile)).rejects.toThrow('HTTP error! status: 404');
        });
    });

    describe('writeFile', () => {
        const testContent = new Uint8Array([1, 2, 3, 4]);

        it('should write file successfully', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 201,
                text: '',
                headers: {}
            } as RequestUrlResponse);

            await expect(files.writeFile(testFile, testContent)).resolves.not.toThrow();

            expect(mockRequestUrl).toHaveBeenCalledWith(expect.objectContaining({
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'x-ms-blob-type': 'BlockBlob'
                }
            }));
        });

        it('should handle HTTP error', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 403,
                text: 'Forbidden',
                headers: {}
            } as RequestUrlResponse);

            await expect(files.writeFile(testFile, testContent))
                .rejects.toThrow('HTTP error! status: 403');
        });
    });

    describe('deleteFile', () => {
        it('should delete file successfully', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 202,
                text: '',
                headers: {}
            } as RequestUrlResponse);

            await expect(files.deleteFile(testFile)).resolves.not.toThrow();

            expect(mockRequestUrl).toHaveBeenCalledWith(expect.objectContaining({
                method: 'DELETE'
            }));
        });

        it('should handle HTTP error', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 404,
                text: 'Not Found',
                headers: {}
            } as RequestUrlResponse);

            await expect(files.deleteFile(testFile))
                .rejects.toThrow('HTTP error! status: 404');
        });
    });

    describe('getFiles', () => {
        const mockXmlResponse = `<?xml version="1.0" encoding="utf-8"?>
            <EnumerationResults>
                <Blobs>
                    <Blob>
                        <Name>test1.md</Name>
                        <Properties>
                            <Content-Length>100</Content-Length>
                            <Content-Type>text/markdown</Content-Type>
                            <Last-Modified>Wed, 01 Jan 2023 12:00:00 GMT</Last-Modified>
                            <Content-MD5>MDEyMzQ1Njc4OWFiY2RlZg==</Content-MD5>
                        </Properties>
                    </Blob>
                    <Blob>
                        <Name>folder/test2.md</Name>
                        <Properties>
                            <Content-Length>200</Content-Length>
                            <Content-Type>text/markdown</Content-Type>
                            <Last-Modified>Wed, 01 Jan 2023 13:00:00 GMT</Last-Modified>
                        </Properties>
                    </Blob>
                </Blobs>
            </EnumerationResults>`;

        it('should list files successfully', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 200,
                text: mockXmlResponse,
                headers: {}
            } as RequestUrlResponse);

            const result = await files.getFiles();

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                name: 'test1.md',
                remoteName: 'test1.md',
                size: 100,
                mime: 'text/markdown'
            });
            expect(result[1]).toMatchObject({
                name: 'folder/test2.md',
                remoteName: 'folder/test2.md',
                size: 200,
                mime: 'text/markdown'
            });
        });

        it('should handle new container', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 404,
                text: 'Not Found',
                headers: {}
            } as RequestUrlResponse);

            await expect(files.getFiles()).rejects.toThrow('NEW_CONTAINER');
        });

        it('should handle HTTP error', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 403,
                text: 'Forbidden',
                headers: {}
            } as RequestUrlResponse);

            await expect(files.getFiles()).rejects.toThrow('HTTP error! status: 403');
        });

        it('should handle malformed XML', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 200,
                text: '<invalid>xml',
                headers: {}
            } as RequestUrlResponse);

            const result = await files.getFiles();
            expect(result).toEqual([]);
        });

        it('should handle missing properties', async () => {
            const xmlWithMissingProps = `<?xml version="1.0" encoding="utf-8"?>
                <EnumerationResults>
                    <Blobs>
                        <Blob>
                            <Name>test.md</Name>
                            <Properties>
                            </Properties>
                        </Blob>
                    </Blobs>
                </EnumerationResults>`;

            mockRequestUrl.mockResolvedValueOnce({
                status: 200,
                text: xmlWithMissingProps,
                headers: {}
            } as RequestUrlResponse);

            const result = await files.getFiles();
            expect(result[0]).toMatchObject({
                name: 'test.md',
                size: 0,
                mime: '',
                md5: ''
            });
        });
    });
});
