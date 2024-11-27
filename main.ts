import { Plugin, Notice, WorkspaceLeaf, FileSystemAdapter } from "obsidian";
import { CloudSyncSettings, DEFAULT_SETTINGS, LogLevel } from "./types";
import { CloudSyncSettingTab } from "./settings";
import { LogView, LOG_VIEW_TYPE } from "./LogView";
import { CloudSyncMain } from "./CloudSyncMain";
import { AbstractManager } from "./AbstractManager";
import { LogManager } from "./LogManager";
import { join } from "path";

export default class CloudSyncPlugin extends Plugin {
    settings: CloudSyncSettings;
    statusBar: HTMLElement | undefined;
    settingTab: CloudSyncSettingTab;
    logView: LogView | null = null;
    cloudSync: CloudSyncMain;

    async onload() {
        // Load styles first
        this.loadStyles();

        // Register view after styles are loaded
        this.registerView(
            LOG_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => (this.logView = new LogView(leaf, this))
        );

        // Activate log view immediately
        await this.activateLogView();

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

        // Get plugin directory path
        let pluginDir = '.';
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            const basePath = (this.app.vault.adapter).getBasePath();
            const manifestDir = this.manifest.dir || '.';
            pluginDir = join(basePath, manifestDir);
        }

        // Initialize CloudSyncMain
        this.cloudSync = new CloudSyncMain(
            this.app,
            this.settings,
            this.statusBar,
            pluginDir
        );

        // Log plugin start
        LogManager.log(LogLevel.Trace, 'Plugin started');
        LogManager.log(LogLevel.Debug, `Plugin directory: ${pluginDir}`);

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

        // automatically run cloudSync on load
        //await this.cloudSync.runCloudSync();
    }

    private loadStyles() {
        const customStyles = document.createElement('style');
        customStyles.id = 'cloud-sync-custom-styles';
        customStyles.textContent = `
            .cloud-sync-log-container {
                padding: 4px;
                height: 100%;
                overflow-y: auto;
                font-size: 10px;
                line-height: 1.2;
                user-select: text;
                -webkit-user-select: text;
                cursor: text;
                pointer-events: auto;
            }

            .cloud-sync-log-entry {
                margin-bottom: 1px;
                padding: 2px 4px;
                border-radius: 2px;
                display: flex;
                gap: 4px;
                user-select: text;
                -webkit-user-select: text;
                pointer-events: auto;
            }

            .cloud-sync-log-timestamp {
                color: var(--text-muted);
                white-space: nowrap;
                user-select: text;
                -webkit-user-select: text;
                pointer-events: auto;
            }

            .cloud-sync-log-type {
                color: var(--text-muted);
                font-size: 9px;
                text-transform: uppercase;
                padding: 0 4px;
                border-radius: 2px;
                white-space: nowrap;
                user-select: text;
                -webkit-user-select: text;
                pointer-events: auto;
            }

            .cloud-sync-log-content {
                flex: 1;
                word-break: break-word;
                user-select: text;
                -webkit-user-select: text;
                pointer-events: auto;
            }

            .cloud-sync-log-info {
                background-color: var(--background-secondary);
            }

            .cloud-sync-log-error {
                background-color: var(--background-primary);
                color: var(--text-error);
                border-left: 2px solid var(--text-error);
            }

            .cloud-sync-log-success {
                background-color: var(--background-modifier-success);
                color: var(--text-success);
            }

            .cloud-sync-log-trace {
                background-color: var(--background-secondary-alt);
                color: var(--text-muted);
                border-left: 2px solid var(--text-muted);
            }

            .cloud-sync-log-debug {
                background-color: var(--background-primary);
                color: var(--text-faint);
                border-left: 2px solid var(--text-faint);
            }

            .workspace-leaf-content[data-type="cloud-sync-log-view"] {
                pointer-events: auto;
                user-select: text;
                -webkit-user-select: text;
            }
        `;
        document.head.appendChild(customStyles);
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
        LogManager.log(LogLevel.Trace, 'Plugin unloaded');
        // Remove custom styles
        const customStyles = document.getElementById('cloud-sync-custom-styles');
        if (customStyles) {
            customStyles.remove();
        }
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
