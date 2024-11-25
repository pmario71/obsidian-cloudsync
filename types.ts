export interface CloudProviderSettings {
    [key: string]: string;
}

export interface CloudSyncSettings {
    azureEnabled: boolean;
    awsEnabled: boolean;
    gcpEnabled: boolean;
    debugEnabled: boolean;
    azure: CloudProviderSettings;
    aws: CloudProviderSettings;
    gcp: CloudProviderSettings;
    syncIgnore: string;
}

export const DEFAULT_SETTINGS: CloudSyncSettings = {
    azureEnabled: false,
    awsEnabled: false,
    gcpEnabled: false,
    debugEnabled: false,
    azure: {
        account: "",
        accessKey: "",
    },
    aws: {
        accessKey: "",
        secretKey: "",
        region: "",
        bucket: "",
    },
    gcp: {
        privateKey: "",
        clientEmail: "",
        bucket: "",
    },
    syncIgnore: ""
};
