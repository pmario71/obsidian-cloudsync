import { AzureManager } from '../../src/Azure/AzureManager';
import { AzureFiles } from '../../src/Azure/files';
import { File } from '../../src/sync/AbstractManager';
import { CloudSyncSettings } from '../../src/sync/types';
import { App } from 'obsidian';

// Mock dependencies
jest.mock('../../src/Azure/auth');
jest.mock('../../src/Azure/files');
// Mock obsidian module
jest.mock('obsidian', () => ({
    App: jest.fn(),
    requestUrl: jest.fn(),
    normalizePath: (str: string) => str, // Simple pass-through mock
    Notice: jest.fn()
}), { virtual: true });

// Mock LogManager to prevent logging issues
jest.mock('../../src/LogManager', () => ({
    LogManager: {
        log: jest.fn(),
        setLogFunction: jest.fn(),
        addDelimiter: jest.fn()
    }
}));

describe('AzureManager', () => {
    let manager: AzureManager;
    let mockSettings: CloudSyncSettings;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock settings
        mockSettings = {
            azure: {
                account: 'testaccount',
                accessKey: 'testaccesskey'
            },
            app: {} as App
        } as CloudSyncSettings;

        manager = new AzureManager(mockSettings, 'test-vault');
    });

    describe('getFiles', () => {
        it('should return files from Azure storage', async () => {
            // Setup mock files
            const mockFiles: File[] = [
                {
                    name: 'test1.md',
                    localName: 'test1.md',
                    remoteName: 'test1.md',
                    mime: 'text/markdown',
                    lastModified: new Date(),
                    size: 100,
                    md5: 'abc123',
                    isDirectory: false
                },
                {
                    name: 'test2.md',
                    localName: 'test2.md',
                    remoteName: 'test2.md',
                    mime: 'text/markdown',
                    lastModified: new Date(),
                    size: 200,
                    md5: 'def456',
                    isDirectory: false
                }
            ];

            // Mock AzureFiles.getFiles to return our test files
            const mockGetFiles = jest.spyOn(AzureFiles.prototype, 'getFiles')
                .mockResolvedValue(mockFiles);

            // Call getFiles
            await manager.authenticate(); // Need to authenticate first to initialize fileOps
            const files = await manager.getFiles();

            // Verify results
            expect(mockGetFiles).toHaveBeenCalled();
            expect(files).toEqual(mockFiles);
            expect(manager.files).toEqual(mockFiles); // Should update internal files array
        });

        it('should handle new container scenario', async () => {
            // Mock AzureFiles.getFiles to throw NEW_CONTAINER error
            const mockGetFiles = jest.spyOn(AzureFiles.prototype, 'getFiles')
                .mockRejectedValue(new Error('NEW_CONTAINER'));

            // Call getFiles
            await manager.authenticate(); // Need to authenticate first to initialize fileOps
            const files = await manager.getFiles();

            // Verify results
            expect(mockGetFiles).toHaveBeenCalled();
            expect(files).toEqual([]); // Should return empty array for new container
            expect(manager.files).toEqual([]); // Should update internal files array to empty
        });

        it('should propagate unexpected errors', async () => {
            // Mock AzureFiles.getFiles to throw an unexpected error
            const mockError = new Error('Unexpected error');
            const mockGetFiles = jest.spyOn(AzureFiles.prototype, 'getFiles')
                .mockRejectedValue(mockError);

            // Call getFiles and expect it to throw
            await manager.authenticate(); // Need to authenticate first to initialize fileOps
            await expect(manager.getFiles()).rejects.toThrow(mockError);

            // Verify mock was called
            expect(mockGetFiles).toHaveBeenCalled();
        });

        it('should update internal files array', async () => {
            // Setup mock files
            const mockFiles: File[] = [
                {
                    name: 'test.md',
                    localName: 'test.md',
                    remoteName: 'test.md',
                    mime: 'text/markdown',
                    lastModified: new Date(),
                    size: 100,
                    md5: 'abc123',
                    isDirectory: false
                }
            ];

            // Mock AzureFiles.getFiles
            jest.spyOn(AzureFiles.prototype, 'getFiles')
                .mockResolvedValue(mockFiles);

            // Call getFiles
            await manager.authenticate(); // Need to authenticate first to initialize fileOps
            await manager.getFiles();

            // Verify internal state
            expect(manager.files).toEqual(mockFiles);
        });
    });
});
