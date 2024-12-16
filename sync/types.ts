export interface CloudProviderSettings {
    [key: string]: string;
}

export enum LogLevel {
    None = "None",
    Error = "Error",
    Info = "Info",
    Trace = "Trace",
    Debug = "Debug"
}

export interface CloudSyncSettings {
    azureEnabled: boolean;
    awsEnabled: boolean;
    gcpEnabled: boolean;
    logLevel: LogLevel;
    azure: CloudProviderSettings;
    aws: CloudProviderSettings;
    gcp: CloudProviderSettings;
    syncIgnore: string;
    autoSyncDelay: number;
    saveSettings?: () => Promise<void>;
}

export const DEFAULT_SETTINGS: CloudSyncSettings = {
    azureEnabled: false,
    awsEnabled: false,
    gcpEnabled: false,
    logLevel: LogLevel.Info,
    azure: {
        account: "",
        accessKey: "",
    },
    aws: {
        accessKey: "",
        secretKey: "",
        bucket: "",
        region: "us-east-1",
    },
    gcp: {
        privateKey: "",
        clientEmail: "",
        bucket: "",
    },
    syncIgnore: "",
    autoSyncDelay: 0
}
