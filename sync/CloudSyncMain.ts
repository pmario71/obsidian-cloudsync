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

        this.log(LogLevel.Debug, 'CloudSync plugin initialized', {
            pluginDir,
            settings: {
                azureEnabled: settings.azureEnabled,
                awsEnabled: settings.awsEnabled,
                gcpEnabled: settings.gcpEnabled,
                autoSyncDelay: settings.autoSyncDelay
            }
        });
    }

    private log(level: LogLevel, message: string, data?: any) {
        LogManager.log(level, message, data);
    }

    setSyncIcon(icon: Element | null) {
        this.syncIcon = icon;
        if (this.syncIcon) {
            // Reset icon state
            this.syncIcon.classList.remove('cloud-sync-spin', 'cloud-sync-error');
            // Set spinning state
            this.syncIcon.classList.add('cloud-sync-spin');
            this.log(LogLevel.Debug, 'Sync icon activated');
        }
    }

    private setErrorIcon() {
        if (this.syncIcon) {
            // Remove spinning animation
            this.syncIcon.classList.remove('cloud-sync-spin');
            // Add error state
            this.syncIcon.classList.add('cloud-sync-error');
            this.log(LogLevel.Debug, 'Error icon activated');
        }
    }

    private showError(error: Error | string) {
        const message = error instanceof Error ? error.message : error;
        // Show error in notice for 30 seconds to give time to read CORS instructions
        new Notice(message, 30000);
        this.log(LogLevel.Error, message);
        this.setErrorIcon();
    }

    async runCloudSync(): Promise<void> {
        this.log(LogLevel.Trace, 'Starting cloud synchronization');

        try {
            this.log(LogLevel.Debug, 'Initializing local vault');
            this.localVault = await Promise.resolve(new LocalManager(this.settings, this.app));

            const localConnectivity = await this.localVault.testConnectivity();
            if (!localConnectivity.success) {
                throw new Error(`Local vault access failed: ${localConnectivity.message}`);
            }
            this.log(LogLevel.Debug, 'Local vault connectivity verified');

            const vaultName = this.localVault.getVaultName();
            this.log(LogLevel.Debug, `Processing vault: ${vaultName}`);

            if (this.settings.azureEnabled) {
                this.log(LogLevel.Trace, 'Starting Azure sync');
                const azureVault = new AzureManager(this.settings, vaultName);
                await azureVault.authenticate();
                const sync = new Synchronize(this.localVault, azureVault, join(this.pluginDir, `cloudsync-${azureVault.name.toLowerCase()}.json`));
                const scenarios = await sync.syncActions();
                await sync.runAllScenarios(scenarios);
                LogManager.log(LogLevel.Info, 'Azure sync completed', undefined, false, true);
            }

            if (this.settings.awsEnabled) {
                this.log(LogLevel.Trace, 'Starting AWS sync');
                const awsVault = new AWSManager(this.settings, vaultName);
                await awsVault.authenticate();
                const sync = new Synchronize(this.localVault, awsVault, join(this.pluginDir, `cloudsync-${awsVault.name.toLowerCase()}.json`));
                const scenarios = await sync.syncActions();
                await sync.runAllScenarios(scenarios);
                LogManager.log(LogLevel.Info, 'AWS sync completed', undefined, false, true);
            }

            if (this.settings.gcpEnabled) {
                this.log(LogLevel.Trace, 'Starting GCP sync');
                const gcpVault = new GCPManager(this.settings, vaultName);
                await gcpVault.authenticate();
                const sync = new Synchronize(this.localVault, gcpVault, join(this.pluginDir, `cloudsync-${gcpVault.name.toLowerCase()}.json`));
                const scenarios = await sync.syncActions();
                await sync.runAllScenarios(scenarios);
                LogManager.log(LogLevel.Info, 'GCP sync completed', undefined, false, true);
            }

            LogManager.log(LogLevel.Info, 'Cloud synchronization completed', undefined, false, false);
            LogManager.addDelimiter();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.showError(errorMessage);
            throw error;
        } finally {
            if (this.syncIcon) {
                this.syncIcon.classList.remove('cloud-sync-spin');
                this.log(LogLevel.Debug, 'Sync icon deactivated');
            }
        }
    }
}
