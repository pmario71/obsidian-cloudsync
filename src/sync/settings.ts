import { App, Notice, PluginSettingTab, Setting, normalizePath, TextComponent } from "obsidian";
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

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Auto-sync delay')
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
            .setName('Logging level')
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


        const awsSetting = new Setting(containerEl)
            .setName('Enable S3')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.awsEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.awsEnabled = value;
                    await this.plugin.saveSettings();
                    requestAnimationFrame(() => this.display());
                }));

        const awsDescEl = awsSetting.descEl;
        const awsSetupLink = awsDescEl.createEl('a', {
            text: 'Setup guide for AWS S3',
            href: 'https://github.com/mihakralj/obsidian-cloudsync/blob/main/doc/aws.md'
        });
        awsSetupLink.setAttr('target', '_blank');

        if (this.plugin.settings.awsEnabled) {
            new Setting(containerEl)
                .setName('S3 bucket name')
                .setDesc('Globally unique bucket name')
                .addText(text => text
                    .setPlaceholder('Enter bucket name')
                    .setValue(this.plugin.settings.aws.bucket ?? '')
                    .onChange(async (value) => {
                        this.plugin.settings.aws.bucket = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Access key')
                .setDesc('Obtained from S3 provider')
                .addText(text => text
                    .setPlaceholder('Enter access key')
                    .setValue(this.plugin.settings.aws.accessKey ?? '')
                    .onChange(async (value) => {
                        this.plugin.settings.aws.accessKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
            .setName('Secret key')
            .setDesc('Retrieved at the time of access key creation')
                .addText(text => text
                    .setPlaceholder('Enter secret key')
                    .setValue(this.plugin.settings.aws.secretKey ?? '')
                    .onChange(async (value) => {
                        this.plugin.settings.aws.secretKey = value;
                        await this.plugin.saveSettings();
                    }));

            let endpointText: TextComponent;
            new Setting(containerEl)
                .setName('S3 endpoint')
                .setDesc('Optional. If empty, it will auto-discover AWS S3 endpoint')
                .addText(text => {
                    endpointText = text;
                    text.setPlaceholder('Enter S3 endpoint')
                        .setValue(this.plugin.settings.aws.endpoint ?? '')
                        .onChange(async (value) => {
                            this.plugin.settings.aws.endpoint = value;
                            await this.plugin.saveSettings();
                        });
                });

            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText('Test S3 connection')
                    .onClick(async () => {
                        try {
                            const localManager = await this.createLocalManager();
                            const vaultName = localManager.getVaultName();
                            const manager = new AWSManager(this.plugin.settings, vaultName);

                            const result = await manager.testConnectivity();
                            if (result.success) {
                                LogManager.log(LogLevel.Info, 'S3 connection test successful');
                                new Notice('S3 connection successful!');
                                if (this.plugin.settings.aws.endpoint) {
                                    endpointText.setValue(this.plugin.settings.aws.endpoint);
                                    await this.plugin.saveSettings();
                                }
                            } else {
                                LogManager.log(LogLevel.Error, 'S3 connection test failed', result);
                                new Notice(`S3 connection failed: ${result.message}`);
                            }
                        } catch (error) {
                            LogManager.log(LogLevel.Error, 'S3 connection test error', error);
                            showNotice(`S3 connection failed: ${error.message}`);
                        }
                    }))
                .addButton(button => button
                    .setButtonText('Clear S3 cache')
                    .onClick(() => this.clearCache('aws')));
        }

        const azureSetting = new Setting(containerEl)
            .setName('Enable Azure Storage')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.azureEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.azureEnabled = value;
                    await this.plugin.saveSettings();
                    requestAnimationFrame(() => this.display());
                }));

        const azureDescEl = azureSetting.descEl;
        const azureSetupLink = azureDescEl.createEl('a', {
            text: 'Setup guide',
            href: 'https://github.com/mihakralj/obsidian-cloudsync/blob/main/doc/azure.md'
        });
        azureSetupLink.setAttr('target', '_blank');

        if (this.plugin.settings.azureEnabled) {
            new Setting(containerEl)
                .setName('Storage account name')
                .setDesc('Globally unique name available in Azure portal under Storage Accounts')
                .addText(text => text
                    .setPlaceholder('Enter storage account name')
                    .setValue(this.plugin.settings.azure.account ?? '')
                    .onChange(async (value) => {
                        this.plugin.settings.azure.account = value;
                        await this.plugin.saveSettings();
                    }));
            new Setting(containerEl)
                .setName('Access key')
                .setDesc(`key1 or key2 available in Azure portal under Storage - Security - Access keys`)
                .addText(text => text
                    .setPlaceholder('Enter access key')
                    .setValue(this.plugin.settings.azure.accessKey ?? '')
                    .onChange(async (value) => {
                        this.plugin.settings.azure.accessKey = value;
                        await this.plugin.saveSettings();
                    }));
            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText('Test Azure connection')
                    .onClick(async () => {
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
                    }))
                .addButton(button => button
                    .setButtonText('Clear Azure cache')
                    .onClick(() => this.clearCache('azure')));
        }

        const gcpSetting = new Setting(containerEl)
            .setName('Enable Google Cloud Storage')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.gcpEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.gcpEnabled = value;
                    await this.plugin.saveSettings();
                    requestAnimationFrame(() => this.display());
                }));

        const gcpDescEl = gcpSetting.descEl;
        const gcpSetupLink = gcpDescEl.createEl('a', {
            text: 'Setup guide',
            href: 'https://github.com/mihakralj/obsidian-cloudsync/blob/main/doc/gcp.md'
        });
        gcpSetupLink.setAttr('target', '_blank');

        if (this.plugin.settings.gcpEnabled) {
            new Setting(containerEl)
                .setName('Storage bucket name')
                .setDesc('Retrieved from GCP Cloud Storage console')
                .addText(text => text
                    .setPlaceholder('Enter bucket name')
                    .setValue(this.plugin.settings.gcp.bucket ?? '')
                    .onChange(async (value) => {
                        this.plugin.settings.gcp.bucket = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Client email')
                .setDesc('Retrieved from .json file with keys and credentials')
                .addText(text => {
                    text.setPlaceholder('Enter client email')
                        .setValue(this.plugin.settings.gcp.clientEmail ?? '')
                        .onChange(async (value) => {
                            this.plugin.settings.gcp.clientEmail = value;
                            await this.plugin.saveSettings();
                        });

                    text.inputEl.addEventListener('blur', async () => {
                        const value = text.getValue().trim();
                        try {
                            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                            if (!emailRegex.test(value)) {
                                throw new Error('Invalid email format');
                            }

                            this.plugin.settings.gcp.clientEmail = value;
                            await this.plugin.saveSettings();
                            text.setValue(value);
                            text.inputEl.style.border = '';
                            text.inputEl.style.backgroundColor = '';
                        } catch (error) {
                            LogManager.log(LogLevel.Error, 'Invalid client email', error);
                            text.inputEl.style.border = '1px solid red';
                            text.inputEl.style.backgroundColor = 'rgba(255,0,0,0.1)';
                            showNotice(`Invalid client email: ${error.message}. Please enter a valid email address.`);
                        }
                    });

                    return text;
                });

            new Setting(containerEl)
                .setName('Private key')
                .setDesc('Retrieved from .json file with keys and credentials')
                .addTextArea(text => {
                    text.setPlaceholder('Enter private key JSON')
                        .setValue(this.plugin.settings.gcp.privateKey ?? '')
                        .onChange(async (value) => {
                            this.plugin.settings.gcp.privateKey = value;
                            await this.plugin.saveSettings();
                        });

                    text.inputEl.addEventListener('blur', async () => {
                        const value = text.getValue();
                        try {
                            let cleanedKey = value;
                            try {
                                const parsed = JSON.parse(value);
                                if (parsed.private_key) {
                                    cleanedKey = parsed.private_key;
                                }
                            } catch (e) {
                                // Ignore parse error - if it's not valid JSON, we'll use the raw value
                            }

                            cleanedKey = cleanedKey
                                .replace(/\\\\n/g, '\n')
                                .replace(/\\n/g, '\n')
                                .replace(/\s+/g, '');

                            const regex = /-----BEGIN[^-]+-----([^-]+)-----END[^-]+-----/;
                            const matches = regex.exec(cleanedKey);
                            if (!matches) {
                                throw new Error('Invalid PEM format: Missing header/footer');
                            }

                            const content = matches[1];
                            if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
                                throw new Error('Invalid base64 content');
                            }

                            try {
                                atob(content);
                            } catch (e) {
                                throw new Error('Invalid base64 content');
                            }

                            const lines = content.match(/.{1,64}/g) || [];
                            const formattedKey = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;

                            this.plugin.settings.gcp.privateKey = formattedKey;
                            await this.plugin.saveSettings();
                            text.setValue(formattedKey);
                            text.inputEl.style.border = '';
                            text.inputEl.style.backgroundColor = '';
                        } catch (error) {
                            LogManager.log(LogLevel.Error, 'Invalid private key', error);
                            this.plugin.settings.gcp.privateKey = '';
                            await this.plugin.saveSettings();
                            text.inputEl.style.border = '1px solid red';
                            text.inputEl.style.backgroundColor = 'rgba(255,0,0,0.1)';
                            showNotice(`Invalid private key: ${error.message}. Please check the key format and try again.`);
                            text.setValue('');
                        }
                    });

                    text.inputEl.rows = 4;
                    text.inputEl.style.width = '100%';
                    text.inputEl.style.minWidth = '300px';
                    return text;
                });

            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText('Test GCP connection')
                    .onClick(async () => {
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
                    }))
                .addButton(button => button
                    .setButtonText('Clear GCP cache')
                    .onClick(() => this.clearCache('gcp')));
        }

        new Setting(containerEl)
            .setName('Sync ignore list')
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
            .setName('Cloud vault name')
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
