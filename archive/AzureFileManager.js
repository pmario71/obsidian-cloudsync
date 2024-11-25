import { __awaiter } from "tslib";
import { FileManager } from "./AbstractFileManager";
import { promisify } from "util";
import * as fs from "fs";
import * as xml2js from "xml2js";
import { generateAccountSASQueryParameters, AccountSASPermissions, AccountSASServices, AccountSASResourceTypes, StorageSharedKeyCredential } from "@azure/storage-blob";
export const readFileAsync = promisify(fs.readFile);
export const writeFileAsync = promisify(fs.writeFile);
export const unlinkAsync = promisify(fs.unlink);
export const readdirAsync = promisify(fs.readdir);
export const statAsync = promisify(fs.stat);
export class AzureFileManager extends FileManager {
    constructor(accountName, accountKey, containerName) {
        super();
        this.accountName = accountName;
        this.containerName = containerName;
        this.accountKey = accountKey;
        this.authPromise = this.authenticate();
    }
    isOnline() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () { }));
        });
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            //const sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
            //const blobServiceClient = new BlobServiceClient(`https://${this.accountName}.blob.core.windows.net`,sharedKeyCredential);
            //const containerClient = blobServiceClient.getContainerClient(this.containerName);
            const permissions = new AccountSASPermissions();
            permissions.read = true;
            permissions.write = true;
            permissions.delete = true;
            permissions.list = true;
            const services = new AccountSASServices();
            services.blob = true;
            const resourceTypes = new AccountSASResourceTypes();
            resourceTypes.container = true;
            resourceTypes.object = true;
            const startDate = new Date();
            const expiryDate = new Date(startDate);
            expiryDate.setHours(startDate.getHours() + 1);
            const sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
            this.sasToken = generateAccountSASQueryParameters({
                permissions: permissions,
                services: services.toString(),
                resourceTypes: resourceTypes.toString(),
                startsOn: startDate,
                expiresOn: expiryDate,
            }, sharedKeyCredential).toString();
            try {
                const response = yield fetch(`https://${this.accountName}.blob.core.windows.net/${this.containerName}?restype=container&comp=list&${this.sasToken}`);
                if (response.status != 200) {
                    const createResponse = yield fetch(`https://${this.accountName}.blob.core.windows.net/${this.containerName}?restype=container&${this.sasToken}`, {
                        method: 'PUT'
                    });
                    if (createResponse.status === 201) {
                        console.log(`Container ${this.containerName} created.`);
                    }
                    else {
                        console.log(`Failed to create container ${this.containerName}. Status: ${createResponse.status}`);
                    }
                }
            }
            catch (error) {
                console.error(`Error accessing Azure Blob Storage: ${error}`);
            }
        });
    }
    path(file) {
        return encodeURIComponent(file.name);
    }
    readFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${decodeURIComponent(file.remoteName)}?${this.sasToken}`;
            const response = yield fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = yield response.arrayBuffer();
            return Buffer.from(data);
        });
    }
    writeFile(file, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${file.remoteName}?${this.sasToken}`;
            const response = yield fetch(url, {
                method: "PUT",
                body: content,
                headers: {
                    "Content-Type": "application/octet-stream",
                    "x-ms-blob-type": "BlockBlob",
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        });
    }
    deleteFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${file.remoteName}?${this.sasToken}`;
            const response = yield fetch(url, {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        });
    }
    getFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            let files = [];
            const url = `https://${this.accountName}.blob.core.windows.net/${this.containerName}?restype=container&comp=list&${this.sasToken}`;
            try {
                const response = yield fetch(url); //{mode: 'no-cors'}
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = yield response.text();
                const result = yield xml2js.parseStringPromise(data);
                const blobs = result.EnumerationResults.Blobs[0].Blob;
                if (blobs) {
                    files = blobs.map((blob) => {
                        const properties = blob.Properties[0];
                        const md5Hash = properties["Content-MD5"][0]
                            ? Buffer.from(properties["Content-MD5"][0], "base64").toString("hex")
                            : "";
                        return {
                            name: decodeURIComponent(blob.Name[0]),
                            localName: "",
                            remoteName: blob.Name[0],
                            mime: properties["Content-Type"][0] || "",
                            lastModified: properties["Last-Modified"][0]
                                ? new Date(properties["Last-Modified"][0])
                                : new Date(),
                            size: properties["Content-Length"][0]
                                ? Number(properties["Content-Length"][0])
                                : 0,
                            md5: md5Hash,
                            isDirectory: false,
                        };
                    });
                }
            }
            catch (error) {
                console.error("Error accessing Azure Blob Storage:", error);
            }
            return files;
        });
    }
}
function blobToArrayBuffer(blob) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Response(blob).arrayBuffer();
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXp1cmVGaWxlTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkF6dXJlRmlsZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNBLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ2pDLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQ2pDLE9BQU8sRUFDTCxpQ0FBaUMsRUFDakMscUJBQXFCLEVBQ3JCLGtCQUFrQixFQUNsQix1QkFBdUIsRUFDdkIsMEJBQTBCLEVBRTNCLE1BQU0scUJBQXFCLENBQUM7QUFFN0IsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDcEQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDdEQsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDaEQsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbEQsTUFBTSxDQUFDLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7QUFFNUMsTUFBTSxPQUFPLGdCQUFpQixTQUFRLFdBQVc7SUFRL0MsWUFBWSxXQUFtQixFQUFFLFVBQWtCLEVBQUUsYUFBcUI7UUFDeEUsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztR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O1lBQ0gsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxxQ0FBcUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM5RCxDQUFDO1lBQ0QsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0tBQUE7Q0FDRjtBQUVELFNBQWUsaUJBQWlCLENBQUMsSUFBb0I7O1FBQ25ELE9BQU8sSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDMUMsQ0FBQztDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRmlsZSB9IGZyb20gXCIuL1N5bmNocm9uaXplXCI7XHJcbmltcG9ydCB7IEZpbGVNYW5hZ2VyIH0gZnJvbSBcIi4vQWJzdHJhY3RGaWxlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwidXRpbFwiO1xyXG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwiZnNcIjtcclxuaW1wb3J0ICogYXMgeG1sMmpzIGZyb20gXCJ4bWwyanNcIjtcclxuaW1wb3J0IHtcclxuICBnZW5lcmF0ZUFjY291bnRTQVNRdWVyeVBhcmFtZXRlcnMsXHJcbiAgQWNjb3VudFNBU1Blcm1pc3Npb25zLFxyXG4gIEFjY291bnRTQVNTZXJ2aWNlcyxcclxuICBBY2NvdW50U0FTUmVzb3VyY2VUeXBlcyxcclxuICBTdG9yYWdlU2hhcmVkS2V5Q3JlZGVudGlhbCxcclxuICBCbG9iU2VydmljZUNsaWVudFxyXG59IGZyb20gXCJAYXp1cmUvc3RvcmFnZS1ibG9iXCI7XHJcblxyXG5leHBvcnQgY29uc3QgcmVhZEZpbGVBc3luYyA9IHByb21pc2lmeShmcy5yZWFkRmlsZSk7XHJcbmV4cG9ydCBjb25zdCB3cml0ZUZpbGVBc3luYyA9IHByb21pc2lmeShmcy53cml0ZUZpbGUpO1xyXG5leHBvcnQgY29uc3QgdW5saW5rQXN5bmMgPSBwcm9taXNpZnkoZnMudW5saW5rKTtcclxuZXhwb3J0IGNvbnN0IHJlYWRkaXJBc3luYyA9IHByb21pc2lmeShmcy5yZWFkZGlyKTtcclxuZXhwb3J0IGNvbnN0IHN0YXRBc3luYyA9IHByb21pc2lmeShmcy5zdGF0KTtcclxuXHJcbmV4cG9ydCBjbGFzcyBBenVyZUZpbGVNYW5hZ2VyIGV4dGVuZHMgRmlsZU1hbmFnZXIge1xyXG4gIHByaXZhdGUgYWNjb3VudE5hbWU6IHN0cmluZztcclxuICBwcml2YXRlIGNvbnRhaW5lck5hbWU6IHN0cmluZztcclxuICBwcml2YXRlIGFjY291bnRLZXk6IHN0cmluZztcclxuICBwcml2YXRlIHNhc1Rva2VuOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhdXRoUHJvbWlzZTogUHJvbWlzZTx2b2lkPjtcclxuICBwdWJsaWMgY29uc29sZVVybDogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihhY2NvdW50TmFtZTogc3RyaW5nLCBhY2NvdW50S2V5OiBzdHJpbmcsIGNvbnRhaW5lck5hbWU6IHN0cmluZykge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMuYWNjb3VudE5hbWUgPSBhY2NvdW50TmFtZTtcclxuICAgIHRoaXMuY29udGFpbmVyTmFtZSA9IGNvbnRhaW5lck5hbWU7XHJcbiAgICB0aGlzLmFjY291bnRLZXkgPSBhY2NvdW50S2V5O1xyXG4gICAgdGhpcy5hdXRoUHJvbWlzZSA9IHRoaXMuYXV0aGVudGljYXRlKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBpc09ubGluZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7fSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgYXV0aGVudGljYXRlKCk6IFByb21pc2U8dm9pZD4ge1xyXG5cclxuICAgIC8vY29uc3Qgc2hhcmVkS2V5Q3JlZGVudGlhbCA9IG5ldyBTdG9yYWdlU2hhcmVkS2V5Q3JlZGVudGlhbCh0aGlzLmFjY291bnROYW1lLCB0aGlzLmFjY291bnRLZXkpO1xyXG4gICAgLy9jb25zdCBibG9iU2VydmljZUNsaWVudCA9IG5ldyBCbG9iU2VydmljZUNsaWVudChgaHR0cHM6Ly8ke3RoaXMuYWNjb3VudE5hbWV9LmJsb2IuY29yZS53aW5kb3dzLm5ldGAsc2hhcmVkS2V5Q3JlZGVudGlhbCk7XHJcbiAgICAvL2NvbnN0IGNvbnRhaW5lckNsaWVudCA9IGJsb2JTZXJ2aWNlQ2xpZW50LmdldENvbnRhaW5lckNsaWVudCh0aGlzLmNvbnRhaW5lck5hbWUpO1xyXG5cclxuICAgIGNvbnN0IHBlcm1pc3Npb25zID0gbmV3IEFjY291bnRTQVNQZXJtaXNzaW9ucygpO1xyXG4gICAgcGVybWlzc2lvbnMucmVhZCA9IHRydWU7XHJcbiAgICBwZXJtaXNzaW9ucy53cml0ZSA9IHRydWU7XHJcbiAgICBwZXJtaXNzaW9ucy5kZWxldGUgPSB0cnVlO1xyXG4gICAgcGVybWlzc2lvbnMubGlzdCA9IHRydWU7XHJcblxyXG4gICAgY29uc3Qgc2VydmljZXMgPSBuZXcgQWNjb3VudFNBU1NlcnZpY2VzKCk7XHJcbiAgICBzZXJ2aWNlcy5ibG9iID0gdHJ1ZTtcclxuXHJcbiAgICBjb25zdCByZXNvdXJjZVR5cGVzID0gbmV3IEFjY291bnRTQVNSZXNvdXJjZVR5cGVzKCk7XHJcbiAgICByZXNvdXJjZVR5cGVzLmNvbnRhaW5lciA9IHRydWU7XHJcbiAgICByZXNvdXJjZVR5cGVzLm9iamVjdCA9IHRydWU7XHJcblxyXG4gICAgY29uc3Qgc3RhcnREYXRlID0gbmV3IERhdGUoKTtcclxuICAgIGNvbnN0IGV4cGlyeURhdGUgPSBuZXcgRGF0ZShzdGFydERhdGUpO1xyXG4gICAgZXhwaXJ5RGF0ZS5zZXRIb3VycyhzdGFydERhdGUuZ2V0SG91cnMoKSArIDEpO1xyXG5cclxuICAgIGNvbnN0IHNoYXJlZEtleUNyZWRlbnRpYWwgPSBuZXcgU3RvcmFnZVNoYXJlZEtleUNyZWRlbnRpYWwodGhpcy5hY2NvdW50TmFtZSwgdGhpcy5hY2NvdW50S2V5KTtcclxuXHJcbiAgICB0aGlzLnNhc1Rva2VuID0gZ2VuZXJhdGVBY2NvdW50U0FTUXVlcnlQYXJhbWV0ZXJzKHtcclxuICAgICAgcGVybWlzc2lvbnM6IHBlcm1pc3Npb25zLFxyXG4gICAgICBzZXJ2aWNlczogc2VydmljZXMudG9TdHJpbmcoKSxcclxuICAgICAgcmVzb3VyY2VUeXBlczogcmVzb3VyY2VUeXBlcy50b1N0cmluZygpLFxyXG4gICAgICBzdGFydHNPbjogc3RhcnREYXRlLFxyXG4gICAgICBleHBpcmVzT246IGV4cGlyeURhdGUsXHJcbiAgICB9LCBzaGFyZWRLZXlDcmVkZW50aWFsKS50b1N0cmluZygpO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHt0aGlzLmFjY291bnROYW1lfS5ibG9iLmNvcmUud2luZG93cy5uZXQvJHt0aGlzLmNvbnRhaW5lck5hbWV9P3Jlc3R5cGU9Y29udGFpbmVyJmNvbXA9bGlzdCYke3RoaXMuc2FzVG9rZW59YCk7XHJcblxyXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzICE9IDIwMCkge1xyXG4gICAgICAgIGNvbnN0IGNyZWF0ZVJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vJHt0aGlzLmFjY291bnROYW1lfS5ibG9iLmNvcmUud2luZG93cy5uZXQvJHt0aGlzLmNvbnRhaW5lck5hbWV9P3Jlc3R5cGU9Y29udGFpbmVyJiR7dGhpcy5zYXNUb2tlbn1gLCB7XHJcbiAgICAgICAgICBtZXRob2Q6ICdQVVQnXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmIChjcmVhdGVSZXNwb25zZS5zdGF0dXMgPT09IDIwMSkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYENvbnRhaW5lciAke3RoaXMuY29udGFpbmVyTmFtZX0gY3JlYXRlZC5gKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYEZhaWxlZCB0byBjcmVhdGUgY29udGFpbmVyICR7dGhpcy5jb250YWluZXJOYW1lfS4gU3RhdHVzOiAke2NyZWF0ZVJlc3BvbnNlLnN0YXR1c31gKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGFjY2Vzc2luZyBBenVyZSBCbG9iIFN0b3JhZ2U6ICR7ZXJyb3J9YCk7XHJcbiAgICB9XHJcblxyXG4gIH1cclxuXHJcbiAgcHVibGljIHBhdGgoZmlsZTogRmlsZSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KGZpbGUubmFtZSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyByZWFkRmlsZShmaWxlOiBGaWxlKTogUHJvbWlzZTxCdWZmZXI+IHtcclxuICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5hY2NvdW50TmFtZX0uYmxvYi5jb3JlLndpbmRvd3MubmV0LyR7XHJcbiAgICAgIHRoaXMuY29udGFpbmVyTmFtZVxyXG4gICAgfS8ke2RlY29kZVVSSUNvbXBvbmVudChmaWxlLnJlbW90ZU5hbWUpfT8ke3RoaXMuc2FzVG9rZW59YDtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsKTtcclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQIGVycm9yISBzdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xyXG4gICAgfVxyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmFycmF5QnVmZmVyKCk7XHJcblxyXG4gICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIHdyaXRlRmlsZShmaWxlOiBGaWxlLCBjb250ZW50OiBCdWZmZXIpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5hY2NvdW50TmFtZX0uYmxvYi5jb3JlLndpbmRvd3MubmV0LyR7dGhpcy5jb250YWluZXJOYW1lfS8ke2ZpbGUucmVtb3RlTmFtZX0/JHt0aGlzLnNhc1Rva2VufWA7XHJcblxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgbWV0aG9kOiBcIlBVVFwiLFxyXG4gICAgICBib2R5OiBjb250ZW50LFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIixcclxuICAgICAgICBcIngtbXMtYmxvYi10eXBlXCI6IFwiQmxvY2tCbG9iXCIsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQIGVycm9yISBzdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGRlbGV0ZUZpbGUoZmlsZTogRmlsZSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vJHt0aGlzLmFjY291bnROYW1lfS5ibG9iLmNvcmUud2luZG93cy5uZXQvJHt0aGlzLmNvbnRhaW5lck5hbWV9LyR7ZmlsZS5yZW1vdGVOYW1lfT8ke3RoaXMuc2FzVG9rZW59YDtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIG1ldGhvZDogXCJERUxFVEVcIixcclxuICAgIH0pO1xyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgZXJyb3IhIHN0YXR1czogJHtyZXNwb25zZS5zdGF0dXN9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgZ2V0RmlsZXMoKTogUHJvbWlzZTxGaWxlW10+IHtcclxuICAgIGxldCBmaWxlczogRmlsZVtdID0gW107XHJcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMuYWNjb3VudE5hbWV9LmJsb2IuY29yZS53aW5kb3dzLm5ldC8ke3RoaXMuY29udGFpbmVyTmFtZX0/cmVzdHlwZT1jb250YWluZXImY29tcD1saXN0JiR7dGhpcy5zYXNUb2tlbn1gO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsKTsgLy97bW9kZTogJ25vLWNvcnMnfVxyXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQIGVycm9yISBzdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB4bWwyanMucGFyc2VTdHJpbmdQcm9taXNlKGRhdGEpO1xyXG4gICAgICBjb25zdCBibG9icyA9IHJlc3VsdC5FbnVtZXJhdGlvblJlc3VsdHMuQmxvYnNbMF0uQmxvYjtcclxuXHJcbiAgICAgIGlmIChibG9icykge1xyXG4gICAgICAgIGZpbGVzID0gYmxvYnMubWFwKChibG9iOiBhbnkpID0+IHtcclxuICAgICAgICAgIGNvbnN0IHByb3BlcnRpZXMgPSBibG9iLlByb3BlcnRpZXNbMF07XHJcbiAgICAgICAgICBjb25zdCBtZDVIYXNoID0gcHJvcGVydGllc1tcIkNvbnRlbnQtTUQ1XCJdWzBdXHJcbiAgICAgICAgICAgID8gQnVmZmVyLmZyb20ocHJvcGVydGllc1tcIkNvbnRlbnQtTUQ1XCJdWzBdLCBcImJhc2U2NFwiKS50b1N0cmluZyhcImhleFwiKVxyXG4gICAgICAgICAgICA6IFwiXCI7XHJcblxyXG4gICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgbmFtZTogZGVjb2RlVVJJQ29tcG9uZW50KGJsb2IuTmFtZVswXSksXHJcbiAgICAgICAgICAgIGxvY2FsTmFtZTogXCJcIixcclxuICAgICAgICAgICAgcmVtb3RlTmFtZTogYmxvYi5OYW1lWzBdLFxyXG4gICAgICAgICAgICBtaW1lOiBwcm9wZXJ0aWVzW1wiQ29udGVudC1UeXBlXCJdWzBdIHx8IFwiXCIsXHJcbiAgICAgICAgICAgIGxhc3RNb2RpZmllZDogcHJvcGVydGllc1tcIkxhc3QtTW9kaWZpZWRcIl1bMF1cclxuICAgICAgICAgICAgICA/IG5ldyBEYXRlKHByb3BlcnRpZXNbXCJMYXN0LU1vZGlmaWVkXCJdWzBdKVxyXG4gICAgICAgICAgICAgIDogbmV3IERhdGUoKSxcclxuICAgICAgICAgICAgc2l6ZTogcHJvcGVydGllc1tcIkNvbnRlbnQtTGVuZ3RoXCJdWzBdXHJcbiAgICAgICAgICAgICAgPyBOdW1iZXIocHJvcGVydGllc1tcIkNvbnRlbnQtTGVuZ3RoXCJdWzBdKVxyXG4gICAgICAgICAgICAgIDogMCxcclxuICAgICAgICAgICAgbWQ1OiBtZDVIYXNoLFxyXG4gICAgICAgICAgICBpc0RpcmVjdG9yeTogZmFsc2UsXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgYWNjZXNzaW5nIEF6dXJlIEJsb2IgU3RvcmFnZTpcIiwgZXJyb3IpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZpbGVzO1xyXG4gIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gYmxvYlRvQXJyYXlCdWZmZXIoYmxvYjogUmVhZGFibGVTdHJlYW0pOiBQcm9taXNlPEFycmF5QnVmZmVyPiB7XHJcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShibG9iKS5hcnJheUJ1ZmZlcigpO1xyXG59XHJcbiJdfQ==