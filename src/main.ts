import { Plugin, Notice, WorkspaceLeaf, TAbstractFile } from "obsidian";
import { CloudSyncSettings, DEFAULT_SETTINGS, LogLevel } from "./sync/types";
import { CloudSyncSettingTab } from "./sync/settings";
import { LogView, LOG_VIEW_TYPE } from "./LogView";
import { CloudSyncMain } from "./sync/CloudSyncMain";
import { LogManager, showNotice } from "./LogManager";
import { Container, cleanupContainer, registerCleanup } from "./sync/utils/container";
import { ResourceManager } from "./sync/utils/timeoutUtils";

type LogType = 'info' | 'error' | 'trace' | 'success' | 'debug' | 'delimiter';

@registerCleanup
export default class CloudSyncPlugin extends Plugin {
    settings: CloudSyncSettings;
    statusBar: HTMLElement | undefined;
    cloudSync: CloudSyncMain;
    private pendingLogs: Array<{message: string, type: LogType, update: boolean}> = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private ribbonIconEl: HTMLElement | null = null;
    private readonly encoder = new TextEncoder();
    private readonly decoder = new TextDecoder();
    private container: Container;

    private static obfuscate(str: string): string {
        if (!str) return str;
        return btoa(str);
    }

    private static deobfuscate(str: string): string {
        if (!str) return str;
        try {
            return atob(str);
        } catch {
            return str;
        }
    }

    private async executeSync(): Promise<void> {
        const anyCloudEnabled = this.settings.azureEnabled ||
                              this.settings.awsEnabled ||
                              this.settings.gcpEnabled;

        if (!anyCloudEnabled) {
            LogManager.log(LogLevel.Info, 'No cloud services are enabled. Please enable at least one service in settings.');
            showNotice('CloudSync: Please enable at least one cloud service in settings');
            return;
        }

        if (this.settings.logLevel !== LogLevel.None) {
            await this.ensureLogViewExists();
        }

        const svgIcon = this.ribbonIconEl?.querySelector('.svg-icon');
        if (svgIcon) {
            this.cloudSync.setSyncIcon(svgIcon);
        }
        await this.cloudSync.runCloudSync();
    }

    private readonly handleVaultChange = (file: TAbstractFile) => {
        if (this.timer) {
            ResourceManager.clearTimer(this.timer);
            this.timer = null;
        }

        if (this.settings.autoSyncDelay > 0) {
            LogManager.log(LogLevel.Trace, `Starting auto-sync countdown for ${this.settings.autoSyncDelay} seconds`);
            LogManager.log(LogLevel.Debug, `File ${file.path} was changed`);

            this.timer = setTimeout(() => {
                LogManager.log(LogLevel.Trace, `Auto-sync timer triggered after ${this.settings.autoSyncDelay} seconds of inactivity`);
                this.executeSync().catch(error => {
                    LogManager.log(LogLevel.Error, `Auto-sync failed: ${error.message}`);
                });
            }, this.settings.autoSyncDelay * 1000);

            ResourceManager.registerTimer(this.timer);
        } else {
            LogManager.log(LogLevel.Trace, 'Auto-sync is disabled (delay set to 0)');
        }
    };

