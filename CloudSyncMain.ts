import * as fs from "fs";
import * as path from "path";
import { LocalFileManager } from "./LocalFileManager";
import { AzureFileManager } from "./AzureFileManager";
import { Synchronize, SyncRule, File } from "./Synchronize";
import { S3FileManager } from "./AwsFileManager";
import { GCPFileManager } from "./GcpFileManager";
import { FileManager } from "./AbstractFileManager";
import { promisify } from "util";
import { CloudSyncSettings } from "./main";

export const readFileAsync = promisify(fs.readFile);
export const writeFileAsync = promisify(fs.writeFile);
export const unlinkAsync = promisify(fs.unlink);
export const readdirAsync = promisify(fs.readdir);
export const statAsync = promisify(fs.stat);

export class CloudSync {
  public localVault: LocalFileManager;
  public remoteVault: FileManager;
  public synchronizer: Synchronize;

  private settings: CloudSyncSettings;
  private app: any;

  constructor(app: any, settings: any) {
    this.app = app;
    this.settings = settings

    //console.log(this.app.vault.adapter.basePath)

    //@ ts - ignore
    const localDir = this.app.vault.adapter.basePath;
    const vaultName = encodeURIComponent(path.basename(localDir));

    this.localVault = new LocalFileManager(localDir, this.settings.syncIgnore);

    if (this.settings?.cloudProvider == "aws") {
      this.remoteVault = new S3FileManager(
        this.settings!.awsAccessKey,
        this.settings!.awsSecretKey,
        this.settings!.awsBucket,
        this.settings!.awsRegion
      );
    } else if (this.settings?.cloudProvider == "gcp") {
      this.remoteVault = new GCPFileManager(
        this.settings.gcpPrivateKey,
        this.settings.gcpClientEmail,
        this.settings.gcpBucket
      );
    } else if (this.settings?.cloudProvider == "azure") {
      this.remoteVault = new AzureFileManager(
        this.settings.azureAccount,
        this.settings.azureAccessKey,
        vaultName
      );
    } else {
      console.error(`Invalid target`);
      return;
    }

    this.synchronizer = new Synchronize(this.localVault, this.remoteVault);
  }
}
