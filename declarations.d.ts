declare module "*.js" {
    const content: any;
    export = content;
}

// Declare provider modules
declare module "./aws-provider.js" {
    export { AWSManager } from "./AWSManager";
}

declare module "./azure-provider.js" {
    export { AzureManager } from "./AzureManager";
}

declare module "./gcp-provider.js" {
    export { GCPManager } from "./GCPManager";
}
