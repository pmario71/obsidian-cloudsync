import { Plugin, Notice } from "obsidian";
import { CloudSyncSettings, DEFAULT_SETTINGS } from "./types";
import { CloudSyncSettingTab } from "./settings";
import { AWSManager } from "./AWSManager";
import { AzureManager } from "./AzureManager";
import { GCPManager } from "./GCPManager";

export default class CloudSyncPlugin extends Plugin {
    settings: CloudSyncSettings;
    statusBar: HTMLElement | undefined;
    svgIcon: Element | null;
    settingTab: CloudSyncSettingTab;

    async onload() {
        await this.loadSettings();

        // Check if any cloud service is enabled
        const anyCloudEnabled = this.settings.azureEnabled ||
                              this.settings.awsEnabled ||
                              this.settings.gcpEnabled;

        // Add status bar item
        this.statusBar = this.addStatusBarItem();

        // Add ribbon icon
        const ribbonIconEl = this.addRibbonIcon(
            'refresh-cw',
            'Cloud Sync',
            async () => {
                const anyCloudEnabled = this.settings.azureEnabled ||
                                      this.settings.awsEnabled ||
                                      this.settings.gcpEnabled;

                if (!anyCloudEnabled) {
                    // @ts-ignore
                    this.app.setting.open();
                    // @ts-ignore
                    this.app.setting.activeTab = this.settingTab;
                    return;
                }

                this.svgIcon = ribbonIconEl.querySelector('.svg-icon');
                await this.runCloudSync();
            }
        );

        // Add settings tab
        this.settingTab = new CloudSyncSettingTab(this.app, this);
        this.addSettingTab(this.settingTab);

        // Open settings if no data exists or no clouds enabled
        if (!anyCloudEnabled) {
            // @ts-ignore
            this.app.setting.open();
            // @ts-ignore
            this.app.setting.activeTab = this.settingTab;
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
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

    async runCloudSync() {
        if (this.svgIcon) {
            this.svgIcon.classList.add("rotate-animation");
        }
        if (this.statusBar) {
            this.statusBar.setText("Syncing...");
        }

        try {
            // Load and initialize enabled providers
            if (this.settings.awsEnabled) {
                try {
                    const Manager = this.getProviderManager('aws');
                    const awsManager = new Manager(this.settings);
                    await awsManager.sync();
                } catch (err) {
                    console.error('Failed to sync AWS:', err);
                    new Notice(`AWS sync failed: ${err.message}`);
                }
            }

            if (this.settings.azureEnabled) {
                try {
                    const Manager = this.getProviderManager('azure');
                    const azureManager = new Manager(this.settings);
                    await azureManager.sync();
                } catch (err) {
                    console.error('Failed to sync Azure:', err);
                    new Notice(`Azure sync failed: ${err.message}`);
                }
            }

            if (this.settings.gcpEnabled) {
                try {
                    const Manager = this.getProviderManager('gcp');
                    const gcpManager = new Manager(this.settings);
                    await gcpManager.sync();
                } catch (err) {
                    console.error('Failed to sync GCP:', err);
                    new Notice(`GCP sync failed: ${err.message}`);
                }
            }

            if (this.statusBar) {
                this.statusBar.setText("Sync completed");
                setTimeout(() => {
                    if (this.statusBar) {
                        this.statusBar.setText("Idle");
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('Sync failed:', error);
            if (this.statusBar) {
                this.statusBar.setText("Sync failed");
                setTimeout(() => {
                    if (this.statusBar) {
                        this.statusBar.setText("Idle");
                    }
                }, 3000);
            }
        }

        if (this.svgIcon) {
            this.svgIcon.classList.remove("rotate-animation");
        }
    }
}
