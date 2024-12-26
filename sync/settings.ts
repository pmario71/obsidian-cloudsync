import { App, Notice, PluginSettingTab, Setting, normalizePath } from "obsidian";
import CloudSyncPlugin from "../main";
import { AWSManager } from "../AWS/AWSManager";
import { AzureManager } from "../Azure/AzureManager";
import { GCPManager } from "../GCP/GCPManager";
import { LogLevel } from "./types";
import { LogManager, showNotice } from "../LogManager";
import { LocalManager } from "./localManager";
import { CacheManager } from "./CacheManager";

export class CloudSyncSettingTab extends PluginSettingTab {
    plugin: CloudSyncPlugin;

    constructor(app: App, plugin: CloudSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private async createLocalManager(): Promise<LocalManager> {
        const pluginDir = this.plugin.manifest.dir;
        if (!pluginDir) {
            throw new Error('Plugin directory not found');
        }
        const tempCachePath = normalizePath(`${pluginDir}/cloudsync-temp.json`);
        const tempCache = CacheManager.getInstance(tempCachePath, this.app);
        await tempCache.readCache();
        return new LocalManager(this.plugin.settings, this.app, tempCache);
    }

    private async clearCache(provider: string) {
        try {
            const pluginDir = this.plugin.manifest.dir;
            if (!pluginDir) {
                throw new Error('Plugin directory not found');
            }
            const cacheFile = normalizePath(`${pluginDir}/cloudsync-${provider}.json`);
            if (await this.app.vault.adapter.exists(cacheFile)) {
                await this.app.vault.adapter.remove(cacheFile);
                LogManager.log(LogLevel.Info, `Cache cleared for ${provider}`, undefined, true, false);
                new Notice(`Cache cleared for ${provider}`);
            } else {
                LogManager.log(LogLevel.Info, `No cache file found for ${provider}`, undefined, true, false);
                new Notice(`No cache file found for ${provider}`);
            }
        } catch (error) {
            LogManager.log(LogLevel.Error, `Failed to clear cache for ${provider}`, error);
             showNotice(`Failed to clear cache for ${provider}: ${error.message}`);
        }
    }

    private createProviderSettings(
        containerEl: HTMLElement,
        provider: {
            name: string,
            enabled: boolean,
            setupGuide: string,
            testConnection: () => Promise<void>,
            settings: { [key: string]: string | undefined }
        }
    ) {
        const setting = new Setting(containerEl)
            .setName(`Enable ${provider.name}`)
            .addToggle(toggle => toggle
                .setValue(provider.enabled)
                .onChange(async (value) => {
                    provider.enabled = value;
                    await this.plugin.saveSettings();
                    requestAnimationFrame(() => this.display());
                }));

        const descEl = setting.descEl;
        const setupLink = descEl.createEl('a', {
            text: 'Setup guide',
            href: provider.setupGuide
        });
        setupLink.setAttr('target', '_blank');

        if (provider.enabled) {
            // Add settings fields
            Object.entries(provider.settings).forEach(([key, value]) => {
                new Setting(containerEl)
                    .setName(key)
                    .setDesc(`Enter ${key.toLowerCase()}`)
                    .addText(text => text
                        .setPlaceholder(`Enter ${key.toLowerCase()}`)
                        .setValue(value ?? '')
                        .onChange(async (newValue) => {
                            provider.settings[key] = newValue;
                            await this.plugin.saveSettings();
                        }));
            });

            // Add test and clear cache buttons
            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText(`Test ${provider.name} Connection`)
                    .onClick(provider.testConnection))
                .addButton(button => button
                    .setButtonText(`Clear ${provider.name} Cache`)
                    .onClick(() => this.clearCache(provider.name.toLowerCase())));
        }
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Auto-Sync Delay')
            .setDesc('How long to wait after changes before auto-syncing')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    '0': 'Disabled',
                    '10': '10 seconds',
                    '30': '30 seconds',
                    '60': '60 seconds',
                    '180' : '3 minutes'
                })
                .setValue(this.plugin.settings.autoSyncDelay.toString())
                .onChange(async (value) => {
                    this.plugin.settings.autoSyncDelay = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Logging Level')
            .setDesc('Set the level of logging detail')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    [LogLevel.None]: 'None',
                    [LogLevel.Info]: 'Info',
                    [LogLevel.Trace]: 'Trace',
                    [LogLevel.Debug]: 'Debug'
                })
                .setValue(this.plugin.settings.logLevel)
                .onChange(async (value: LogLevel) => {
                    await this.plugin.handleLogLevelChange(value);
                    await this.plugin.saveSettings();
                }));

        // Azure settings
        this.createProviderSettings(containerEl, {
            name: 'Azure Storage',
            enabled: this.plugin.settings.azureEnabled,
            setupGuide: 'https://github.com/mihakralj/obsidian-cloudsync/blob/main/doc/azure.md',
            testConnection: async () => {
                try {
                    const localManager = await this.createLocalManager();
                    const vaultName = localManager.getVaultName();
                    const manager = new AzureManager(this.plugin.settings, vaultName);
                    const result = await manager.testConnectivity();
                    if (result.success) {
                        LogManager.log(LogLevel.Info, 'Azure connection test successful');
                        new Notice('Azure connection successful!');
                    } else {
                        LogManager.log(LogLevel.Error, 'Azure connection test failed', result);
                        new Notice(`Azure connection failed: ${result.message}`);
                    }
                } catch (error) {
                    LogManager.log(LogLevel.Error, 'Azure connection test error', error);
                    showNotice(`Azure connection failed: ${error.message}`);
                }
            },
            settings: {
                'Storage Account Name': this.plugin.settings.azure.account,
                'Access Key': this.plugin.settings.azure.accessKey
            }
        });

        // AWS settings
        this.createProviderSettings(containerEl, {
            name: 'AWS S3',
            enabled: this.plugin.settings.awsEnabled,
            setupGuide: 'https://github.com/mihakralj/obsidian-cloudsync/blob/main/doc/aws.md',
            testConnection: async () => {
                try {
                    const localManager = await this.createLocalManager();
                    const vaultName = localManager.getVaultName();
                    const manager = new AWSManager(this.plugin.settings, vaultName);

                    const region = await manager.discoverRegion();
                    this.plugin.settings.aws.region = region;
                    await this.plugin.saveSettings();
                    LogManager.log(LogLevel.Debug, 'Discovered and saved region', { region });

                    const result = await manager.testConnectivity();
                    if (result.success) {
                        LogManager.log(LogLevel.Info, 'AWS connection test successful');
                        new Notice('AWS connection successful!');
                    } else {
                        LogManager.log(LogLevel.Error, 'AWS connection test failed', result);
                        new Notice(`AWS connection failed: ${result.message}`);
                    }
                } catch (error) {
                    LogManager.log(LogLevel.Error, 'AWS connection test error', error);
                    showNotice(`AWS connection failed: ${error.message}`);
                }
            },
            settings: {
                'S3 Bucket Name': this.plugin.settings.aws.bucket,
                'Access Key': this.plugin.settings.aws.accessKey,
                'Secret Key': this.plugin.settings.aws.secretKey
            }
        });

        // GCP settings
        this.createProviderSettings(containerEl, {
            name: 'Google Cloud Storage',
            enabled: this.plugin.settings.gcpEnabled,
            setupGuide: 'https://github.com/mihakralj/obsidian-cloudsync/blob/main/doc/gcp.md',
            testConnection: async () => {
                try {
                    const localManager = await this.createLocalManager();
                    const vaultName = localManager.getVaultName();
                    const manager = new GCPManager(this.plugin.settings, this.plugin.settings.gcp, vaultName);
                    await manager.initialize();
                    const result = await manager.testConnectivity();
                    if (result.success) {
                        LogManager.log(LogLevel.Info, 'GCP connection test successful');
                        new Notice('GCP connection successful!');
                    } else {
                        LogManager.log(LogLevel.Error, 'GCP connection test failed', result);
                        new Notice(`GCP connection failed: ${result.message}`);
                    }
                } catch (error) {
                    LogManager.log(LogLevel.Error, 'GCP connection test error', error);
                    showNotice(`GCP connection failed: ${error.message}`);
                }
            },
            settings: {
                'Storage Bucket Name': this.plugin.settings.gcp.bucket,
                'Client Email': this.plugin.settings.gcp.clientEmail,
                'Private Key': this.plugin.settings.gcp.privateKey
            }
        });

        new Setting(containerEl)
            .setName('Sync Ignore List')
            .setDesc('List of files/folders to ignore during sync (one per line)')
            .addTextArea(text => text
                .setPlaceholder('Enter paths to ignore')
                .setValue(this.plugin.settings.syncIgnore)
                .onChange(async (value) => {
                    this.plugin.settings.syncIgnore = value;
                    await this.plugin.saveSettings();
                }));

        const pluginDir = this.plugin.manifest.dir;
        if (!pluginDir) {
            throw new Error('Plugin directory not found');
        }
        const tempCachePath = normalizePath(`${pluginDir}/cloudsync-temp.json`);
        const tempCache = CacheManager.getInstance(tempCachePath, this.app);
        const localManager = new LocalManager(this.plugin.settings, this.app, tempCache);
        const defaultVaultName = localManager.getVaultName();

        new Setting(containerEl)
            .setName('Cloud Vault Name')
            .setDesc('Top-level cloud storage container used for sync. Leave empty to use vault name.')
            .addText(text => text
                .setPlaceholder(defaultVaultName)
                .setValue(this.plugin.settings.cloudVault)
                .onChange(async (value) => {
                    this.plugin.settings.cloudVault = value;
                    await this.plugin.saveSettings();
                }));
    }
}
