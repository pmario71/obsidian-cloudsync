import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import CloudSyncPlugin from "./main";
import { CloudSyncSettings } from "./types";
import { AWSManager } from "./AWSManager";
import { AzureManager } from "./AzureManager";
import { GCPManager } from "./GCPManager";

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

    private async debugProviderState(name: string): Promise<string> {
        try {
            const Manager = this.getProviderManager(name);
            const manager = new Manager(this.plugin.settings);
            const result = await manager.testConnectivity();
            return `${name.toUpperCase()}: ${result.success ? '✓ Connected' : '✗ Not Connected'} - ${result.message}`;
        } catch (error) {
            return `${name.toUpperCase()}: ✗ Error - ${error.message}`;
        }
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        
        // Debug Settings
        new Setting(containerEl)
            .setName('Enable Debug Logging')
            .setDesc('Enable debug logging to console')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.debugEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Debug Status')
            .setDesc('Show current status of all providers and settings')
            .addButton(button => button
                .setButtonText('Show Debug Info')
                .onClick(async () => {
                    const debugInfo = [];
                    debugInfo.push('=== Cloud Sync Debug Info ===');
                    debugInfo.push(`Debug Logging: ${this.plugin.settings.debugEnabled ? 'Enabled' : 'Disabled'}`);

                    // Provider Status
                    debugInfo.push('\n=== Provider Status ===');
                    if (this.plugin.settings.azureEnabled) {
                        debugInfo.push(await this.debugProviderState('azure'));
                    }
                    if (this.plugin.settings.awsEnabled) {
                        debugInfo.push(await this.debugProviderState('aws'));
                    }
                    if (this.plugin.settings.gcpEnabled) {
                        debugInfo.push(await this.debugProviderState('gcp'));
                    }

                    // Settings Status
                    debugInfo.push('\n=== Settings Status ===');
                    if (this.plugin.settings.azureEnabled) {
                        debugInfo.push('Azure Settings:');
                        debugInfo.push(`- Account: ${this.plugin.settings.azure.account ? '✓ Set' : '✗ Not Set'}`);
                        debugInfo.push(`- Access Key: ${this.plugin.settings.azure.accessKey ? '✓ Set' : '✗ Not Set'}`);
                    }
                    if (this.plugin.settings.awsEnabled) {
                        debugInfo.push('AWS Settings:');
                        debugInfo.push(`- Access Key: ${this.plugin.settings.aws.accessKey ? '✓ Set' : '✗ Not Set'}`);
                        debugInfo.push(`- Secret Key: ${this.plugin.settings.aws.secretKey ? '✓ Set' : '✗ Not Set'}`);
                        debugInfo.push(`- Region: ${this.plugin.settings.aws.region || '✗ Not Set'}`);
                        debugInfo.push(`- Bucket: ${this.plugin.settings.aws.bucket || '✗ Not Set'}`);
                    }
                    if (this.plugin.settings.gcpEnabled) {
                        debugInfo.push('GCP Settings:');
                        debugInfo.push(`- Private Key: ${this.plugin.settings.gcp.privateKey ? '✓ Set' : '✗ Not Set'}`);
                        debugInfo.push(`- Client Email: ${this.plugin.settings.gcp.clientEmail ? '✓ Set' : '✗ Not Set'}`);
                        debugInfo.push(`- Bucket: ${this.plugin.settings.gcp.bucket || '✗ Not Set'}`);
                    }

                    // Sync Ignore Status
                    debugInfo.push('\n=== Sync Ignore Rules ===');
                    const ignoreRules = this.plugin.settings.syncIgnore.split('\n').filter(rule => rule.trim());
                    if (ignoreRules.length > 0) {
                        ignoreRules.forEach(rule => debugInfo.push(`- ${rule}`));
                    } else {
                        debugInfo.push('No ignore rules set');
                    }

                    // Show debug info in notice
                    new Notice(debugInfo.join('\n'), 20000); // Show for 20 seconds

                    // Also log to console if debug logging is enabled
                    if (this.plugin.settings.debugEnabled) {
                        console.log(debugInfo.join('\n'));
                    }
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
                            const Manager = this.getProviderManager('azure');
                            const manager = new Manager(this.plugin.settings);
                            const result = await manager.testConnectivity();
                            if (result.success) {
                                new Notice('Azure connection successful!');
                            } else {
                                new Notice(`Azure connection failed: ${result.message}`);
                            }
                        } catch (error) {
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
                .setName('Region')
                .setDesc('Your AWS region')
                .addText(text => text
                    .setPlaceholder('Enter region')
                    .setValue(this.plugin.settings.aws.region)
                    .onChange(async (value) => {
                        this.plugin.settings.aws.region = value;
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
                            const Manager = this.getProviderManager('aws');
                            const manager = new Manager(this.plugin.settings);
                            const result = await manager.testConnectivity();
                            if (result.success) {
                                new Notice('AWS connection successful!');
                            } else {
                                new Notice(`AWS connection failed: ${result.message}`);
                            }
                        } catch (error) {
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
                            const Manager = this.getProviderManager('gcp');
                            const manager = new Manager(this.plugin.settings);
                            const result = await manager.testConnectivity();
                            if (result.success) {
                                new Notice('GCP connection successful!');
                            } else {
                                new Notice(`GCP connection failed: ${result.message}`);
                            }
                        } catch (error) {
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
