import { CloudSyncSettings, LogLevel } from "./types";
import { LocalManager } from "./localManager";
import { AbstractManager } from "./AbstractManager";
import { LogManager } from "../LogManager";
import { AzureManager } from "../Azure/AzureManager";
import { AWSManager } from "../AWS/AWSManager";
import { GCPManager } from "../GCP/GCPManager";
import { Synchronize } from "./Synchronize";
import { join } from "path";
import { Notice } from "obsidian";
import { CacheManager } from "./CacheManager";

export class CloudSyncMain {
    public localVault: LocalManager | null = null;
    public remoteVaults: AbstractManager[] = [];
    private app: any;
    private settings: CloudSyncSettings;
    private statusBar: HTMLElement;
    private syncIcon: Element | null = null;
    private pluginDir: string;

    constructor(
        app: any,
        settings: CloudSyncSettings,
        statusBar: HTMLElement,
        pluginDir: string
    ) {
        this.app = app;
        this.settings = settings;
        this.statusBar = statusBar;
        this.pluginDir = pluginDir;

        LogManager.log(LogLevel.Debug, 'CloudSync plugin initialized', {
            pluginDir,
            settings: {
                azureEnabled: settings.azureEnabled,
                awsEnabled: settings.awsEnabled,
                gcpEnabled: settings.gcpEnabled,
                autoSyncDelay: settings.autoSyncDelay
            }
        });
    }

    setSyncIcon(icon: Element | null) {
        this.syncIcon = icon;
        if (this.syncIcon) {
            // Reset icon state
            this.syncIcon.classList.remove('cloud-sync-spin', 'cloud-sync-error');
            // Set spinning state
            this.syncIcon.classList.add('cloud-sync-spin');
            LogManager.log(LogLevel.Debug, 'Sync icon activated');
        }
    }

    private setErrorIcon() {
        if (this.syncIcon) {
            // Remove spinning animation
            this.syncIcon.classList.remove('cloud-sync-spin');
            // Add error state
            this.syncIcon.classList.add('cloud-sync-error');
            LogManager.log(LogLevel.Debug, 'Error icon activated');
        }
    }

    private showError(error: Error | string) {
        const message = error instanceof Error ? error.message : error;
        // Show error in notice for 30 seconds to give time to read CORS instructions
        new Notice(message, 30000);
        LogManager.log(LogLevel.Error, message);
        this.setErrorIcon();
    }

    async runCloudSync(): Promise<void> {
        LogManager.log(LogLevel.Trace, 'Starting cloud synchronization');
        LogManager.addDelimiter();

        try {
            LogManager.log(LogLevel.Debug, 'Initializing local vault');
            const tempCachePath = join(this.pluginDir, 'cloudsync-temp.json');
            const tempCache = CacheManager.getInstance(tempCachePath, this.app);
            await tempCache.readCache();

            this.localVault = new LocalManager(this.settings, this.app, tempCache);

            const localConnectivity = await this.localVault.testConnectivity();
            if (!localConnectivity.success) {
                throw new Error(`Local vault access failed: ${localConnectivity.message}`);
            }
            LogManager.log(LogLevel.Debug, 'Local vault connectivity verified');

            const vaultName = this.localVault.getVaultName();
            LogManager.log(LogLevel.Debug, `Processing vault: ${vaultName}`);

            if (this.settings.azureEnabled) {
                LogManager.log(LogLevel.Trace, 'Azure sync starting');
                const azureVault = new AzureManager(this.settings, vaultName);
                await azureVault.authenticate();
                const sync = new Synchronize(this.localVault, azureVault, join(this.pluginDir, `cloudsync-${azureVault.name.toLowerCase()}.json`));
                const scenarios = await sync.syncActions();
                await sync.runAllScenarios(scenarios);
            }

            if (this.settings.awsEnabled) {
                LogManager.log(LogLevel.Trace, 'AWS sync starting');
                const awsVault = new AWSManager(this.settings, vaultName);
                await awsVault.authenticate();
                const sync = new Synchronize(this.localVault, awsVault, join(this.pluginDir, `cloudsync-${awsVault.name.toLowerCase()}.json`));
                const scenarios = await sync.syncActions();
                await sync.runAllScenarios(scenarios);
            }

            if (this.settings.gcpEnabled) {
                LogManager.log(LogLevel.Trace, 'GCP sync starting');
                const gcpVault = new GCPManager(this.settings, vaultName);
                await gcpVault.authenticate();
                const sync = new Synchronize(this.localVault, gcpVault, join(this.pluginDir, `cloudsync-${gcpVault.name.toLowerCase()}.json`));
                const scenarios = await sync.syncActions();
                await sync.runAllScenarios(scenarios);
            }

            LogManager.log(LogLevel.Trace, 'Cloud synchronization completed', undefined, false, false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.showError(errorMessage);
            throw error;
        } finally {
            if (this.syncIcon) {
                this.syncIcon.classList.remove('cloud-sync-spin');
                LogManager.log(LogLevel.Debug, 'Sync icon deactivated');
            }
        }
    }
}
