import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	ItemView,
  } from 'obsidian';
  //import { BlobServiceClient } from "@azure/storage-blob";
  import * as fs from 'fs';
  import * as path from 'path';
  import { promisify } from 'util';
  import { LocalFileManager } from './LocalFileManager';
  import { AzureFileManager } from './AzureFileManager';
  import { Synchronize, SyncRule, File } from './Synchronize';
  import { S3FileManager } from './AwsFileManager';
  import { GCPFileManager } from './GcpFileManager';
  import { FileManager } from './AbstractFileManager';
  import {
	ListObjectsV2Command,
	ListObjectsV2CommandOutput,
	S3Client,
  } from '@aws-sdk/client-s3';

  export const readFileAsync = promisify(fs.readFile);
  export const writeFileAsync = promisify(fs.writeFile);
  export const unlinkAsync = promisify(fs.unlink);
  export const readdirAsync = promisify(fs.readdir);
  export const statAsync = promisify(fs.stat);

  interface CloudSyncSettings {
	cloudProvider: string;
	azureAccount: string;
	azureSasToken: string;
	azureContainer: string;
	awsAccessKey: string;
	awsSecretKey: string;
	awsRegion: string;
	awsBucket: string;
	gcpPrivateKey: string;
	gcpClientEmail: string;
	gcpBucket: string;
  }

  export default class CloudSyncPlugin extends Plugin {
	settings: CloudSyncSettings | undefined;
	statusBar: HTMLElement | undefined;
	svgIcon!: Element | null;
	cloudSync!: CloudSync;

	onInit() {}

	async onload() {
	  this.settings = await this.loadData();

	  // If there's nothing to load, set default values
	  if (!this.settings) {
		this.settings = {
		  cloudProvider: 'none',
		  azureAccount: '',
		  azureSasToken: '',
		  azureContainer: '',
		  awsAccessKey: '',
		  awsSecretKey: '',
		  awsRegion: '',
		  awsBucket: '',
		  gcpPrivateKey: '',
		  gcpClientEmail: '',
		  gcpBucket: '',
		};
	  }

	  this.statusBar = this.addStatusBarItem();
	  const buttonEl = this.addRibbonIcon(
		'refresh-cw',
		'Cloud Sync',
		async () => {
		  this.svgIcon = buttonEl.querySelector('.svg-icon');
		  this.runCloudSync();
		},
	  );

	  this.addSettingTab(new CloudSyncSettingTab(this.app, this));
	  this.cloudSync = new CloudSync(this.app, this.settings);
	}

	onunload() {
	  this.saveData(this.settings);
	}

	async saveSettings() {
	  await this.saveData(this.settings);
	}

	async runCloudSync() {
	  if (this.svgIcon) {
		this.svgIcon.classList.add('rotate-animation');
	  }
	  if (this.statusBar) {
		this.statusBar.setText('Syncing...');
	  }

	  //TODO cloudsync

	  //@ts-ignore
	  const localDir = this.app.vault.adapter.basePath;
	  const vaultName = encodeURIComponent(path.basename(localDir));
	  const localVault = new LocalFileManager(localDir);

	  let remoteVault: FileManager;

	  if (this.settings?.cloudProvider == 'aws') {
		remoteVault = new S3FileManager(
		  this.settings!.awsAccessKey,
		  this.settings!.awsSecretKey,
		  this.settings!.awsBucket,
		  this.settings!.awsRegion,
		);
	  } else if (this.settings?.cloudProvider == 'gcp') {
		remoteVault = new GCPFileManager(
		  this.settings.gcpPrivateKey,
		  this.settings.gcpClientEmail,
		  this.settings.gcpBucket,
		);
	  } else if (this.settings?.cloudProvider == 'azure') {
		remoteVault = new AzureFileManager(
		  this.settings.azureAccount,
		  this.settings.azureSasToken,
		  this.settings.azureContainer,
		);
	  } else {
		console.error(`Invalid target`);
		return;
	  }

	  const synchronizer = new Synchronize(localVault, remoteVault);
	  const actions = await synchronizer.syncActions();
	  synchronizer.runAllScenarios(actions);

	  console.log(`Files: ${actions.length}`);

	  actions
		.filter((action) => action.rule !== 'TO_CACHE')
		.forEach((action) => {
		  const fileName = action.local
			? action.local.name
			: action.remote
			  ? action.remote.name
			  : 'N/A';
		  console.log(`Rule: ${action.rule}, File: ${fileName}`);
		});

	  ///////////////////////////////////////////////////////////

	  if (this.statusBar) {
		this.statusBar.setText('Idle');
	  }
	  if (this.svgIcon) {
		this.svgIcon.classList.remove('rotate-animation');
	  }
	}
  }

  class CloudSyncSettingTab extends PluginSettingTab {
	plugin: CloudSyncPlugin;

	constructor(app: App, plugin: CloudSyncPlugin) {
	  super(app, plugin);
	  this.plugin = plugin;
	}

	display(): void {
	  const { containerEl } = this;
	  containerEl.empty();

	  const cloudChoice = new Setting(containerEl)
		.setName('Cloud Storage Provider')
		.setDesc('Choose your cloud provider')
		.addDropdown((dropdown) =>
		  dropdown
			.addOption('none', 'None')
			.addOption('azure', 'Azure')
			.addOption('aws', 'AWS')
			.addOption('gcp', 'GCP')
			.setValue(this.plugin.settings!.cloudProvider)
			.onChange((value) => {
			  azureSasToken.settingEl.style.display =
				value === 'azure' ? '' : 'none';
			  azureAccount.settingEl.style.display =
				value === 'azure' ? '' : 'none';
			  azureContainer.settingEl.style.display =
				value === 'azure' ? '' : 'none';
			  awsAccessKeySetting.settingEl.style.display =
				value === 'aws' ? '' : 'none';
			  awsSecretKeySetting.settingEl.style.display =
				value === 'aws' ? '' : 'none';
			  awsRegionSetting.settingEl.style.display =
				value === 'aws' ? '' : 'none';
			  awsBucketSetting.settingEl.style.display =
				value === 'aws' ? '' : 'none';
			  gcpPrivateKeySetting.settingEl.style.display =
				value === 'gcp' ? '' : 'none';
			  gcpClientEmailSetting.settingEl.style.display =
				value === 'gcp' ? '' : 'none';
			  gcpBucketSetting.settingEl.style.display =
				value === 'gcp' ? '' : 'none';
			  this.plugin.settings!.cloudProvider = value;
			}),
		);

	  const azureSasToken = new Setting(containerEl)
		.setName('SAS token')
		.setDesc('Shared access signature (SAS)')
		.addText((text) =>
		  text
			.setPlaceholder('Paste your Azure SAS token here')
			.setValue(this.plugin.settings!.azureSasToken)
			.onChange((value) => {
			  this.plugin.settings!.azureSasToken = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  azureSasToken.settingEl.style.display = 'none';

	  const azureAccount = new Setting(containerEl)
		.setName('Storage Account')
		.setDesc('Globally unique Azure storage account name')
		.addText((text) =>
		  text
			.setPlaceholder('Enter your Storage account name here')
			.setValue(this.plugin.settings!.azureAccount)
			.onChange((value) => {
			  this.plugin.settings!.azureAccount = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  azureAccount.settingEl.style.display = 'none';

	  const azureContainer = new Setting(containerEl)
		.setName('Storage Container')
		.setDesc('Azure storage container')
		.addText((text) =>
		  text
			.setPlaceholder('Enter your Azure storage container here')
			.setValue(this.plugin.settings!.azureContainer)
			.onChange((value) => {
			  this.plugin.settings!.azureContainer = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  azureContainer.settingEl.style.display = 'none';

	  const awsAccessKeySetting = new Setting(containerEl)
		.setName('Access Key')
		.setDesc('AWS Access key ID from Security credentials')
		.addText((text) =>
		  text
			.setPlaceholder('Access key ID')
			.setValue(this.plugin.settings!.awsAccessKey)
			.onChange((value) => {
			  this.plugin.settings!.awsAccessKey = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  awsAccessKeySetting.settingEl.style.display = 'none';

	  const awsSecretKeySetting = new Setting(containerEl)
		.setName('AWS Secret Key')
		.addText((text) =>
		  text
			.setPlaceholder('Enter your AWS secret key here')
			.setValue(this.plugin.settings!.awsSecretKey)
			.onChange((value) => {
			  this.plugin.settings!.awsSecretKey = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  awsSecretKeySetting.settingEl.style.display = 'none';

	  const awsRegionSetting = new Setting(containerEl)
		.setName('AWS Region')
		.addText((text) =>
		  text
			.setPlaceholder('Enter your AWS region here')
			.setValue(this.plugin.settings!.awsRegion)
			.onChange((value) => {
			  this.plugin.settings!.awsRegion = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  awsRegionSetting.settingEl.style.display = 'none';

	  const awsBucketSetting = new Setting(containerEl)
		.setName('S3 Bucket')
		.addText((text) =>
		  text
			.setPlaceholder('Enter your S3 bucket here')
			.setValue(this.plugin.settings!.awsBucket)
			.onChange((value) => {
			  this.plugin.settings!.awsBucket = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  awsBucketSetting.settingEl.style.display = 'none';

	  const gcpPrivateKeySetting = new Setting(containerEl)
		.setName('GCP Private Key')
		.addText((text) =>
		  text
			.setPlaceholder('GCP private_key from gcp.json secrets file')
			.setValue(this.plugin.settings!.gcpPrivateKey)
			.onChange((value) => {
			  this.plugin.settings!.gcpPrivateKey = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  gcpPrivateKeySetting.settingEl.style.display = 'none';

	  const gcpClientEmailSetting = new Setting(containerEl)
		.setName('GCP Client Email')
		.addText((text) =>
		  text
			.setPlaceholder('GCP client_email from gcp.json secrets file')
			.setValue(this.plugin.settings!.gcpClientEmail)
			.onChange((value) => {
			  this.plugin.settings!.gcpClientEmail = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  gcpClientEmailSetting.settingEl.style.display = 'none';

	  const gcpBucketSetting = new Setting(containerEl)
		.setName('GCP Bucket')
		.addText((text) =>
		  text
			.setPlaceholder('GCP bucket from gcp.json secrets file')
			.setValue(this.plugin.settings!.gcpBucket)
			.onChange((value) => {
			  this.plugin.settings!.gcpBucket = value;
			})
			.inputEl.addClass('wide-text-field'),
		);
	  gcpBucketSetting.settingEl.style.display = 'none';

	  const value = this.plugin.settings!.cloudProvider;
	  azureSasToken.settingEl.style.display = value === 'azure' ? '' : 'none';
	  azureAccount.settingEl.style.display = value === 'azure' ? '' : 'none';
	  azureContainer.settingEl.style.display = value === 'azure' ? '' : 'none';
	  awsAccessKeySetting.settingEl.style.display = value === 'aws' ? '' : 'none';
	  awsSecretKeySetting.settingEl.style.display = value === 'aws' ? '' : 'none';
	  awsRegionSetting.settingEl.style.display = value === 'aws' ? '' : 'none';
	  awsBucketSetting.settingEl.style.display = value === 'aws' ? '' : 'none';
	  gcpPrivateKeySetting.settingEl.style.display =
		value === 'gcp' ? '' : 'none';
	  gcpClientEmailSetting.settingEl.style.display =
		value === 'gcp' ? '' : 'none';
	  gcpBucketSetting.settingEl.style.display = value === 'gcp' ? '' : 'none';

	  new Setting(containerEl)
	  .addButton((button) =>
	  button.setButtonText('Test connection').onClick(async () => {}),)
	  .addButton((button) =>
	  button.setButtonText('Save').onClick(async () => {
		  await this.plugin.saveSettings();
	  }),)
	  .addButton((button) =>
	  button.setButtonText('Clear').onClick(async () => {
		  //@ts-ignore
		const filePath = path.join(this.app.vault.adapter.basePath, '.cloudsync.json');
		fs.unlink(filePath, (err) => {
		  if (err) {
			console.error('Failed to delete .cloudsync.json:', err);
		  } else {
			console.log('.cloudsync.json deleted successfully');
		  }
		});
	  }),
	);
	}
  }

  class CloudSync {
	private settings: CloudSyncSettings;
	private app: any;
	//private blobServiceClient: BlobServiceClient | undefined;

	constructor(app: any, settings: CloudSyncSettings) {
	  this.app = app;
	  this.settings = settings;
	}

	/*
	  async authenticate(): Promise<void> {
		  //console.log(`${this.settings!.azureConnectionString}`)
		  switch (this.settings.cloudProvider) {
			  case 'azure':
				  try {
					  // Initialize blobServiceClient here
					  this.blobServiceClient = BlobServiceClient.fromConnectionString(this.settings.azureConnectionString);
					  console.log('authentication ok')
					  const containerClient = this.blobServiceClient.getContainerClient('obsidian');
					  console.log('container ok')

					  // List all blobs in the container
					  let i = 1;
					  for await (const response of containerClient.listBlobsFlat().byPage({ maxPageSize: 20 })) {
						  for (const blob of response.segment.blobItems) {
							  console.log(`Blob ${i++}: ${blob.name}`);
						  }
					  }

				  } catch (error) {
					  console.error('Azure authentication failed:', error);
				  }

			  // Azure authentication code goes here
			  break;
			  case 'aws':
			  // AWS authentication code goes here
			  break;
			  case 'gcp':
			  // GCP authentication code goes here
			  break;
			  default:
			  throw new Error(`Unsupported cloud provider: ${this.settings.cloudProvider}`);
		  }
	  }
	  */
  }
