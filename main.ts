import { Plugin, Notice, WorkspaceLeaf, FileSystemAdapter } from "obsidian";
import { CloudSyncSettings, DEFAULT_SETTINGS, LogLevel } from "./sync/types";
import { CloudSyncSettingTab } from "./sync/settings";
import { LogView, LOG_VIEW_TYPE } from "./LogView";
import { CloudSyncMain } from "./sync/CloudSyncMain";
import { LogManager } from "./LogManager";
import { join } from "path";

type LogType = 'info' | 'error' | 'trace' | 'success' | 'debug' | 'delimiter';

export default class CloudSyncPlugin extends Plugin {
    settings: CloudSyncSettings;
    statusBar: HTMLElement | undefined;
    settingTab: CloudSyncSettingTab;
    logView: LogView | null = null;
    cloudSync: CloudSyncMain;

    private obfuscate(str: string): string {
        if (!str) return str;
        return Buffer.from(str).toString('base64');
    }

    private deobfuscate(str: string): string {
        if (!str) return str;
        try {
            return Buffer.from(str, 'base64').toString('utf-8');
        } catch {
            return str;
        }
    }

    async onload() {
        this.loadStyles();

        const existingLeaves = this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE);
        if (existingLeaves.length === 0) {
            this.registerView(
                LOG_VIEW_TYPE,
                (leaf: WorkspaceLeaf) => (this.logView = new LogView(leaf, this))
            );
        } else {
            const leaf = existingLeaves[0];
            if (leaf.view instanceof LogView) {
                this.logView = leaf.view;
                leaf.setViewState({
                    type: LOG_VIEW_TYPE,
                    active: true
                });
            }
        }

        await this.activateLogView();
        await this.loadSettings();

        LogManager.setLogFunction((message: string, type?: LogType, update?: boolean) => {
            this.baseLog(message, type, update);
        });

        const anyCloudEnabled = this.settings.azureEnabled ||
                              this.settings.awsEnabled ||
                              this.settings.gcpEnabled;

        this.statusBar = this.addStatusBarItem();

        let pluginDir = '.';
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            const basePath = (this.app.vault.adapter).getBasePath();
            const manifestDir = this.manifest.dir ?? '.';
            pluginDir = join(basePath, manifestDir);
        }

        this.cloudSync = new CloudSyncMain(
            this.app,
            this.settings,
            this.statusBar,
            pluginDir
        );

        LogManager.log(LogLevel.Debug, 'Plugin initialization', {
            pluginDir,
            enabledServices: {
                azure: this.settings.azureEnabled,
                aws: this.settings.awsEnabled,
                gcp: this.settings.gcpEnabled
            },
            logLevel: this.settings.logLevel
        });

        const ribbonIconEl = this.addRibbonIcon(
            'refresh-cw',
            'Cloud Sync',
            async () => {
                const anyCloudEnabled = this.settings.azureEnabled ||
                                      this.settings.awsEnabled ||
                                      this.settings.gcpEnabled;

                if (!anyCloudEnabled) {
                    LogManager.log(LogLevel.Info, 'No cloud services are enabled. Please enable at least one service in settings.');
                    (this.app as any).setting.open();
                    (this.app as any).setting.activeTab = this.settingTab;
                    return;
                }

                const svgIcon = ribbonIconEl.querySelector('.svg-icon');
                this.cloudSync.setSyncIcon(svgIcon);
                await this.cloudSync.runCloudSync();
            }
        );

        this.settingTab = new CloudSyncSettingTab(this.app, this);
        this.addSettingTab(this.settingTab);

        if (!anyCloudEnabled) {
            LogManager.log(LogLevel.Info, 'Please configure cloud services in settings');
            (this.app as any).setting.open();
            (this.app as any).setting.activeTab = this.settingTab;
        }
    }

    private loadStyles() {
        const link = document.createElement('link');
        link.id = 'cloud-sync-custom-styles';
        link.rel = 'stylesheet';
        link.href = this.manifest.dir ? `${this.manifest.dir}/styles.css` : 'styles.css';
        document.head.appendChild(link);
        LogManager.log(LogLevel.Debug, 'Custom styles loaded');
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = { ...DEFAULT_SETTINGS, ...data};

        if (this.settings.azure) {
            this.settings.azure.accessKey = this.deobfuscate(this.settings.azure.accessKey);
        }
        if (this.settings.aws) {
            this.settings.aws.accessKey = this.deobfuscate(this.settings.aws.accessKey);
            this.settings.aws.secretKey = this.deobfuscate(this.settings.aws.secretKey);
        }
        if (this.settings.gcp) {
            this.settings.gcp.privateKey = this.deobfuscate(this.settings.gcp.privateKey);
        }

        LogManager.log(LogLevel.Debug, 'Settings loaded');
    }

    async saveSettings() {
        const settingsToSave = JSON.parse(JSON.stringify(this.settings));

        if (settingsToSave.azure) {
            settingsToSave.azure.accessKey = this.obfuscate(settingsToSave.azure.accessKey);
        }
        if (settingsToSave.aws) {
            settingsToSave.aws.accessKey = this.obfuscate(settingsToSave.aws.accessKey);
            settingsToSave.aws.secretKey = this.obfuscate(settingsToSave.aws.secretKey);
        }
        if (settingsToSave.gcp) {
            settingsToSave.gcp.privateKey = this.obfuscate(settingsToSave.gcp.privateKey);
        }

        await this.saveData(settingsToSave);
        LogManager.log(LogLevel.Debug, 'Settings saved');
    }

    private async activateLogView() {
        if (this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE).length === 0) {
            const leaf = this.app.workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: LOG_VIEW_TYPE,
                    active: true,
                });
                LogManager.log(LogLevel.Debug, 'Log view activated');
            }
        }
        const leaves = this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE);
        if (leaves.length > 0) {
            this.logView = leaves[0].view as LogView;
        }
    }

    onunload() {
        LogManager.log(LogLevel.Trace, 'Unloading plugin...');
        const customStyles = document.getElementById('cloud-sync-custom-styles');
        if (customStyles) {
            customStyles.remove();
        }

        this.app.workspace.detachLeavesOfType(LOG_VIEW_TYPE);

        LogManager.log(LogLevel.Info, 'Plugin unloaded successfully');
    }

    private shouldLog(type: Exclude<LogType, 'delimiter'>): boolean {
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

    private baseLog(message: string, type: LogType = 'info', update = false): void {
        if (type === 'delimiter') {
            if (this.logView) {
                this.logView.addLogEntry('', type);
            }
            return;
        }

        if (this.settings.logLevel === LogLevel.None && type === 'error') {
            new Notice(`Cloud Sync Error: ${message}`, 10000);
            return;
        }

        if (!this.shouldLog(type)) {
            return;
        }

        const shouldUpdate = update && this.settings.logLevel === LogLevel.Info;

        if (this.logView) {
            this.logView.addLogEntry(message, type, shouldUpdate);
        }
    }
}
