import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import CloudSyncPlugin from "./main";
import { AWSManager } from "./AWS/AWSManager";
import { AzureManager } from "./Azure/AzureManager";
import { GCPManager } from "./GCP/GCPManager";
import { LogLevel } from "./types";
import { LogManager } from "./LogManager";
import { LocalManager } from "./localManager";

export class CloudSyncSettingTab extends PluginSettingTab {
    plugin: CloudSyncPlugin;

    constructor(app: App, plugin: CloudSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private getProviderManager(name: string) {
        switch (name) {
            case 'aws':
                return AWSManager;
            case 'azure':
                return AzureManager;
            case 'gcp':
                return GCPManager;
            default:
                throw new Error(`Unknown provider: ${name}`);
        }
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        // Logging Settings
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
                    this.plugin.settings.logLevel = value;
                    await this.plugin.saveSettings();
                }));

        // Azure Settings
        new Setting(containerEl)
            .setName('Enable Azure Storage')
            .setDesc('')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.azureEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.azureEnabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the display to update visibility
                }));

        if (this.plugin.settings.azureEnabled) {
            new Setting(containerEl)
                .setName('Storage Account Name')
                .setDesc('Your Azure Storage account name')
                .addText(text => text
                    .setPlaceholder('Enter storage account name')
                    .setValue(this.plugin.settings.azure.account)
                    .onChange(async (value) => {
                        this.plugin.settings.azure.account = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Access Key')
                .setDesc('Your Azure Storage access key')
                .addText(text => text
                    .setPlaceholder('Enter access key')
                    .setValue(this.plugin.settings.azure.accessKey)
                    .onChange(async (value) => {
                        this.plugin.settings.azure.accessKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText('Test Connection')
                    .onClick(async () => {
                        try {
                            const localManager = new LocalManager(this.plugin.settings, this.app);
                            const vaultName = localManager.getVaultName();
                            const Manager = this.getProviderManager('azure');
                            const manager = new Manager(this.plugin.settings, vaultName);
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
                            new Notice(`Azure connection failed: ${error.message}`);
                        }
                    }));
        }

        // AWS Settings
        new Setting(containerEl)
            .setName('Enable AWS S3')
            .setDesc('')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.awsEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.awsEnabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the display to update visibility
                }));

        if (this.plugin.settings.awsEnabled) {
            new Setting(containerEl)
                .setName('Access Key')
                .setDesc('Your AWS access key')
                .addText(text => text
                    .setPlaceholder('Enter access key')
                    .setValue(this.plugin.settings.aws.accessKey)
                    .onChange(async (value) => {
                        this.plugin.settings.aws.accessKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Secret Key')
                .setDesc('Your AWS secret key')
                .addText(text => text
                    .setPlaceholder('Enter secret key')
                    .setValue(this.plugin.settings.aws.secretKey)
                    .onChange(async (value) => {
                        this.plugin.settings.aws.secretKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Bucket')
                .setDesc('Your S3 bucket name')
                .addText(text => text
                    .setPlaceholder('Enter bucket name')
                    .setValue(this.plugin.settings.aws.bucket)
                    .onChange(async (value) => {
                        this.plugin.settings.aws.bucket = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText('Test Connection')
                    .onClick(async () => {
                        try {
                            const localManager = new LocalManager(this.plugin.settings, this.app);
                            const vaultName = localManager.getVaultName();
                            const Manager = this.getProviderManager('aws');
                            const manager = new Manager(this.plugin.settings, vaultName) as AWSManager;

                            // First discover region
                            const region = await manager.discoverRegion();
                            this.plugin.settings.aws.region = region;
                            await this.plugin.saveSettings();
                            LogManager.log(LogLevel.Debug, 'Discovered and saved region', { region });

                            // Then test connectivity
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
                            new Notice(`AWS connection failed: ${error.message}`);
                        }
                    }));
        }

        // GCP Settings
        new Setting(containerEl)
            .setName('Enable Google Cloud Storage')
            .setDesc('')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.gcpEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.gcpEnabled = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the display to update visibility
                }));

        if (this.plugin.settings.gcpEnabled) {
            new Setting(containerEl)
                .setName('Private Key')
                .setDesc('Your GCP service account private key')
                .addTextArea(text => text
                    .setPlaceholder('Enter private key JSON')
                    .setValue(this.plugin.settings.gcp.privateKey)
                    .onChange(async (value) => {
                        this.plugin.settings.gcp.privateKey = value;
                        await this.plugin.saveSettings();
                    })
                    .inputEl.rows = 4);

            new Setting(containerEl)
                .setName('Client Email')
                .setDesc('Your GCP service account client email')
                .addText(text => text
                    .setPlaceholder('Enter client email')
                    .setValue(this.plugin.settings.gcp.clientEmail)
                    .onChange(async (value) => {
                        this.plugin.settings.gcp.clientEmail = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Bucket')
                .setDesc('Your GCS bucket name')
                .addText(text => text
                    .setPlaceholder('Enter bucket name')
                    .setValue(this.plugin.settings.gcp.bucket)
                    .onChange(async (value) => {
                        this.plugin.settings.gcp.bucket = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .addButton(button => button
                    .setButtonText('Test Connection')
                    .onClick(async () => {
                        try {
                            const localManager = new LocalManager(this.plugin.settings, this.app);
                            const vaultName = localManager.getVaultName();
                            const Manager = this.getProviderManager('gcp');
                            const manager = new Manager(this.plugin.settings, vaultName);
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
                            new Notice(`GCP connection failed: ${error.message}`);
                        }
                    }));
        }

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
    }
}
