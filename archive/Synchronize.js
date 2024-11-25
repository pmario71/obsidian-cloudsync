import { __awaiter } from "tslib";
import { writeFile, readFile } from "fs";
import { promisify } from "util";
import { diff_match_patch } from "diff-match-patch";
export class Synchronize {
    //we need a caching table for remote files - names, timestamps and MD5s (so we can track what files we know about)
    constructor(local, remote) {
        this.local = local;
        this.fileName = local.directory + "/.cloudsync.json";
        this.remote = remote;
        this.localFiles = [];
        this.remoteFiles = [];
        this.fileCache = new Map();
        this.lastSync = new Date(0);
    }
    readFileCache() {
        return __awaiter(this, void 0, void 0, function* () {
            const readFileAsync = promisify(readFile);
            try {
                const fileCacheJson = yield readFileAsync(this.fileName, "utf-8");
                const { lastSync, fileCache } = JSON.parse(fileCacheJson);
                this.lastSync = new Date(lastSync);
                this.fileCache = new Map(fileCache);
            }
            catch (error) {
                this.lastSync = new Date(0);
                this.fileCache.clear();
            }
        });
    }
    writeFileCache(processedFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            const writeFileAsync = promisify(writeFile);
            this.fileCache.clear();
            processedFiles.forEach((file) => {
                this.fileCache.set(file.name, file.md5);
            });
            const fileCacheArray = Array.from(this.fileCache.entries());
            const fileCacheJson = JSON.stringify({
                lastSync: this.lastSync,
                fileCache: fileCacheArray,
            });
            yield writeFileAsync(this.fileName, fileCacheJson);
        });
    }
    syncActions() {
        return __awaiter(this, void 0, void 0, function* () {
            const scenarios = [];
            this.localFiles = yield this.local.getFiles();
            this.remoteFiles = yield this.remote.getFiles();
            yield this.readFileCache();
            // Handle local files
            this.localFiles.forEach((localFile) => {
                const remoteFile = this.remoteFiles.find((f) => f.name === localFile.name);
                if (!remoteFile) {
                    if (!this.fileCache.has(localFile.name)) {
                        // Not in the cache; new file since last sync, needs to be copied to remote
                        scenarios.push({
                            local: localFile,
                            remote: null,
                            rule: "LOCAL_TO_REMOTE",
                        });
                    }
                    else {
                        // File existed during last sync but is now missing remotely, delete locally
                        scenarios.push({
                            local: localFile,
                            remote: null,
                            rule: "DELETE_LOCAL",
                        });
                    }
                }
                else if (localFile.md5 !== remoteFile.md5) {
                    const cachedMd5 = this.fileCache.get(localFile.name);
                    if (cachedMd5 && cachedMd5 === remoteFile.md5) {
                        // File exists on both sides but remote file didn't change, copy to remote
                        scenarios.push({
                            local: localFile,
                            remote: remoteFile,
                            rule: "LOCAL_TO_REMOTE",
                        });
                    }
                    else if (cachedMd5 && cachedMd5 === localFile.md5) {
                        // File exists on both sides but local file didn't change, copy to local
                        scenarios.push({
                            local: localFile,
                            remote: remoteFile,
                            rule: "REMOTE_TO_LOCAL",
                        });
                    }
                    else {
                        // File exists on both sides and changed on both sides, merge the differences
                        scenarios.push({
                            local: localFile,
                            remote: remoteFile,
                            rule: "DIFF_MERGE",
                        });
                    }
                }
            });
            // Handle remote files
            this.remoteFiles.forEach((remoteFile) => {
                const localFile = this.localFiles.find((f) => f.name === remoteFile.name);
                if (!localFile) {
                    if (!this.fileCache.has(remoteFile.name)) {
                        // Not in the cache; new file since last sync, needs to be copied to local
                        scenarios.push({
                            local: null,
                            remote: remoteFile,
                            rule: "REMOTE_TO_LOCAL",
                        });
                    }
                    else {
                        // File existed during last sync but is now missing locally, delete on remote
                        scenarios.push({
                            local: null,
                            remote: remoteFile,
                            rule: "DELETE_REMOTE",
                        });
                    }
                }
                else {
                    scenarios.push({
                        local: localFile,
                        remote: remoteFile,
                        rule: "TO_CACHE",
                    });
                }
            });
            return scenarios;
        });
    }
    runAllScenarios(scenarios) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = scenarios.map((scenario) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (scenario.rule === "LOCAL_TO_REMOTE" && scenario.local) {
                        const content = yield this.local.readFile(scenario.local);
                        return this.remote.writeFile(scenario.local, content);
                    }
                    if (scenario.rule === "REMOTE_TO_LOCAL" && scenario.remote) {
                        const content = yield this.remote.readFile(scenario.remote);
                        return this.local.writeFile(scenario.remote, content);
                    }
                    if (scenario.rule === "DELETE_LOCAL" && scenario.local) {
                        return this.local.deleteFile(scenario.local);
                    }
                    if (scenario.rule === "DELETE_REMOTE" && scenario.remote) {
                        return this.remote.deleteFile(scenario.remote);
                    }
                    if (scenario.rule === "DIFF_MERGE" &&
                        scenario.local &&
                        scenario.remote) {
                        return this.diffMerge(scenario.local);
                    }
                }
                catch (error) {
                    console.error(`Failed to run scenario: ${scenario.rule}`, error);
                }
                return Promise.resolve();
            }));
            yield Promise.all(promises);
            this.lastSync = new Date();
            this.remoteFiles = yield this.remote.getFiles();
            yield this.writeFileCache(this.remoteFiles);
        });
    }
    copyAllToRemote(scenarios) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = scenarios
                .filter((scenario) => scenario.rule === "LOCAL_TO_REMOTE")
                .map((scenario) => {
                if (scenario.local) {
                    return this.copyToRemote(scenario.local);
                }
                return Promise.resolve();
            });
            yield Promise.all(promises);
        });
    }
    copyAllToLocal(scenarios) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = scenarios
                .filter((scenario) => scenario.rule === "REMOTE_TO_LOCAL")
                .map((scenario) => {
                if (scenario.remote) {
                    return this.copyToLocal(scenario.remote);
                }
                return Promise.resolve();
            });
            yield Promise.all(promises);
        });
    }
    deleteAllLocal(scenarios) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = scenarios
                .filter((scenario) => scenario.rule === "DELETE_LOCAL")
                .map((scenario) => {
                if (scenario.local) {
                    return this.deleteFromLocal(scenario.local);
                }
                return Promise.resolve();
            });
            yield Promise.all(promises);
        });
    }
    deleteAllRemote(scenarios) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = scenarios
                .filter((scenario) => scenario.rule === "DELETE_REMOTE")
                .map((scenario) => {
                if (scenario.remote) {
                    return this.deleteFromRemote(scenario.remote);
                }
                return Promise.resolve();
            });
            yield Promise.all(promises);
        });
    }
    diffMergeAll(scenarios) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = scenarios
                .filter((scenario) => scenario.rule === "DIFF_MERGE")
                .map((scenario) => {
                if (scenario.local && scenario.remote) {
                    return this.diffMerge(scenario.local);
                }
                return Promise.resolve();
            });
            yield Promise.all(promises);
        });
    }
    copyToRemote(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield this.local.readFile(file);
            yield this.remote.writeFile(file, content);
        });
    }
    copyToLocal(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield this.remote.readFile(file);
            yield this.local.writeFile(file, content);
        });
    }
    deleteFromRemote(file) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.remote.deleteFile(file);
        });
    }
    deleteFromLocal(file) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.local.deleteFile(file);
        });
    }
    diffMerge(file) {
        return __awaiter(this, void 0, void 0, function* () {
            // Start reading local and remote files at the same time
            const [localBuffer, remoteBuffer] = yield Promise.all([
                this.local.readFile(file),
                this.remote.readFile(file),
            ]);
            // Convert buffers to strings and lines
            const localContent = localBuffer.toString();
            const remoteContent = remoteBuffer.toString();
            const localLines = localContent.split("\n");
            const remoteLines = remoteContent.split("\n");
            // Create a new diff_match_patch instance
            const dmp = new diff_match_patch();
            // Compute the differences between local and remote content
            const diffs = dmp.diff_main(localLines.join("\n"), remoteLines.join("\n"));
            dmp.diff_cleanupSemantic(diffs);
            // Initialize mergedLines with localLines
            const mergedLines = [...localLines];
            // Iterate over the diffs
            for (const [operation, text] of diffs) {
                // If the operation is an insertion, insert the lines at the correct position
                if (operation === diff_match_patch.DIFF_INSERT) {
                    const lines = text.split("\n");
                    lines.pop(); // Remove the last element, which is always an empty string
                    const index = mergedLines.indexOf(localLines[0]);
                    mergedLines.splice(index, 0, ...lines);
                }
            }
            const mergedBuffer = Buffer.from(mergedLines.join("\n"));
            // Start writing the merged buffer to local and remote files at the same time
            yield Promise.all([
                this.local.writeFile(file, mergedBuffer),
                this.remote.writeFile(file, mergedBuffer),
            ]);
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3luY2hyb25pemUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJTeW5jaHJvbml6ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQ0EsT0FBTyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUNqQyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQTRCcEQsTUFBTSxPQUFPLFdBQVc7SUFTdEIsa0hBQWtIO0lBRWxILFlBQVksS0FBdUIsRUFBRSxNQUFtQjtRQUN0RCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQyxTQUFTLEdBQUcsa0JBQWtCLENBQUM7UUFDckQsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDckIsSUFBSSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUM7UUFDdEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVLLGFBQWE7O1lBQ2pCLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxhQUFhLEdBQUcsTUFBTSxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDbEUsTUFBTSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUMxRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dC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ekQsNkVBQTZFO1lBQzdFLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztnQkFDaEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQztnQkFDeEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQzthQUMxQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQUE7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEZpbGVNYW5hZ2VyIH0gZnJvbSBcIi4vQWJzdHJhY3RGaWxlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyB3cml0ZUZpbGUsIHJlYWRGaWxlIH0gZnJvbSBcImZzXCI7XHJcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gXCJ1dGlsXCI7XHJcbmltcG9ydCB7IGRpZmZfbWF0Y2hfcGF0Y2ggfSBmcm9tIFwiZGlmZi1tYXRjaC1wYXRjaFwiO1xyXG5pbXBvcnQgeyBMb2NhbEZpbGVNYW5hZ2VyIH0gZnJvbSBcIi4vTG9jYWxGaWxlTWFuYWdlclwiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBGaWxlIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgbG9jYWxOYW1lOiBzdHJpbmc7XHJcbiAgcmVtb3RlTmFtZTogc3RyaW5nO1xyXG4gIG1pbWU6IHN0cmluZztcclxuICBsYXN0TW9kaWZpZWQ6IERhdGU7XHJcbiAgc2l6ZTogbnVtYmVyO1xyXG4gIG1kNTogc3RyaW5nO1xyXG4gIGlzRGlyZWN0b3J5OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFNjZW5hcmlvIHtcclxuICBsb2NhbDogRmlsZSB8IG51bGw7XHJcbiAgcmVtb3RlOiBGaWxlIHwgbnVsbDtcclxuICBydWxlOiBTeW5jUnVsZTtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgU3luY1J1bGUgPVxyXG4gIHwgXCJMT0NBTF9UT19SRU1PVEVcIlxyXG4gIHwgXCJSRU1PVEVfVE9fTE9DQUxcIlxyXG4gIHwgXCJESUZGX01FUkdFXCJcclxuICB8IFwiREVMRVRFX0xPQ0FMXCJcclxuICB8IFwiREVMRVRFX1JFTU9URVwiXHJcbiAgfCBcIlRPX0NBQ0hFXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgU3luY2hyb25pemUge1xyXG4gIGxvY2FsOiBGaWxlTWFuYWdlcjtcclxuICByZW1vdGU6IEZpbGVNYW5hZ2VyO1xyXG4gIGxvY2FsRmlsZXM6IEZpbGVbXTtcclxuICByZW1vdGVGaWxlczogRmlsZVtdO1xyXG4gIGZpbGVOYW1lOiBzdHJpbmc7XHJcbiAgZmlsZUNhY2hlOiBNYXA8c3RyaW5nLCBzdHJpbmc+O1xyXG4gIGxhc3RTeW5jOiBEYXRlO1xyXG5cclxuICAvL3dlIG5lZWQgYSBjYWNoaW5nIHRhYmxlIGZvciByZW1vdGUgZmlsZXMgLSBuYW1lcywgdGltZXN0YW1wcyBhbmQgTUQ1cyAoc28gd2UgY2FuIHRyYWNrIHdoYXQgZmlsZXMgd2Uga25vdyBhYm91dClcclxuXHJcbiAgY29uc3RydWN0b3IobG9jYWw6IExvY2FsRmlsZU1hbmFnZXIsIHJlbW90ZTogRmlsZU1hbmFnZXIpIHtcclxuICAgIHRoaXMubG9jYWwgPSBsb2NhbDtcclxuICAgIHRoaXMuZmlsZU5hbWUgPSBsb2NhbC5kaXJlY3RvcnkgKyBcIi8uY2xvdWRzeW5jLmpzb25cIjtcclxuICAgIHRoaXMucmVtb3RlID0gcmVtb3RlO1xyXG4gICAgdGhpcy5sb2NhbEZpbGVzID0gW107XHJcbiAgICB0aGlzLnJlbW90ZUZpbGVzID0gW107XHJcbiAgICB0aGlzLmZpbGVDYWNoZSA9IG5ldyBNYXAoKTtcclxuICAgIHRoaXMubGFzdFN5bmMgPSBuZXcgRGF0ZSgwKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHJlYWRGaWxlQ2FjaGUoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCByZWFkRmlsZUFzeW5jID0gcHJvbWlzaWZ5KHJlYWRGaWxlKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGZpbGVDYWNoZUpzb24gPSBhd2FpdCByZWFkRmlsZUFzeW5jKHRoaXMuZmlsZU5hbWUsIFwidXRmLThcIik7XHJcbiAgICAgIGNvbnN0IHsgbGFzdFN5bmMsIGZpbGVDYWNoZSB9ID0gSlNPTi5wYXJzZShmaWxlQ2FjaGVKc29uKTtcclxuICAgICAgdGhpcy5sYXN0U3luYyA9IG5ldyBEYXRlKGxhc3RTeW5jKTtcclxuICAgICAgdGhpcy5maWxlQ2FjaGUgPSBuZXcgTWFwKGZpbGVDYWNoZSk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLmxhc3RTeW5jID0gbmV3IERhdGUoMCk7XHJcbiAgICAgIHRoaXMuZmlsZUNhY2hlLmNsZWFyKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyB3cml0ZUZpbGVDYWNoZShwcm9jZXNzZWRGaWxlczogRmlsZVtdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCB3cml0ZUZpbGVBc3luYyA9IHByb21pc2lmeSh3cml0ZUZpbGUpO1xyXG4gICAgdGhpcy5maWxlQ2FjaGUuY2xlYXIoKTtcclxuICAgIHByb2Nlc3NlZEZpbGVzLmZvckVhY2goKGZpbGUpID0+IHtcclxuICAgICAgdGhpcy5maWxlQ2FjaGUuc2V0KGZpbGUubmFtZSwgZmlsZS5tZDUpO1xyXG4gICAgfSk7XHJcbiAgICBjb25zdCBmaWxlQ2FjaGVBcnJheSA9IEFycmF5LmZyb20odGhpcy5maWxlQ2FjaGUuZW50cmllcygpKTtcclxuICAgIGNvbnN0IGZpbGVDYWNoZUpzb24gPSBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgIGxhc3RTeW5jOiB0aGlzLmxhc3RTeW5jLFxyXG4gICAgICBmaWxlQ2FjaGU6IGZpbGVDYWNoZUFycmF5LFxyXG4gICAgfSk7XHJcbiAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyh0aGlzLmZpbGVOYW1lLCBmaWxlQ2FjaGVKc29uKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHN5bmNBY3Rpb25zKCk6IFByb21pc2U8U2NlbmFyaW9bXT4ge1xyXG4gICAgY29uc3Qgc2NlbmFyaW9zOiBTY2VuYXJpb1tdID0gW107XHJcbiAgICB0aGlzLmxvY2FsRmlsZXMgPSBhd2FpdCB0aGlzLmxvY2FsLmdldEZpbGVzKCk7XHJcbiAgICB0aGlzLnJlbW90ZUZpbGVzID0gYXdhaXQgdGhpcy5yZW1vdGUuZ2V0RmlsZXMoKTtcclxuICAgIGF3YWl0IHRoaXMucmVhZEZpbGVDYWNoZSgpO1xyXG5cclxuICAgIC8vIEhhbmRsZSBsb2NhbCBmaWxlc1xyXG4gICAgdGhpcy5sb2NhbEZpbGVzLmZvckVhY2goKGxvY2FsRmlsZSkgPT4ge1xyXG4gICAgICBjb25zdCByZW1vdGVGaWxlID0gdGhpcy5yZW1vdGVGaWxlcy5maW5kKFxyXG4gICAgICAgIChmKSA9PiBmLm5hbWUgPT09IGxvY2FsRmlsZS5uYW1lXHJcbiAgICAgICk7XHJcblxyXG4gICAgICBpZiAoIXJlbW90ZUZpbGUpIHtcclxuICAgICAgICBpZiAoIXRoaXMuZmlsZUNhY2hlLmhhcyhsb2NhbEZpbGUubmFtZSkpIHtcclxuICAgICAgICAgIC8vIE5vdCBpbiB0aGUgY2FjaGU7IG5ldyBmaWxlIHNpbmNlIGxhc3Qgc3luYywgbmVlZHMgdG8gYmUgY29waWVkIHRvIHJlbW90ZVxyXG4gICAgICAgICAgc2NlbmFyaW9zLnB1c2goe1xyXG4gICAgICAgICAgICBsb2NhbDogbG9jYWxGaWxlLFxyXG4gICAgICAgICAgICByZW1vdGU6IG51bGwsXHJcbiAgICAgICAgICAgIHJ1bGU6IFwiTE9DQUxfVE9fUkVNT1RFXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gRmlsZSBleGlzdGVkIGR1cmluZyBsYXN0IHN5bmMgYnV0IGlzIG5vdyBtaXNzaW5nIHJlbW90ZWx5LCBkZWxldGUgbG9jYWxseVxyXG4gICAgICAgICAgc2NlbmFyaW9zLnB1c2goe1xyXG4gICAgICAgICAgICBsb2NhbDogbG9jYWxGaWxlLFxyXG4gICAgICAgICAgICByZW1vdGU6IG51bGwsXHJcbiAgICAgICAgICAgIHJ1bGU6IFwiREVMRVRFX0xPQ0FMXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSBpZiAobG9jYWxGaWxlLm1kNSAhPT0gcmVtb3RlRmlsZS5tZDUpIHtcclxuICAgICAgICBjb25zdCBjYWNoZWRNZDUgPSB0aGlzLmZpbGVDYWNoZS5nZXQobG9jYWxGaWxlLm5hbWUpO1xyXG4gICAgICAgIGlmIChjYWNoZWRNZDUgJiYgY2FjaGVkTWQ1ID09PSByZW1vdGVGaWxlLm1kNSkge1xyXG4gICAgICAgICAgLy8gRmlsZSBleGlzdHMgb24gYm90aCBzaWRlcyBidXQgcmVtb3RlIGZpbGUgZGlkbid0IGNoYW5nZSwgY29weSB0byByZW1vdGVcclxuICAgICAgICAgIHNjZW5hcmlvcy5wdXNoKHtcclxuICAgICAgICAgICAgbG9jYWw6IGxvY2FsRmlsZSxcclxuICAgICAgICAgICAgcmVtb3RlOiByZW1vdGVGaWxlLFxyXG4gICAgICAgICAgICBydWxlOiBcIkxPQ0FMX1RPX1JFTU9URVwiLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChjYWNoZWRNZDUgJiYgY2FjaGVkTWQ1ID09PSBsb2NhbEZpbGUubWQ1KSB7XHJcbiAgICAgICAgICAvLyBGaWxlIGV4aXN0cyBvbiBib3RoIHNpZGVzIGJ1dCBsb2NhbCBmaWxlIGRpZG4ndCBjaGFuZ2UsIGNvcHkgdG8gbG9jYWxcclxuICAgICAgICAgIHNjZW5hcmlvcy5wdXNoKHtcclxuICAgICAgICAgICAgbG9jYWw6IGxvY2FsRmlsZSxcclxuICAgICAgICAgICAgcmVtb3RlOiByZW1vdGVGaWxlLFxyXG4gICAgICAgICAgICBydWxlOiBcIlJFTU9URV9UT19MT0NBTFwiLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIC8vIEZpbGUgZXhpc3RzIG9uIGJvdGggc2lkZXMgYW5kIGNoYW5nZWQgb24gYm90aCBzaWRlcywgbWVyZ2UgdGhlIGRpZmZlcmVuY2VzXHJcbiAgICAgICAgICBzY2VuYXJpb3MucHVzaCh7XHJcbiAgICAgICAgICAgIGxvY2FsOiBsb2NhbEZpbGUsXHJcbiAgICAgICAgICAgIHJlbW90ZTogcmVtb3RlRmlsZSxcclxuICAgICAgICAgICAgcnVsZTogXCJESUZGX01FUkdFXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEhhbmRsZSByZW1vdGUgZmlsZXNcclxuICAgIHRoaXMucmVtb3RlRmlsZXMuZm9yRWFjaCgocmVtb3RlRmlsZSkgPT4ge1xyXG4gICAgICBjb25zdCBsb2NhbEZpbGUgPSB0aGlzLmxvY2FsRmlsZXMuZmluZCgoZikgPT4gZi5uYW1lID09PSByZW1vdGVGaWxlLm5hbWUpO1xyXG4gICAgICBpZiAoIWxvY2FsRmlsZSkge1xyXG4gICAgICAgIGlmICghdGhpcy5maWxlQ2FjaGUuaGFzKHJlbW90ZUZpbGUubmFtZSkpIHtcclxuICAgICAgICAgIC8vIE5vdCBpbiB0aGUgY2FjaGU7IG5ldyBmaWxlIHNpbmNlIGxhc3Qgc3luYywgbmVlZHMgdG8gYmUgY29waWVkIHRvIGxvY2FsXHJcbiAgICAgICAgICBzY2VuYXJpb3MucHVzaCh7XHJcbiAgICAgICAgICAgIGxvY2FsOiBudWxsLFxyXG4gICAgICAgICAgICByZW1vdGU6IHJlbW90ZUZpbGUsXHJcbiAgICAgICAgICAgIHJ1bGU6IFwiUkVNT1RFX1RPX0xPQ0FMXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gRmlsZSBleGlzdGVkIGR1cmluZyBsYXN0IHN5bmMgYnV0IGlzIG5vdyBtaXNzaW5nIGxvY2FsbHksIGRlbGV0ZSBvbiByZW1vdGVcclxuICAgICAgICAgIHNjZW5hcmlvcy5wdXNoKHtcclxuICAgICAgICAgICAgbG9jYWw6IG51bGwsXHJcbiAgICAgICAgICAgIHJlbW90ZTogcmVtb3RlRmlsZSxcclxuICAgICAgICAgICAgcnVsZTogXCJERUxFVEVfUkVNT1RFXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc2NlbmFyaW9zLnB1c2goe1xyXG4gICAgICAgICAgbG9jYWw6IGxvY2FsRmlsZSxcclxuICAgICAgICAgIHJlbW90ZTogcmVtb3RlRmlsZSxcclxuICAgICAgICAgIHJ1bGU6IFwiVE9fQ0FDSEVcIixcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gc2NlbmFyaW9zO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgcnVuQWxsU2NlbmFyaW9zKHNjZW5hcmlvczogU2NlbmFyaW9bXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcHJvbWlzZXMgPSBzY2VuYXJpb3MubWFwKGFzeW5jIChzY2VuYXJpbykgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGlmIChzY2VuYXJpby5ydWxlID09PSBcIkxPQ0FMX1RPX1JFTU9URVwiICYmIHNjZW5hcmlvLmxvY2FsKSB7XHJcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5sb2NhbC5yZWFkRmlsZShzY2VuYXJpby5sb2NhbCk7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZW1vdGUud3JpdGVGaWxlKHNjZW5hcmlvLmxvY2FsLCBjb250ZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHNjZW5hcmlvLnJ1bGUgPT09IFwiUkVNT1RFX1RPX0xPQ0FMXCIgJiYgc2NlbmFyaW8ucmVtb3RlKSB7XHJcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5yZW1vdGUucmVhZEZpbGUoc2NlbmFyaW8ucmVtb3RlKTtcclxuICAgICAgICAgIHJldHVybiB0aGlzLmxvY2FsLndyaXRlRmlsZShzY2VuYXJpby5yZW1vdGUsIGNvbnRlbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoc2NlbmFyaW8ucnVsZSA9PT0gXCJERUxFVEVfTE9DQUxcIiAmJiBzY2VuYXJpby5sb2NhbCkge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMubG9jYWwuZGVsZXRlRmlsZShzY2VuYXJpby5sb2NhbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzY2VuYXJpby5ydWxlID09PSBcIkRFTEVURV9SRU1PVEVcIiAmJiBzY2VuYXJpby5yZW1vdGUpIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLnJlbW90ZS5kZWxldGVGaWxlKHNjZW5hcmlvLnJlbW90ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgIHNjZW5hcmlvLnJ1bGUgPT09IFwiRElGRl9NRVJHRVwiICYmXHJcbiAgICAgICAgICBzY2VuYXJpby5sb2NhbCAmJlxyXG4gICAgICAgICAgc2NlbmFyaW8ucmVtb3RlXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5kaWZmTWVyZ2Uoc2NlbmFyaW8ubG9jYWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gcnVuIHNjZW5hcmlvOiAke3NjZW5hcmlvLnJ1bGV9YCwgZXJyb3IpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgIH0pO1xyXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xyXG4gICAgdGhpcy5sYXN0U3luYyA9IG5ldyBEYXRlKCk7XHJcbiAgICB0aGlzLnJlbW90ZUZpbGVzID0gYXdhaXQgdGhpcy5yZW1vdGUuZ2V0RmlsZXMoKTtcclxuICAgIGF3YWl0IHRoaXMud3JpdGVGaWxlQ2FjaGUodGhpcy5yZW1vdGVGaWxlcyk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBjb3B5QWxsVG9SZW1vdGUoc2NlbmFyaW9zOiBTY2VuYXJpb1tdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBwcm9taXNlcyA9IHNjZW5hcmlvc1xyXG4gICAgICAuZmlsdGVyKChzY2VuYXJpbykgPT4gc2NlbmFyaW8ucnVsZSA9PT0gXCJMT0NBTF9UT19SRU1PVEVcIilcclxuICAgICAgLm1hcCgoc2NlbmFyaW8pID0+IHtcclxuICAgICAgICBpZiAoc2NlbmFyaW8ubG9jYWwpIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLmNvcHlUb1JlbW90ZShzY2VuYXJpby5sb2NhbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBjb3B5QWxsVG9Mb2NhbChzY2VuYXJpb3M6IFNjZW5hcmlvW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHByb21pc2VzID0gc2NlbmFyaW9zXHJcbiAgICAgIC5maWx0ZXIoKHNjZW5hcmlvKSA9PiBzY2VuYXJpby5ydWxlID09PSBcIlJFTU9URV9UT19MT0NBTFwiKVxyXG4gICAgICAubWFwKChzY2VuYXJpbykgPT4ge1xyXG4gICAgICAgIGlmIChzY2VuYXJpby5yZW1vdGUpIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLmNvcHlUb0xvY2FsKHNjZW5hcmlvLnJlbW90ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBkZWxldGVBbGxMb2NhbChzY2VuYXJpb3M6IFNjZW5hcmlvW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHByb21pc2VzID0gc2NlbmFyaW9zXHJcbiAgICAgIC5maWx0ZXIoKHNjZW5hcmlvKSA9PiBzY2VuYXJpby5ydWxlID09PSBcIkRFTEVURV9MT0NBTFwiKVxyXG4gICAgICAubWFwKChzY2VuYXJpbykgPT4ge1xyXG4gICAgICAgIGlmIChzY2VuYXJpby5sb2NhbCkge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuZGVsZXRlRnJvbUxvY2FsKHNjZW5hcmlvLmxvY2FsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGRlbGV0ZUFsbFJlbW90ZShzY2VuYXJpb3M6IFNjZW5hcmlvW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHByb21pc2VzID0gc2NlbmFyaW9zXHJcbiAgICAgIC5maWx0ZXIoKHNjZW5hcmlvKSA9PiBzY2VuYXJpby5ydWxlID09PSBcIkRFTEVURV9SRU1PVEVcIilcclxuICAgICAgLm1hcCgoc2NlbmFyaW8pID0+IHtcclxuICAgICAgICBpZiAoc2NlbmFyaW8ucmVtb3RlKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5kZWxldGVGcm9tUmVtb3RlKHNjZW5hcmlvLnJlbW90ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBkaWZmTWVyZ2VBbGwoc2NlbmFyaW9zOiBTY2VuYXJpb1tdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBwcm9taXNlcyA9IHNjZW5hcmlvc1xyXG4gICAgICAuZmlsdGVyKChzY2VuYXJpbykgPT4gc2NlbmFyaW8ucnVsZSA9PT0gXCJESUZGX01FUkdFXCIpXHJcbiAgICAgIC5tYXAoKHNjZW5hcmlvKSA9PiB7XHJcbiAgICAgICAgaWYgKHNjZW5hcmlvLmxvY2FsICYmIHNjZW5hcmlvLnJlbW90ZSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuZGlmZk1lcmdlKHNjZW5hcmlvLmxvY2FsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGNvcHlUb1JlbW90ZShmaWxlOiBGaWxlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5sb2NhbC5yZWFkRmlsZShmaWxlKTtcclxuICAgIGF3YWl0IHRoaXMucmVtb3RlLndyaXRlRmlsZShmaWxlLCBjb250ZW50KTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGNvcHlUb0xvY2FsKGZpbGU6IEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlbW90ZS5yZWFkRmlsZShmaWxlKTtcclxuICAgIGF3YWl0IHRoaXMubG9jYWwud3JpdGVGaWxlKGZpbGUsIGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgZGVsZXRlRnJvbVJlbW90ZShmaWxlOiBGaWxlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlbW90ZS5kZWxldGVGaWxlKGZpbGUpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgZGVsZXRlRnJvbUxvY2FsKGZpbGU6IEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMubG9jYWwuZGVsZXRlRmlsZShmaWxlKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGRpZmZNZXJnZShmaWxlOiBGaWxlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAvLyBTdGFydCByZWFkaW5nIGxvY2FsIGFuZCByZW1vdGUgZmlsZXMgYXQgdGhlIHNhbWUgdGltZVxyXG4gICAgY29uc3QgW2xvY2FsQnVmZmVyLCByZW1vdGVCdWZmZXJdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xyXG4gICAgICB0aGlzLmxvY2FsLnJlYWRGaWxlKGZpbGUpLFxyXG4gICAgICB0aGlzLnJlbW90ZS5yZWFkRmlsZShmaWxlKSxcclxuICAgIF0pO1xyXG5cclxuICAgIC8vIENvbnZlcnQgYnVmZmVycyB0byBzdHJpbmdzIGFuZCBsaW5lc1xyXG4gICAgY29uc3QgbG9jYWxDb250ZW50ID0gbG9jYWxCdWZmZXIudG9TdHJpbmcoKTtcclxuICAgIGNvbnN0IHJlbW90ZUNvbnRlbnQgPSByZW1vdGVCdWZmZXIudG9TdHJpbmcoKTtcclxuICAgIGNvbnN0IGxvY2FsTGluZXMgPSBsb2NhbENvbnRlbnQuc3BsaXQoXCJcXG5cIik7XHJcbiAgICBjb25zdCByZW1vdGVMaW5lcyA9IHJlbW90ZUNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XHJcblxyXG4gICAgLy8gQ3JlYXRlIGEgbmV3IGRpZmZfbWF0Y2hfcGF0Y2ggaW5zdGFuY2VcclxuICAgIGNvbnN0IGRtcCA9IG5ldyBkaWZmX21hdGNoX3BhdGNoKCk7XHJcblxyXG4gICAgLy8gQ29tcHV0ZSB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiBsb2NhbCBhbmQgcmVtb3RlIGNvbnRlbnRcclxuICAgIGNvbnN0IGRpZmZzID0gZG1wLmRpZmZfbWFpbihsb2NhbExpbmVzLmpvaW4oXCJcXG5cIiksIHJlbW90ZUxpbmVzLmpvaW4oXCJcXG5cIikpO1xyXG4gICAgZG1wLmRpZmZfY2xlYW51cFNlbWFudGljKGRpZmZzKTtcclxuXHJcbiAgICAvLyBJbml0aWFsaXplIG1lcmdlZExpbmVzIHdpdGggbG9jYWxMaW5lc1xyXG4gICAgY29uc3QgbWVyZ2VkTGluZXMgPSBbLi4ubG9jYWxMaW5lc107XHJcblxyXG4gICAgLy8gSXRlcmF0ZSBvdmVyIHRoZSBkaWZmc1xyXG4gICAgZm9yIChjb25zdCBbb3BlcmF0aW9uLCB0ZXh0XSBvZiBkaWZmcykge1xyXG4gICAgICAvLyBJZiB0aGUgb3BlcmF0aW9uIGlzIGFuIGluc2VydGlvbiwgaW5zZXJ0IHRoZSBsaW5lcyBhdCB0aGUgY29ycmVjdCBwb3NpdGlvblxyXG4gICAgICBpZiAob3BlcmF0aW9uID09PSBkaWZmX21hdGNoX3BhdGNoLkRJRkZfSU5TRVJUKSB7XHJcbiAgICAgICAgY29uc3QgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpO1xyXG4gICAgICAgIGxpbmVzLnBvcCgpOyAvLyBSZW1vdmUgdGhlIGxhc3QgZWxlbWVudCwgd2hpY2ggaXMgYWx3YXlzIGFuIGVtcHR5IHN0cmluZ1xyXG4gICAgICAgIGNvbnN0IGluZGV4ID0gbWVyZ2VkTGluZXMuaW5kZXhPZihsb2NhbExpbmVzWzBdKTtcclxuICAgICAgICBtZXJnZWRMaW5lcy5zcGxpY2UoaW5kZXgsIDAsIC4uLmxpbmVzKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgY29uc3QgbWVyZ2VkQnVmZmVyID0gQnVmZmVyLmZyb20obWVyZ2VkTGluZXMuam9pbihcIlxcblwiKSk7XHJcbiAgICAvLyBTdGFydCB3cml0aW5nIHRoZSBtZXJnZWQgYnVmZmVyIHRvIGxvY2FsIGFuZCByZW1vdGUgZmlsZXMgYXQgdGhlIHNhbWUgdGltZVxyXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xyXG4gICAgICB0aGlzLmxvY2FsLndyaXRlRmlsZShmaWxlLCBtZXJnZWRCdWZmZXIpLFxyXG4gICAgICB0aGlzLnJlbW90ZS53cml0ZUZpbGUoZmlsZSwgbWVyZ2VkQnVmZmVyKSxcclxuICAgIF0pO1xyXG4gIH1cclxufVxyXG4iXX0=