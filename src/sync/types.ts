export interface AzureSettings {
    account: string;
    accessKey: string;
}

export interface AWSSettings {
    accessKey: string;
    secretKey: string;
    bucket: string;
    endpoint: string;
    virtualHostUrl: string;
}

export interface GCPSettings {
    privateKey: string;
    clientEmail: string;
    bucket: string;
}

export interface CloudProviderSettings extends Partial<AzureSettings & AWSSettings & GCPSettings> {
    [key: string]: string | undefined;
}

export enum LogLevel {
    None = "None",
    Error = "Error",
    Info = "Info",
    Trace = "Trace",
    Debug = "Debug"
}

import { App } from "obsidian";

export interface CloudSyncSettings {
    azureEnabled: boolean;
    awsEnabled: boolean;
    gcpEnabled: boolean;
    logLevel: LogLevel;
    azure: AzureSettings;
    aws: AWSSettings;
    gcp: GCPSettings;
    syncIgnore: string;
    autoSyncDelay: number;
    cloudVault: string;
    saveSettings?: () => Promise<void>;
    app?: App;
}

export const DEFAULT_SETTINGS: CloudSyncSettings = {
    azureEnabled: false,
    awsEnabled: false,
    gcpEnabled: false,
    logLevel: LogLevel.Info,
    azure: {
        account: "",
        accessKey: "",
    } as AzureSettings,
    aws: {
        accessKey: "",
        secretKey: "",
        bucket: "",
        endpoint: "",
        virtualHostUrl: ""
    } as AWSSettings,
    gcp: {
        privateKey: "",
        clientEmail: "",
        bucket: "",
    } as GCPSettings,
    syncIgnore: ".obsidian",
    autoSyncDelay: 0,
    cloudVault: "",
}
