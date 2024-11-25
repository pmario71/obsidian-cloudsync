import { CloudSyncSettings, LogLevel } from "./types";
import { LocalManager } from "./localManager";
import { AbstractManager } from "./AbstractManager";
import { LogManager } from "./LogManager";
import { AzureManager } from "./AzureManager";
import { AWSManager } from "./AWSManager";
import { GCPManager } from "./GCPManager";

export class CloudSyncMain {
    public localVault: LocalManager | null = null;
    public remoteVaults: AbstractManager[] = [];
    private app: any;
    private settings: CloudSyncSettings;
    private statusBar: HTMLElement;
    private syncIcon: Element | null = null;

    constructor(
        app: any,
        settings: CloudSyncSettings,
        statusBar: HTMLElement
    ) {
        this.app = app;
        this.settings = settings;
        this.statusBar = statusBar;
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
                throw new Error(`Local vault connectivity failed: ${localConnectivity.message}`);
            }

            // Get and log the list of files
            const files = await this.localVault.getFiles();
            this.log(LogLevel.Info, `Number of files in Local vault: ${files.length}`);

            // Initialize remote vaults based on enabled settings
            this.remoteVaults = [];

            if (this.settings.azureEnabled) {
                const azureVault = new AzureManager(this.settings);
                await azureVault.authenticate();
                const azureFiles = await azureVault.getFiles();
                this.log(LogLevel.Info, `Number of files in Azure vault: ${azureFiles.length}`);
                this.remoteVaults.push(azureVault);
            }

            if (this.settings.awsEnabled) {
                const awsVault = new AWSManager(this.settings);
                await awsVault.authenticate();
                const awsFiles = await awsVault.getFiles();
                this.log(LogLevel.Info, `Number of files in AWS vault: ${awsFiles.length}`);
                this.remoteVaults.push(awsVault);
            }

            if (this.settings.gcpEnabled) {
                const gcpVault = new GCPManager(this.settings);
                await gcpVault.authenticate();
                const gcpFiles = await gcpVault.getFiles();
                this.log(LogLevel.Info, `Number of files in GCP vault: ${gcpFiles.length}`);
                this.remoteVaults.push(gcpVault);
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
