import { Plugin, Notice, WorkspaceLeaf } from "obsidian";
import { CloudSyncSettings, DEFAULT_SETTINGS, LogLevel } from "./types";
import { CloudSyncSettingTab } from "./settings";
import { LogView, LOG_VIEW_TYPE } from "./LogView";
import { CloudSyncMain } from "./CloudSyncMain";
import { AbstractManager } from "./AbstractManager";
import { LogManager } from "./LogManager";

export default class CloudSyncPlugin extends Plugin {
    settings: CloudSyncSettings;
    statusBar: HTMLElement | undefined;
    settingTab: CloudSyncSettingTab;
    logView: LogView | null = null;
    cloudSync: CloudSyncMain;

    async onload() {
        await this.loadSettings();

        // Set up logging function
        LogManager.setLogFunction((message: string, type?: 'info' | 'error' | 'trace' | 'success' | 'debug') => {
            this.baseLog(message, type);
        });

        // Check if any cloud service is enabled
        const anyCloudEnabled = this.settings.azureEnabled ||
                              this.settings.awsEnabled ||
                              this.settings.gcpEnabled;

        // Add status bar item
        this.statusBar = this.addStatusBarItem();

        // Initialize CloudSyncMain
        this.cloudSync = new CloudSyncMain(
            this.app,
            this.settings,
            this.statusBar
        );

        // Register view
        this.registerView(
            LOG_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => (this.logView = new LogView(leaf, this))
        );

        // Always activate log view on plugin load
        await this.activateLogView();

        // Log plugin start
        LogManager.log(LogLevel.Trace, 'Cloud Sync plugin started');

        // Add ribbon icon
        const ribbonIconEl = this.addRibbonIcon(
            'refresh-cw',
            'Cloud Sync',
            async () => {
                const anyCloudEnabled = this.settings.azureEnabled ||
                                      this.settings.awsEnabled ||
                                      this.settings.gcpEnabled;

                if (!anyCloudEnabled) {
                    LogManager.log(LogLevel.Error, 'No cloud services enabled. Please enable at least one service in settings.');
                    // @ts-ignore
                    this.app.setting.open();
                    // @ts-ignore
                    this.app.setting.activeTab = this.settingTab;
                    return;
                }

                const svgIcon = ribbonIconEl.querySelector('.svg-icon');
                this.cloudSync.setSyncIcon(svgIcon);
                await this.cloudSync.runCloudSync();
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

    private async activateLogView() {
        if (this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE).length === 0) {
            const leaf = this.app.workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: LOG_VIEW_TYPE,
                    active: true,
                });
            }
        }
        // Ensure logView is set
        const leaves = this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE);
        if (leaves.length > 0) {
            this.logView = leaves[0].view as LogView;
        }
    }

    async onunload() {
        LogManager.log(LogLevel.Info, 'Cloud Sync plugin unloaded');
        // Clean up the view when plugin is disabled
        this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE).forEach((leaf) => {
            leaf.detach();
        });
    }

    private shouldLog(type: 'info' | 'error' | 'trace' | 'success' | 'debug'): boolean {
        switch (this.settings.logLevel) {
            case LogLevel.None:
                return false;
            case LogLevel.Info:
                return type === 'error' || type === 'info';
            case LogLevel.Trace:
                return type === 'error' || type === 'info' || type === 'trace';
            case LogLevel.Debug:
                return true;
            default:
                return false;
        }
    }

    private baseLog(message: string, type: 'info' | 'error' | 'trace' | 'success' | 'debug' = 'info'): void {
        // For LogLevel.None, show errors in modal
        if (this.settings.logLevel === LogLevel.None && type === 'error') {
            new Notice(message, 10000); // Show error in modal for 10 seconds
            return;
        }

        if (!this.shouldLog(type)) {
            return;
        }

        if (this.logView) {
            this.logView.addLogEntry(message, type);
        }
    }
}