    async onload(): Promise<void> {
        this.container = Container.getInstance(this.app);

        this.registerView(
            LOG_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => {
                const view = new LogView(leaf, this);
                this.processPendingLogs();
                return view;
            }
        );

        LogManager.setLogFunction((message: string, type?: LogType, update?: boolean, important?: boolean) => {
            this.baseLog(message, type, update, important);
        });

        await this.loadSettings();

        LogManager.log(LogLevel.Debug, 'Initial settings loaded:', {
            azureEnabled: this.settings.azureEnabled,
            awsEnabled: this.settings.awsEnabled,
            gcpEnabled: this.settings.gcpEnabled
        });

        this.registerEvent(this.app.vault.on('create', this.handleVaultChange));
        this.registerEvent(this.app.vault.on('modify', this.handleVaultChange));
        this.registerEvent(this.app.vault.on('delete', this.handleVaultChange));
        this.registerEvent(this.app.vault.on('rename', this.handleVaultChange));
        this.registerEvent(this.app.workspace.on('layout-change', () => {
            this.processPendingLogs();
        }));

        this.statusBar = this.addStatusBarItem();
        this.ribbonIconEl = this.addRibbonIcon('refresh-cw', 'CloudSync', () => {
            this.executeSync().catch(error => {
                LogManager.log(LogLevel.Error, `Manual sync failed: ${error.message}`);
            });
        });

        if (this.settings.logLevel !== LogLevel.None) {
            setTimeout(() => this.activateLogView(), 500);
        }

        this.cloudSync = new CloudSyncMain(
            this.app,
            this.settings,
            this.statusBar
        );

        this.addSettingTab(new CloudSyncSettingTab(this.app, this));

        const anyCloudEnabled = this.settings.azureEnabled ||
                              this.settings.awsEnabled ||
                              this.settings.gcpEnabled;

        if (!anyCloudEnabled) {
            LogManager.log(LogLevel.Info, 'Please configure cloud services in settings');
            showNotice('CloudSync: Please configure cloud services in settings');
        } else {
            const initialSyncTimer = setTimeout(() => {
                this.executeSync().catch(error => {
                    LogManager.log(LogLevel.Error, `Initial sync failed: ${error.message}`);
                });
            }, 1000);
            ResourceManager.registerTimer(initialSyncTimer);
        }

        LogManager.log(LogLevel.Debug, 'Plugin initialization complete', {
            enabledServices: {
                azure: this.settings.azureEnabled,
                aws: this.settings.awsEnabled,
                gcp: this.settings.gcpEnabled
            },
            logLevel: this.settings.logLevel,
            autoSyncDelay: this.settings.autoSyncDelay
        });
    }

