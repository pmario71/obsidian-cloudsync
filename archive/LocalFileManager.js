import { __awaiter } from "tslib";
import { utimes, mkdir } from "fs";
import * as path from "path";
import { createHash } from "crypto";
import * as mimeTypes from "mime-types";
import { FileManager } from "./AbstractFileManager";
import { readFileAsync, writeFileAsync, unlinkAsync, readdirAsync, statAsync, } from "./CloudSyncMain";
import { promisify } from "util";
export class LocalFileManager extends FileManager {
    constructor(directory, ignoreList) {
        super();
        this.hashCache = {};
        this.directory = directory;
        this.ignoreList = ignoreList;
    }
    getFileHashAndMimeType(filePath, stats) {
        return __awaiter(this, void 0, void 0, function* () {
            const cached = this.hashCache[filePath];
            if (cached && stats.mtime <= cached.mtime) {
                // If the file is in the cache and hasn't been modified, return the cached hash, MIME type, and size
                return {
                    hash: cached.hash,
                    mimeType: cached.mimeType,
                    size: cached.size,
                };
            }
            else {
                // If the file is not in the cache or has been modified, calculate the hash and MIME type, and get the size
                const content = yield readFileAsync(filePath);
                const hash = createHash("md5").update(content).digest("hex");
                const mimeType = mimeTypes.lookup(filePath) || "unknown";
                const size = stats.size;
                // Update the cache
                this.hashCache[filePath] = { hash, mtime: stats.mtime, mimeType, size };
                return { hash, mimeType, size };
            }
        });
    }
    authenticate() {
        return Promise.resolve();
    }
    readFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield readFileAsync(file.localName);
            return content;
        });
    }
    writeFile(file, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const utimesAsync = promisify(utimes);
            const mkdirAsync = promisify(mkdir);
            const filePath = path.join(this.directory, file.name);
            const dir = path.dirname(filePath);
            yield mkdirAsync(dir, { recursive: true });
            yield writeFileAsync(filePath, content);
            yield utimesAsync(filePath, Date.now() / 1000, file.lastModified.getTime() / 1000);
        });
    }
    deleteFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = path.join(this.directory, file.name);
            yield unlinkAsync(filePath);
        });
    }
    getFiles() {
        return __awaiter(this, arguments, void 0, function* (directory = this.directory) {
            const ignoreList = this.ignoreList.split(',').map(item => item.trim());
            if (!ignoreList.includes('.cloudsync.json')) {
                ignoreList.push('.cloudsync.json');
            }
            if (ignoreList.includes(path.basename(directory))) {
                return [];
            }
            const fileNames = yield readdirAsync(directory);
            const files = yield Promise.all(fileNames.map((name) => __awaiter(this, void 0, void 0, function* () {
                if (ignoreList.includes(name)) {
                    return [];
                }
                const filePath = path.join(directory, name);
                const stats = yield statAsync(filePath);
                if (stats.isDirectory()) {
                    // If it's a directory, recursively get the files in the directory
                    return this.getFiles(filePath);
                }
                else {
                    // If it's a file, read it and compute its MD5 hash
                    const { hash, mimeType, size } = yield this.getFileHashAndMimeType(filePath, stats);
                    // Create a cloud storage friendly name
                    const cloudPath = encodeURIComponent(path.relative(this.directory, filePath).replace(/\\/g, "/"));
                    return {
                        name: path.relative(this.directory, filePath).replace(/\\/g, "/"),
                        localName: filePath,
                        remoteName: cloudPath,
                        mime: mimeType,
                        size: size,
                        md5: hash,
                        lastModified: stats.mtime,
                        isDirectory: stats.isDirectory(),
                    };
                }
            })));
            // Flatten the array of files and directories
            this.files = files.flat();
            this.files = this.files.filter((file) => !file.isDirectory);
            return this.files;
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTG9jYWxGaWxlTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkxvY2FsRmlsZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNBLE9BQU8sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ25DLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDcEMsT0FBTyxLQUFLLFNBQVMsTUFBTSxZQUFZLENBQUM7QUFFeEMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ3BELE9BQU8sRUFDTCxhQUFhLEVBQ2IsY0FBYyxFQUNkLFdBQVcsRUFDWCxZQUFZLEVBQ1osU0FBUyxHQUNWLE1BQU0saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUVqQyxNQUFNLE9BQU8sZ0JBQWlCLFNBQVEsV0FBVztJQVkvQyxZQUFZLFNBQWlCLEVBQUUsVUFBa0I7UUFDL0MsS0FBSyxFQUFFLENBQUM7UUFWRixjQUFTLEdBT2IsRUFBRSxDQUFDO1FBSUwsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUE7SUFFOUIsQ0FBQztJQUVhLHNCQUFzQixDQUNsQyxRQUFnQixFQUNoQixLQUFlOztZQUVmLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDeEMsSUFBSSxNQUFNLElBQUksS0FBSyxDQUFDLEtBQUssSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQzFDLG9HQUFvRztnQkFDcEcsT0FBTztvQkFDTCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7b0JBQ2pCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtvQkFDekIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO2lCQUNsQixDQUFDO1lBQ0osQ0FBQztpQkFBTSxDQUFDO2dCQUNOLDJHQUEyRztnQkFDM0csTUFBTSxPQUFPLEdBQUcsTUFBTSxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzlDLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM3RCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFNBQVMsQ0FBQztnQkFDekQsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztnQkFFeEIsbUJBQW1CO2dCQUNuQixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztnQkFFeEUsT0FBTyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7WUFDbEMsQ0FBQztRQUNILENBQUM7S0FBQTtJQUVNLFlBQVk7UUFDakIsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDM0IsQ0FBQztJQUVZLFFBQVEsQ0FBQyxJQUFVOztZQUM5QixNQUFNLE9BQU8sR0FBRyxNQUFNLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDcEQsT0FBTyxPQUFPLENBQUM7UUFDakIsQ0FBQztLQUFBO0lBRVksU0FBUyxDQUFDLElBQVUsRUFBRSxPQUFlOztZQUNoRCxNQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdEMsTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFdEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNuQyxNQUFNLFVBQVUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUUzQyxNQUFNLGNBQWMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDeEMsTUFBTSxXQUFXLENBQ2YsUUFBUSxFQUNSLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLEVBQ2pCLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUNuQyxDQUFDO1FBQ0osQ0FBQztLQUFBO0lBRVksVUFBVSxDQUFDLElBQVU7O1lBQ2hDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEQsTUFBTSxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDOUIsQ0FBQztLQUFBO0lBRVksUUFBUTs2REFBQyxZQUFvQixJQUFJLENBQUMsU0FBUztZQUN0RCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN2RSxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUM7Z0JBQzVDLFVBQVUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNyQyxDQUFDO1lBRUQsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUNsRCxPQUFPLEVBQUUsQ0FBQztZQUNaLENBQUM7WUFDRCxNQUFNLFNBQVMsR0FBRyxNQUFNLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNoRCxNQUFNLEtBQUssR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQzdCLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBTyxJQUFJLEVBQUUsRUFBRTtnQkFDM0IsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQzlCLE9BQU8sRUFBRSxDQUFDO2dCQUNaLENBQUM7Z0JBQ0QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzVDLE1BQU0sS0FBSyxHQUFHLE1BQU0sU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUV4QyxJQUFJLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO29CQUN4QixrRUFBa0U7b0JBQ2xFLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDakMsQ0FBQztxQkFBTSxDQUFDO29CQUNOLG1EQUFtRDtvQkFDbkQsTUFBTSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQ2hFLFFBQVEsRUFDUixLQUFLLENBQ04sQ0FBQztvQkFFRix1Q0FBdUM7b0JBQ3ZDLE1BQU0sU0FBUyxHQUFHLGtCQUFrQixDQUNsQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FDNUQsQ0FBQztvQkFFRixPQUFPO3dCQUNMLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUM7d0JBQ2pFLFNBQVMsRUFBRSxRQUFRO3dCQUNuQixVQUFVLEVBQUUsU0FBUzt3QkFDckIsSUFBSSxFQUFFLFFBQVE7d0JBQ2QsSUFBSSxFQUFFLElBQUk7d0JBQ1YsR0FBRyxFQUFFLElBQUk7d0JBQ1QsWUFBWSxFQUFFLEtBQUssQ0FBQyxLQUFLO3dCQUN6QixXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRTtxQkFDakMsQ0FBQztnQkFDSixDQUFDO1lBQ0gsQ0FBQyxDQUFBLENBQUMsQ0FDSCxDQUFDO1lBRUYsNkNBQTZDO1lBQzdDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzFCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBRTVELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztRQUNwQixDQUFDO0tBQUE7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgeyB1dGltZXMsIG1rZGlyIH0gZnJvbSBcImZzXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gXCJjcnlwdG9cIjtcclxuaW1wb3J0ICogYXMgbWltZVR5cGVzIGZyb20gXCJtaW1lLXR5cGVzXCI7XHJcbmltcG9ydCB7IEZpbGUgfSBmcm9tIFwiLi9TeW5jaHJvbml6ZVwiO1xyXG5pbXBvcnQgeyBGaWxlTWFuYWdlciB9IGZyb20gXCIuL0Fic3RyYWN0RmlsZU1hbmFnZXJcIjtcclxuaW1wb3J0IHtcclxuICByZWFkRmlsZUFzeW5jLFxyXG4gIHdyaXRlRmlsZUFzeW5jLFxyXG4gIHVubGlua0FzeW5jLFxyXG4gIHJlYWRkaXJBc3luYyxcclxuICBzdGF0QXN5bmMsXHJcbn0gZnJvbSBcIi4vQ2xvdWRTeW5jTWFpblwiO1xyXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwidXRpbFwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIExvY2FsRmlsZU1hbmFnZXIgZXh0ZW5kcyBGaWxlTWFuYWdlciB7XHJcbiAgcHVibGljIGRpcmVjdG9yeTogc3RyaW5nO1xyXG4gIHByaXZhdGUgaWdub3JlTGlzdDogc3RyaW5nO1xyXG4gIHByaXZhdGUgaGFzaENhY2hlOiB7XHJcbiAgICBbZmlsZVBhdGg6IHN0cmluZ106IHtcclxuICAgICAgaGFzaDogc3RyaW5nO1xyXG4gICAgICBtdGltZTogRGF0ZTtcclxuICAgICAgbWltZVR5cGU6IHN0cmluZztcclxuICAgICAgc2l6ZTogbnVtYmVyO1xyXG4gICAgfTtcclxuICB9ID0ge307XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRpcmVjdG9yeTogc3RyaW5nLCBpZ25vcmVMaXN0OiBzdHJpbmcpIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICB0aGlzLmRpcmVjdG9yeSA9IGRpcmVjdG9yeTtcclxuICAgIHRoaXMuaWdub3JlTGlzdCA9IGlnbm9yZUxpc3RcclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGdldEZpbGVIYXNoQW5kTWltZVR5cGUoXHJcbiAgICBmaWxlUGF0aDogc3RyaW5nLFxyXG4gICAgc3RhdHM6IGZzLlN0YXRzXHJcbiAgKTogUHJvbWlzZTx7IGhhc2g6IHN0cmluZzsgbWltZVR5cGU6IHN0cmluZzsgc2l6ZTogbnVtYmVyIH0+IHtcclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuaGFzaENhY2hlW2ZpbGVQYXRoXTtcclxuICAgIGlmIChjYWNoZWQgJiYgc3RhdHMubXRpbWUgPD0gY2FjaGVkLm10aW1lKSB7XHJcbiAgICAgIC8vIElmIHRoZSBmaWxlIGlzIGluIHRoZSBjYWNoZSBhbmQgaGFzbid0IGJlZW4gbW9kaWZpZWQsIHJldHVybiB0aGUgY2FjaGVkIGhhc2gsIE1JTUUgdHlwZSwgYW5kIHNpemVcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBoYXNoOiBjYWNoZWQuaGFzaCxcclxuICAgICAgICBtaW1lVHlwZTogY2FjaGVkLm1pbWVUeXBlLFxyXG4gICAgICAgIHNpemU6IGNhY2hlZC5zaXplLFxyXG4gICAgICB9O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gSWYgdGhlIGZpbGUgaXMgbm90IGluIHRoZSBjYWNoZSBvciBoYXMgYmVlbiBtb2RpZmllZCwgY2FsY3VsYXRlIHRoZSBoYXNoIGFuZCBNSU1FIHR5cGUsIGFuZCBnZXQgdGhlIHNpemVcclxuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMoZmlsZVBhdGgpO1xyXG4gICAgICBjb25zdCBoYXNoID0gY3JlYXRlSGFzaChcIm1kNVwiKS51cGRhdGUoY29udGVudCkuZGlnZXN0KFwiaGV4XCIpO1xyXG4gICAgICBjb25zdCBtaW1lVHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpIHx8IFwidW5rbm93blwiO1xyXG4gICAgICBjb25zdCBzaXplID0gc3RhdHMuc2l6ZTtcclxuXHJcbiAgICAgIC8vIFVwZGF0ZSB0aGUgY2FjaGVcclxuICAgICAgdGhpcy5oYXNoQ2FjaGVbZmlsZVBhdGhdID0geyBoYXNoLCBtdGltZTogc3RhdHMubXRpbWUsIG1pbWVUeXBlLCBzaXplIH07XHJcblxyXG4gICAgICByZXR1cm4geyBoYXNoLCBtaW1lVHlwZSwgc2l6ZSB9O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIGF1dGhlbnRpY2F0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyByZWFkRmlsZShmaWxlOiBGaWxlKTogUHJvbWlzZTxCdWZmZXI+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzeW5jKGZpbGUubG9jYWxOYW1lKTtcclxuICAgIHJldHVybiBjb250ZW50O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIHdyaXRlRmlsZShmaWxlOiBGaWxlLCBjb250ZW50OiBCdWZmZXIpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHV0aW1lc0FzeW5jID0gcHJvbWlzaWZ5KHV0aW1lcyk7XHJcbiAgICBjb25zdCBta2RpckFzeW5jID0gcHJvbWlzaWZ5KG1rZGlyKTtcclxuICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCBmaWxlLm5hbWUpO1xyXG5cclxuICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShmaWxlUGF0aCk7XHJcbiAgICBhd2FpdCBta2RpckFzeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XHJcblxyXG4gICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoZmlsZVBhdGgsIGNvbnRlbnQpO1xyXG4gICAgYXdhaXQgdXRpbWVzQXN5bmMoXHJcbiAgICAgIGZpbGVQYXRoLFxyXG4gICAgICBEYXRlLm5vdygpIC8gMTAwMCxcclxuICAgICAgZmlsZS5sYXN0TW9kaWZpZWQuZ2V0VGltZSgpIC8gMTAwMFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBkZWxldGVGaWxlKGZpbGU6IEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCBmaWxlLm5hbWUpO1xyXG4gICAgYXdhaXQgdW5saW5rQXN5bmMoZmlsZVBhdGgpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGdldEZpbGVzKGRpcmVjdG9yeTogc3RyaW5nID0gdGhpcy5kaXJlY3RvcnkpOiBQcm9taXNlPEZpbGVbXT4ge1xyXG4gICAgY29uc3QgaWdub3JlTGlzdCA9IHRoaXMuaWdub3JlTGlzdC5zcGxpdCgnLCcpLm1hcChpdGVtID0+IGl0ZW0udHJpbSgpKTtcclxuICAgIGlmICghaWdub3JlTGlzdC5pbmNsdWRlcygnLmNsb3Vkc3luYy5qc29uJykpIHtcclxuICAgICAgaWdub3JlTGlzdC5wdXNoKCcuY2xvdWRzeW5jLmpzb24nKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaWdub3JlTGlzdC5pbmNsdWRlcyhwYXRoLmJhc2VuYW1lKGRpcmVjdG9yeSkpKSB7XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuICAgIGNvbnN0IGZpbGVOYW1lcyA9IGF3YWl0IHJlYWRkaXJBc3luYyhkaXJlY3RvcnkpO1xyXG4gICAgY29uc3QgZmlsZXMgPSBhd2FpdCBQcm9taXNlLmFsbChcclxuICAgICAgZmlsZU5hbWVzLm1hcChhc3luYyAobmFtZSkgPT4ge1xyXG4gICAgICAgIGlmIChpZ25vcmVMaXN0LmluY2x1ZGVzKG5hbWUpKSB7XHJcbiAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKGRpcmVjdG9yeSwgbmFtZSk7XHJcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBzdGF0QXN5bmMoZmlsZVBhdGgpO1xyXG5cclxuICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xyXG4gICAgICAgICAgLy8gSWYgaXQncyBhIGRpcmVjdG9yeSwgcmVjdXJzaXZlbHkgZ2V0IHRoZSBmaWxlcyBpbiB0aGUgZGlyZWN0b3J5XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRGaWxlcyhmaWxlUGF0aCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIC8vIElmIGl0J3MgYSBmaWxlLCByZWFkIGl0IGFuZCBjb21wdXRlIGl0cyBNRDUgaGFzaFxyXG4gICAgICAgICAgY29uc3QgeyBoYXNoLCBtaW1lVHlwZSwgc2l6ZSB9ID0gYXdhaXQgdGhpcy5nZXRGaWxlSGFzaEFuZE1pbWVUeXBlKFxyXG4gICAgICAgICAgICBmaWxlUGF0aCxcclxuICAgICAgICAgICAgc3RhdHNcclxuICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgLy8gQ3JlYXRlIGEgY2xvdWQgc3RvcmFnZSBmcmllbmRseSBuYW1lXHJcbiAgICAgICAgICBjb25zdCBjbG91ZFBhdGggPSBlbmNvZGVVUklDb21wb25lbnQoXHJcbiAgICAgICAgICAgIHBhdGgucmVsYXRpdmUodGhpcy5kaXJlY3RvcnksIGZpbGVQYXRoKS5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKVxyXG4gICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBuYW1lOiBwYXRoLnJlbGF0aXZlKHRoaXMuZGlyZWN0b3J5LCBmaWxlUGF0aCkucmVwbGFjZSgvXFxcXC9nLCBcIi9cIiksXHJcbiAgICAgICAgICAgIGxvY2FsTmFtZTogZmlsZVBhdGgsXHJcbiAgICAgICAgICAgIHJlbW90ZU5hbWU6IGNsb3VkUGF0aCxcclxuICAgICAgICAgICAgbWltZTogbWltZVR5cGUsXHJcbiAgICAgICAgICAgIHNpemU6IHNpemUsXHJcbiAgICAgICAgICAgIG1kNTogaGFzaCxcclxuICAgICAgICAgICAgbGFzdE1vZGlmaWVkOiBzdGF0cy5tdGltZSxcclxuICAgICAgICAgICAgaXNEaXJlY3Rvcnk6IHN0YXRzLmlzRGlyZWN0b3J5KCksXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgLy8gRmxhdHRlbiB0aGUgYXJyYXkgb2YgZmlsZXMgYW5kIGRpcmVjdG9yaWVzXHJcbiAgICB0aGlzLmZpbGVzID0gZmlsZXMuZmxhdCgpO1xyXG4gICAgdGhpcy5maWxlcyA9IHRoaXMuZmlsZXMuZmlsdGVyKChmaWxlKSA9PiAhZmlsZS5pc0RpcmVjdG9yeSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuZmlsZXM7XHJcbiAgfVxyXG59XHJcbiJdfQ==