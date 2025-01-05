import { App } from "obsidian";
import { CacheManagerService } from "./cacheUtils";
import { FileOperationService } from "./fileUtils";
import { ResourceManager } from "./timeoutUtils";
import { LogManager } from "../../LogManager";
import { LogLevel } from "../types";

export interface ServiceContainer {
    cacheManager: CacheManagerService;
    fileOperations: typeof FileOperationService;
    resourceManager: typeof ResourceManager;
}

export class Container {
    private static instance: Container;
    private readonly services: ServiceContainer;
    private readonly app: App;

    private constructor(app: App) {
        this.app = app;
        this.services = {
            cacheManager: CacheManagerService.getInstance(),
            fileOperations: FileOperationService,
            resourceManager: ResourceManager
        };

        LogManager.log(LogLevel.Debug, 'Service container initialized');
    }

    static getInstance(app: App): Container {
        if (!this.instance) {
            this.instance = new Container(app);
        }
        return this.instance;
    }

    getService<K extends keyof ServiceContainer>(serviceName: K): ServiceContainer[K] {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Service ${serviceName} not found in container`);
        }
        return service;
    }

    async cleanup(): Promise<void> {
        try {
            await this.services.resourceManager.cleanup();
            LogManager.log(LogLevel.Debug, 'Service container cleanup completed');
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Service container cleanup failed', error);
            throw error;
        }
    }
}

export function createFileOperations(app: App): FileOperationService {
    const container = Container.getInstance(app);
    return container.getService('fileOperations');
}

export function createCacheManager(app: App): CacheManagerService {
    const container = Container.getInstance(app);
    return container.getService('cacheManager');
}

export async function cleanupContainer(app: App): Promise<void> {
    const container = Container.getInstance(app);
    await container.cleanup();
}

export interface Cleanable {
    cleanup(): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerCleanup<T extends new (...args: any[]) => Cleanable>(constructor: T): T {
    return class extends constructor {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(...args: any[]) {
            super(...args);
            const app = args.find(arg => arg instanceof App);
            if (app) {
                const container = Container.getInstance(app);
                container.getService('resourceManager').registerCleanup(() => this.cleanup());
            }
        }
    };
}