    private getLogView(): LogView | null {
        const leaves = this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE);
        if (leaves.length > 0) {
            const view = leaves[0].view;
            if (view instanceof LogView) {
                return view;
            }
        }
        return null;
    }

    private async ensureLogViewExists(): Promise<void> {
        if (this.settings.logLevel !== LogLevel.None && !this.getLogView()) {
            await this.activateLogView();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private processPendingLogs(): void {
        if (this.pendingLogs.length === 0) return;

        const logView = this.getLogView();
        if (!logView) return;

        for (const log of this.pendingLogs) {
            try {
                logView.addLogEntry(log.message, log.type, log.update);
            } catch (error) {
                LogManager.log(LogLevel.Debug, 'Failed to process pending log:', error);
            }
        }
        this.pendingLogs = [];
    }

    async loadSettings(): Promise<void> {
        const data = await this.loadData();
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...data,
            app: this.app
        };

        if (this.settings.azure) {
            this.settings.azure.accessKey = CloudSyncPlugin.deobfuscate(this.settings.azure.accessKey);
        }
        if (this.settings.aws) {
            this.settings.aws.accessKey = CloudSyncPlugin.deobfuscate(this.settings.aws.accessKey);
            this.settings.aws.secretKey = CloudSyncPlugin.deobfuscate(this.settings.aws.secretKey);
        }
        if (this.settings.gcp) {
            this.settings.gcp.privateKey = CloudSyncPlugin.deobfuscate(this.settings.gcp.privateKey);
        }

        LogManager.log(LogLevel.Debug, 'Settings loaded');
    }

    async saveSettings(): Promise<void> {
        const { app: _, ...settingsWithoutApp } = this.settings;
        const settingsToSave = JSON.parse(JSON.stringify(settingsWithoutApp));

        if (settingsToSave.azure) {
            settingsToSave.azure.accessKey = CloudSyncPlugin.obfuscate(settingsToSave.azure.accessKey);
        }
        if (settingsToSave.aws) {
            settingsToSave.aws.accessKey = CloudSyncPlugin.obfuscate(settingsToSave.aws.accessKey);
            settingsToSave.aws.secretKey = CloudSyncPlugin.obfuscate(settingsToSave.aws.secretKey);
        }
        if (settingsToSave.gcp) {
            settingsToSave.gcp.privateKey = CloudSyncPlugin.obfuscate(settingsToSave.gcp.privateKey);
        }

        await this.saveData(settingsToSave);

        if (this.cloudSync) {
            this.cloudSync.updateSettings(this.settings);
        }

        LogManager.log(LogLevel.Debug, 'Settings saved and propagated');
    }

    handleLogLevelChange(newLevel: LogLevel): void {
        if (newLevel === LogLevel.None) {
            this.app.workspace.detachLeavesOfType(LOG_VIEW_TYPE);
        } else if (this.settings.logLevel === LogLevel.None) {
            this.activateLogView().catch(error => {
                LogManager.log(LogLevel.Debug, 'Failed to activate log view:', error);
            });
        }
        this.settings.logLevel = newLevel;
    }

    private async activateLogView(): Promise<void> {
        try {
            if (this.settings.logLevel === LogLevel.None) {
                return Promise.resolve();
            }

            if (this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE).length === 0) {
                const leaf = await this.app.workspace.getRightLeaf(false);
                if (leaf) {
                    await leaf.setViewState({
                        type: LOG_VIEW_TYPE,
                        active: true,
                    });
                    this.app.workspace.revealLeaf(leaf);
                }
            } else {
                const leaves = this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE);
                if (leaves.length > 0) {
                    this.app.workspace.revealLeaf(leaves[0]);
                }
            }
            return Promise.resolve();
        } catch (error) {
            LogManager.log(LogLevel.Debug, 'CloudSync: Log view activation deferred:', error);
            return Promise.resolve();
        }
    }

    async onunload(): Promise<void> {
        LogManager.log(LogLevel.Trace, 'Unloading plugin...');
        try {
            await cleanupContainer(this.app);
            LogManager.log(LogLevel.Info, 'Plugin unloaded successfully');
        } catch (error) {
            LogManager.log(LogLevel.Error, 'Error during plugin cleanup', error);
            showNotice('Error during plugin cleanup. Some resources may not have been properly released.');
        }
    }

    cleanup(): Promise<void> {
        if (this.timer) {
            ResourceManager.clearTimer(this.timer);
            this.timer = null;
        }
        return Promise.resolve();
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

    private baseLog(message: string, type: LogType = 'info', update = false, important = false): void {
        if (type === 'delimiter') {
            this.handleDelimiterLog(update);
            return;
        }

        if (this.shouldShowNotice(type, important)) {
            this.showNotice(message, type);
            return;
        }

        if (!this.shouldLog(type)) {
            return;
        }

        const shouldUpdate = update && this.settings.logLevel === LogLevel.Info;
        this.addLogEntry(message, type, shouldUpdate);
    }

    private handleDelimiterLog(update: boolean): void {
        const logView = this.getLogView();
        if (logView?.addLogEntry) {
            try {
                logView.addLogEntry('', 'delimiter');
            } catch (error) {
                LogManager.log(LogLevel.Debug, 'Failed to add delimiter log entry:', error);
                this.pendingLogs.push({message: '', type: 'delimiter', update});
            }
        } else {
            this.pendingLogs.push({message: '', type: 'delimiter', update});
        }
    }

    private shouldShowNotice(type: LogType, important: boolean): boolean {
        return this.settings.logLevel === LogLevel.None && (type === 'error' || (type === 'info' && important));
    }

    private showNotice(message: string, type: LogType): void {
        const prefix = type === 'error' ? 'CloudSync Error: ' : 'CloudSync: ';
        const timeout = type === 'error' ? 10000 : 2000;
        const notice = new Notice(`${prefix}${message}`, timeout);
        notice.messageEl.addClass(type === 'error' ? 'cloud-sync-error-notice' : 'cloud-sync-info-notice');
    }

    private addLogEntry(message: string, type: LogType, shouldUpdate: boolean): void {
        const logView = this.getLogView();
        if (logView?.addLogEntry) {
            try {
                logView.addLogEntry(message, type, shouldUpdate);
            } catch (error) {
                LogManager.log(LogLevel.Debug, 'Failed to add log entry:', error);
                this.pendingLogs.push({message, type, update: shouldUpdate});
            }
        } else {
            this.pendingLogs.push({message, type, update: shouldUpdate});
        }
    }
}
