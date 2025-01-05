import { AzureAuth } from '../../src/Azure/auth';
import { IAzurePaths } from '../../src/Azure/types';
import { App, RequestUrlResponse } from 'obsidian';
import { LogManager } from '../../src/LogManager';

// Mock dependencies
jest.mock('obsidian', () => ({
    App: jest.fn(),
    requestUrl: jest.fn(),
    normalizePath: (str: string) => str
}), { virtual: true });

jest.mock('../../src/LogManager', () => ({
    LogManager: {
        log: jest.fn(),
        setLogFunction: jest.fn(),
        addDelimiter: jest.fn()
    }
}));

jest.mock('../../src/sync/utils/cacheUtils', () => ({
    CacheManagerService: {
        getInstance: jest.fn().mockReturnValue({
            invalidateCache: jest.fn().mockResolvedValue(undefined)
        })
    }
}));

describe('AzureAuth', () => {
    let auth: AzureAuth;
    let mockPaths: IAzurePaths;
    let mockRequestUrl: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock current date to ensure consistent SAS token generation
        jest.useFakeTimers().setSystemTime(new Date('2025-01-05T05:03:41Z'));

        // Mock paths
        mockPaths = {
            getContainerUrl: jest.fn().mockReturnValue('https://test.blob.core.windows.net/container'),
            getBlobUrl: jest.fn(),
            normalizeCloudPath: jest.fn(),
            decodePathProperly: jest.fn(),
            encodePathProperly: jest.fn()
        };

        // Mock requestUrl
        mockRequestUrl = jest.fn();
        const obsidian = jest.requireMock('obsidian');
        obsidian.requestUrl = mockRequestUrl;

        auth = new AzureAuth(
            'testaccount',
            'testaccesskey',
            mockPaths,
            {
                vault: {
                    configDir: '/test/config/dir'
                }
            } as unknown as App
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('validateSettings', () => {
        it('should validate valid settings', () => {
            expect(() => auth.validateSettings()).not.toThrow();
        });

        it('should throw error for empty account', () => {
            auth = new AzureAuth('', 'testaccesskey', mockPaths, {} as App);
            expect(() => auth.validateSettings()).toThrow('Azure Storage account name is required');
        });

        it('should throw error for empty access key', () => {
            auth = new AzureAuth('testaccount', '', mockPaths, {} as App);
            expect(() => auth.validateSettings()).toThrow('Azure Storage access key is required');
        });
    });

    describe('generateSasToken', () => {
        it('should generate valid SAS token', () => {
            const token = auth.generateSasToken();

            // Verify token contains required parameters
            expect(token).toContain('sv=2020-04-08'); // API version
            expect(token).toContain('ss=b'); // services (blob)
            expect(token).toContain('srt=sco'); // resource types
            expect(token).toContain('sp=rwdlac'); // permissions
            expect(token).toContain('st=2025-01-05T05%3A03%3A41Z'); // start time (URL encoded)
            expect(token).toContain('se=2025-01-05T06%3A03%3A41Z'); // expiry time (URL encoded)
            expect(token).toContain('spr=https'); // protocol
            expect(token).toContain('sig='); // signature
        });

        it('should generate different tokens with different timestamps', () => {
            const token1 = auth.generateSasToken();
            jest.advanceTimersByTime(1000); // Advance time by 1 second
            const token2 = auth.generateSasToken();
            expect(token1).not.toBe(token2);
        });
    });

    describe('ensureContainer', () => {
        it('should handle existing container', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 200,
                text: '<test>success</test>',
                headers: {}
            } as RequestUrlResponse);

            await expect(auth.ensureContainer()).resolves.not.toThrow();
            expect(mockPaths.getContainerUrl).toHaveBeenCalledWith(
                'testaccount',
                expect.any(String),
                'list'
            );
        });

        it('should create container when not found', async () => {
            // First call - container not found
            mockRequestUrl.mockResolvedValueOnce({
                status: 404,
                text: 'Not Found',
                headers: {}
            } as RequestUrlResponse);

            // Second call - container created
            mockRequestUrl.mockResolvedValueOnce({
                status: 201,
                text: 'Created',
                headers: {}
            } as RequestUrlResponse);

            await expect(auth.ensureContainer()).resolves.not.toThrow();
            expect(mockRequestUrl).toHaveBeenCalledTimes(2);
        });

        it('should handle public access not permitted', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 409,
                text: 'PublicAccessNotPermitted',
                headers: {}
            } as RequestUrlResponse);

            await expect(auth.ensureContainer()).rejects.toThrow(
                'Public access is not permitted on this storage account'
            );
        });

        it('should handle unexpected response', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 500,
                text: 'Internal Server Error',
                headers: {}
            } as RequestUrlResponse);

            await expect(auth.ensureContainer()).rejects.toThrow(
                'Unexpected response when checking container'
            );
        });
    });

    describe('testConnectivity', () => {
        it('should return success for existing container', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 200,
                text: '<test>success</test>',
                headers: {}
            } as RequestUrlResponse);

            const result = await auth.testConnectivity();
            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully connected');
        });

        it('should return success for non-existent container', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 404,
                text: 'Not Found',
                headers: {}
            } as RequestUrlResponse);

            const result = await auth.testConnectivity();
            expect(result.success).toBe(true);
            expect(result.message).toContain('will be created during sync');
        });

        it('should handle permission denied', async () => {
            mockRequestUrl.mockResolvedValueOnce({
                status: 403,
                text: 'Forbidden',
                headers: {}
            } as RequestUrlResponse);

            const result = await auth.testConnectivity();
            expect(result.success).toBe(false);
            expect(result.message).toContain('Permission denied');
        });

        it('should handle network errors', async () => {
            mockRequestUrl.mockRejectedValueOnce(new TypeError('Failed to connect'));

            const result = await auth.testConnectivity();
            expect(result.success).toBe(false);
            expect(result.message).toContain('Azure connection failed');
        });
    });
});
