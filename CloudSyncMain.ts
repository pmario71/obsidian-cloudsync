import { CloudSyncSettings, LogLevel } from "./types";
import { LocalManager } from "./localManager";
import { AbstractManager } from "./AbstractManager";
import { LogManager } from "./LogManager";
import { AzureManager } from "./AzureManager";
import { AWSManager } from "./AWSManager";
import { GCPManager } from "./GCPManager";
import { Synchronize } from "./Synchronize";
import { join } from "path";

export class CloudSyncMain {
    public localVault: LocalManager | null = null;
    public remoteVaults: AbstractManager[] = [];
    private app: any;
    private settings: CloudSyncSettings;
    private statusBar: HTMLElement;
    private syncIcon: Element | null = null;
    private pluginDir: string;

    constructor(
        app: any,
        settings: CloudSyncSettings,
        statusBar: HTMLElement,
        pluginDir: string
    ) {
        this.app = app;
        this.settings = settings;
        this.statusBar = statusBar;
        this.pluginDir = pluginDir;
    }

    private log(level: LogLevel, message: string) {
        LogManager.log(level, message);
    }

    setSyncIcon(icon: Element | null) {
        this.syncIcon = icon;
        if (this.syncIcon) {
            this.syncIcon.classList.add('cloud-sync-spin');
        }
    }

    async runCloudSync(): Promise<void> {
        this.log(LogLevel.Trace, 'CloudSync started');

        try {
            this.localVault = await Promise.resolve(new LocalManager(this.settings, this.app));

            const localConnectivity = await this.localVault.testConnectivity();
            if (!localConnectivity.success) {
                throw new Error(`Local vault access failed: ${localConnectivity.message}`);
            }

            if (this.settings.azureEnabled) {
                const azureVault = new AzureManager(this.settings, this.localVault.getVaultName());
                await azureVault.authenticate();
                const sync = new Synchronize(this.localVault, azureVault, join(this.pluginDir, `cloudsync-${azureVault.getProviderName()}.json`));
                const scenarios = await sync.syncActions();
                await sync.runAllScenarios(scenarios);
            }

            if (this.settings.awsEnabled) {
                const awsVault = new AWSManager(this.settings);
                await awsVault.authenticate();
                const sync = new Synchronize(this.localVault, awsVault, join(this.pluginDir, `cloudsync-${awsVault.getProviderName()}.json`));
                const scenarios = await sync.syncActions();
                //await sync.runAllScenarios(scenarios);

            }

            if (this.settings.gcpEnabled) {
                const gcpVault = new GCPManager(this.settings, this.localVault.getVaultName());
                await gcpVault.authenticate();
                const sync = new Synchronize(this.localVault, gcpVault, join(this.pluginDir, `cloudsync-${gcpVault.getProviderName()}.json`));
                const scenarios = await sync.syncActions();
                await sync.runAllScenarios(scenarios);
            }

            this.log(LogLevel.Trace, 'CloudSync completed');
        } catch (error) {
            this.log(LogLevel.Error, `CloudSync failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        } finally {
            if (this.syncIcon) {
                this.syncIcon.classList.remove('cloud-sync-spin');
            }
        }
    }
}
