import { CloudSyncSettings, LogLevel } from "./types";
import { AuthenticationError, ConnectivityError, ConfigurationError } from "./errors";
import { LocalManager } from "./localManager";
import { AbstractManager } from "./AbstractManager";
import { LogManager, showNotice } from "../LogManager";
import { AzureManager } from "../Azure/AzureManager";
import { AWSManager } from "../AWS/AWSManager";
import { GCPManager } from "../GCP/GCPManager";
import { Synchronize } from "./Synchronize";
import { App, normalizePath } from "obsidian";
import { CacheManager } from "./CacheManager";

export class CloudSyncMain {
    public localVault: LocalManager | null = null;
    public remoteVaults: AbstractManager[] = [];
    private readonly app: App;
    private settings: CloudSyncSettings;
    private readonly statusBar: HTMLElement;
    private syncIcon: Element | null = null;

    constructor(
        app: App,
        settings: CloudSyncSettings,
        statusBar: HTMLElement
    ) {
        this.app = app;
        const { app: _, ...settingsWithoutApp } = settings;
        this.settings = {
            ...settingsWithoutApp,
            app: this.app
        };
        this.statusBar = statusBar;

        const settingsLog = {
            raw: {
                azureEnabled: settings.azureEnabled,
                awsEnabled: settings.awsEnabled,
                gcpEnabled: settings.gcpEnabled
            },
            merged: {
                azureEnabled: this.settings.azureEnabled,
                awsEnabled: this.settings.awsEnabled,
                gcpEnabled: this.settings.gcpEnabled
            }
        };
        LogManager.log(LogLevel.Debug, 'Settings object:', JSON.stringify(settingsLog, null, 2));

        LogManager.log(LogLevel.Debug, 'Provider status at construction:', {
            azure: settings.azureEnabled ? 'enabled' : 'disabled',
            aws: settings.awsEnabled ? 'enabled' : 'disabled',
            gcp: settings.gcpEnabled ? 'enabled' : 'disabled'
        });
    }

    updateSettings(settings: CloudSyncSettings): void {
        const { app: _, ...settingsWithoutApp } = settings;
        const settingsClone = JSON.parse(JSON.stringify(settingsWithoutApp));

        this.settings = {
            ...settingsClone,
            app: this.app
        };

        LogManager.log(LogLevel.Debug, 'CloudSyncMain settings update:', {
            raw: {
                azureEnabled: settings.azureEnabled,
                awsEnabled: settings.awsEnabled,
                gcpEnabled: settings.gcpEnabled
            },
            processed: {
                azureEnabled: this.settings.azureEnabled,
                awsEnabled: this.settings.awsEnabled,
                gcpEnabled: this.settings.gcpEnabled
            }
        });
    }

    setSyncIcon(icon: Element | null): void {
        this.syncIcon = icon;
        if (!this.syncIcon) {
            LogManager.log(LogLevel.Debug, 'No sync icon provided');
            return;
        }
        this.syncIcon.classList.remove('cloud-sync-spin', 'cloud-sync-error');
        this.syncIcon.classList.add('cloud-sync-spin');
        LogManager.log(LogLevel.Debug, 'Sync icon activated');
    }

    private setErrorIcon(): void {
        if (this.syncIcon) {
            this.syncIcon.classList.remove('cloud-sync-spin');
            this.syncIcon.classList.add('cloud-sync-error');
            LogManager.log(LogLevel.Debug, 'Error icon activated');
        }
    }

    private showError(error: Error | string): void {
        const message = error instanceof Error ? error.message : error;
        showNotice(message);
        LogManager.log(LogLevel.Error, message);
        this.setErrorIcon();
    }

