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
    private pendingLogs: Array<{message: string, type: LogType, update: boolean}> = [];

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
        // Register view first
        this.registerView(
            LOG_VIEW_TYPE,
            (leaf: WorkspaceLeaf) => {
                const view = new LogView(leaf, this);
                this.logView = view;
                // Process any pending logs
                this.processPendingLogs();
                return view;
            }
        );

        // Set up logging before anything else
        LogManager.setLogFunction((message: string, type?: LogType, update?: boolean, important?: boolean) => {
            this.baseLog(message, type, update, important);
        });

        await this.loadSettings();

        // Initialize existing log view if it exists and should be visible
        if (this.settings.logLevel !== LogLevel.None) {
            const existingLeaves = this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE);
            if (existingLeaves.length > 0) {
                const leaf = existingLeaves[0];
                if (leaf.view instanceof LogView) {
                    this.logView = leaf.view;
                    this.processPendingLogs();
                }
            }

            // Delay log view activation until workspace is ready
            setTimeout(() => this.activateLogView(), 500);
        }

        // Register workspace change event to keep logView reference updated
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.updateLogViewReference();
            })
        );

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

                // Ensure log view is active before syncing if logging is enabled
                if (this.settings.logLevel !== LogLevel.None) {
                    await this.ensureLogViewExists();
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
        } else {
            const svgIcon = ribbonIconEl.querySelector('.svg-icon');
            this.cloudSync.setSyncIcon(svgIcon);
            await this.cloudSync.runCloudSync();
        }
    }

    private updateLogViewReference() {
        const leaves = this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE);
        if (leaves.length > 0) {
            const view = leaves[0].view;
            if (view instanceof LogView) {
                this.logView = view;
                this.processPendingLogs();
            }
        } else {
            this.logView = null;
        }
    }

    private async ensureLogViewExists() {
        if (!this.logView && this.settings.logLevel !== LogLevel.None) {
            await this.activateLogView();
            // Wait a bit for the view to be properly initialized
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private processPendingLogs() {
        if (this.logView && this.pendingLogs.length > 0) {
            for (const log of this.pendingLogs) {
                try {
                    this.logView.addLogEntry(log.message, log.type, log.update);
                } catch (error) {
                    console.debug('Failed to process pending log:', error);
                }
            }
            this.pendingLogs = [];
        }
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

    async handleLogLevelChange(newLevel: LogLevel) {
        if (newLevel === LogLevel.None) {
            // Detach log view when logging is disabled
            this.app.workspace.detachLeavesOfType(LOG_VIEW_TYPE);
            this.logView = null;
        } else if (this.settings.logLevel === LogLevel.None) {
            // If coming from None to any other level, activate log view
            await this.activateLogView();
        }
        this.settings.logLevel = newLevel;
    }

    private async activateLogView() {
        try {
            if (this.settings.logLevel === LogLevel.None) {
                return; // Don't activate if logging is disabled
            }

            if (this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE).length === 0) {
                // Check if there's an active leaf first
                const activeLeaf = this.app.workspace.activeLeaf;
                if (!activeLeaf) {
                    // If no active leaf, wait for workspace to be ready
                    return;
                }

                // Create a new leaf in the right sidebar and make it active
                const leaf = await this.app.workspace.getRightLeaf(false);
                if (leaf) {
                    await leaf.setViewState({
                        type: LOG_VIEW_TYPE,
                        active: true, // Make the view active when created
                    });
                    // Ensure the leaf is revealed in the sidebar
                    this.app.workspace.revealLeaf(leaf);
                }
            } else {
                // If view already exists, bring it to front
                const leaves = this.app.workspace.getLeavesOfType(LOG_VIEW_TYPE);
                if (leaves.length > 0) {
                    this.app.workspace.revealLeaf(leaves[0]);
                }
            }

            this.updateLogViewReference();
        } catch (error) {
            console.debug('Cloud Sync: Log view activation deferred:', error);
        }
    }

    onunload() {
        LogManager.log(LogLevel.Trace, 'Unloading plugin...');
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

    private baseLog(message: string, type: LogType = 'info', update = false, important = false): void {
        if (type === 'delimiter') {
            if (this.logView?.addLogEntry) {
                try {
                    this.logView.addLogEntry('', type);
                } catch (error) {
                    console.debug('Failed to add delimiter log entry:', error);
                    this.pendingLogs.push({message: '', type, update});
                }
            } else {
                this.pendingLogs.push({message: '', type, update});
            }
            return;
        }

        // Show errors and important info messages as Notices when logLevel is None
        if (this.settings.logLevel === LogLevel.None && (type === 'error' || (type === 'info' && important))) {
            const prefix = type === 'error' ? 'Cloud Sync Error: ' : 'Cloud Sync: ';
            const timeout = type === 'error' ? 10000 : 5000;
            const notice = new Notice(`${prefix}${message}`, timeout);
            // Add CSS class for styling
            notice.noticeEl.addClass(type === 'error' ? 'cloud-sync-error-notice' : 'cloud-sync-info-notice');
            return;
        }

        if (!this.shouldLog(type)) {
            return;
        }

        const shouldUpdate = update && this.settings.logLevel === LogLevel.Info;

        if (this.logView?.addLogEntry) {
            try {
                this.logView.addLogEntry(message, type, shouldUpdate);
            } catch (error) {
                console.debug('Failed to add log entry:', error);
                this.pendingLogs.push({message, type, update: shouldUpdate});
            }
        } else {
            this.pendingLogs.push({message, type, update: shouldUpdate});
        }
    }
}