    private validateProvider(provider: 'azure' | 'aws' | 'gcp'): boolean {
        try {
            switch (provider) {
                case 'azure': {
                    const settings = this.settings.azure;
                    if (!settings.account || !settings.accessKey) {
                        throw new ConfigurationError('Azure', 'Missing required settings: account and accessKey');
                    }
                    break;
                }
                case 'aws': {
                    const settings = this.settings.aws;
                    if (!settings.accessKey || !settings.secretKey || !settings.bucket) {
                        throw new ConfigurationError('AWS', 'Missing required settings: accessKey, secretKey, and bucket');
                    }
                    break;
                }
                case 'gcp': {
                    const settings = this.settings.gcp;
                    if (!settings.privateKey || !settings.clientEmail || !settings.bucket) {
                        throw new ConfigurationError('GCP', 'Missing required settings: privateKey, clientEmail, and bucket');
                    }
                    break;
                }
            }
            return true;
        } catch (error) {
            LogManager.log(LogLevel.Error, `${provider} validation failed`, error);
            this.showError(`${provider} validation failed: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    async runCloudSync(): Promise<void> {
        LogManager.log(LogLevel.Trace, 'Starting cloud synchronization');

        try {
            await this.initializeLocalVault();
            const vaultName = this.getVaultName();
            this.logProviderStatus();

            const providers = this.getProviders();
            for (const { name, enabled } of providers) {
                if (!enabled) {
                    LogManager.log(LogLevel.Debug, `Skipping ${name} sync - provider disabled`);
                    continue;
                }
                if (!this.validateProvider(name)) {
                    LogManager.log(LogLevel.Debug, `Skipping ${name} sync - validation failed`);
                    continue;
                }
                await this.syncProvider(name, vaultName);
            }

            LogManager.log(LogLevel.Trace, 'Cloud synchronization completed', undefined, false, false);
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Cloud sync failed', error);
            this.showError(`Cloud sync failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            if (this.syncIcon) {
                this.syncIcon.classList.remove('cloud-sync-spin');
                LogManager.log(LogLevel.Debug, 'Sync icon deactivated');
            }
        }
    }

    private async initializeLocalVault(): Promise<void> {
        LogManager.log(LogLevel.Debug, 'Initializing local vault');
        const tempCachePath = normalizePath(`${this.app.vault.configDir}/plugins/cloudsync/cloudsync-temp.json`);
        const tempCache = CacheManager.getInstance(tempCachePath, this.app);
        try {
            await tempCache.readCache();
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Failed to initialize cache, attempting recovery', error);
            await tempCache.clearCache();
        }

        this.localVault = new LocalManager(this.settings, this.app, tempCache);
        if (!this.localVault) {
            throw new ConfigurationError('Local vault', 'Failed to initialize');
        }

        const localConnectivity = await this.localVault.testConnectivity();
        if (!localConnectivity.success) {
            throw new ConnectivityError('local vault', localConnectivity.message);
        }
        LogManager.log(LogLevel.Debug, 'Local vault connectivity verified');
    }

    private getVaultName(): string {
        return this.settings.cloudVault !== '' ? this.settings.cloudVault : this.localVault?.getVaultName() ?? '';
    }

    private logProviderStatus(): void {
        LogManager.log(LogLevel.Debug, 'Provider status before sync:', {
            azure: this.settings.azureEnabled ? 'enabled' : 'disabled',
            aws: this.settings.awsEnabled ? 'enabled' : 'disabled',
            gcp: this.settings.gcpEnabled ? 'enabled' : 'disabled'
        });

        LogManager.log(LogLevel.Debug, 'Provider settings:', {
            azure: {
                enabled: this.settings.azureEnabled,
                hasAccount: !!this.settings.azure?.account,
                hasAccessKey: !!this.settings.azure?.accessKey
            },
            aws: {
                enabled: this.settings.awsEnabled,
                hasAccessKey: !!this.settings.aws?.accessKey,
                hasSecretKey: !!this.settings.aws?.secretKey,
                hasBucket: !!this.settings.aws?.bucket
            },
            gcp: {
                enabled: this.settings.gcpEnabled,
                hasPrivateKey: !!this.settings.gcp?.privateKey,
                hasClientEmail: !!this.settings.gcp?.clientEmail,
                hasBucket: !!this.settings.gcp?.bucket
            }
        });
    }

    private getProviders() {
        return [
            { name: 'azure', enabled: this.settings.azureEnabled },
            { name: 'aws', enabled: this.settings.awsEnabled },
            { name: 'gcp', enabled: this.settings.gcpEnabled }
        ] as const;
    }

    private async syncProvider(name: 'azure' | 'aws' | 'gcp', vaultName: string): Promise<void> {
        LogManager.log(LogLevel.Debug, `Starting ${name} sync - provider enabled and validated`);

        try {
            LogManager.addDelimiter();
            LogManager.log(LogLevel.Trace, `${name} sync starting`);

            let vault: AbstractManager;
            switch (name) {
                case 'azure':
                    vault = new AzureManager(this.settings, vaultName);
                    await vault.authenticate().catch(error => {
                        throw new AuthenticationError('Azure', error.message);
                    });
                    break;
                case 'aws':
                    vault = new AWSManager(this.settings, vaultName);
                    await vault.authenticate().catch(error => {
                        throw new AuthenticationError('AWS', error.message);
                    });
                    break;
                case 'gcp':
                    vault = new GCPManager(this.settings, this.settings.gcp, vaultName);
                    await (vault as GCPManager).initialize().catch(error => {
                        throw new AuthenticationError('GCP', error.message);
                    });
                    await vault.authenticate().catch(error => {
                        throw new AuthenticationError('GCP', error.message);
                    });
                    break;
            }

            if (!this.localVault) {
                throw new ConfigurationError('Local vault', 'Local vault is not initialized');
            }
            const cachePath = normalizePath(`${this.app.vault.configDir}/plugins/cloudsync/cloudsync-${name}.json`);
            const providerCache = CacheManager.getInstance(cachePath, this.app);
            try {
                await providerCache.readCache();
            } catch (error) {
                LogManager.log(LogLevel.Error, `Failed to initialize ${name} cache, attempting recovery`, error);
                await providerCache.clearCache();
            }

            const sync = new Synchronize(this.localVault, vault, cachePath);
            const scenarios = await sync.syncActions();
            await sync.runAllScenarios(scenarios);
        } catch (error) {
            LogManager.log(LogLevel.Error, `${name} sync failed`, error);
            this.showError(`${name} sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
