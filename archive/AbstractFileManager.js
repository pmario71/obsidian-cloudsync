import { __awaiter } from "tslib";
export var SyncState;
(function (SyncState) {
    SyncState[SyncState["Offline"] = 0] = "Offline";
    SyncState[SyncState["Ready"] = 1] = "Ready";
    SyncState[SyncState["Syncing"] = 2] = "Syncing";
    SyncState[SyncState["Error"] = 3] = "Error";
    // Add other states here as needed.
})(SyncState || (SyncState = {}));
export class FileManager {
    constructor() {
        this.files = [];
        this.lastSync = null;
        this.state = SyncState.Offline;
    }
    isOnline(endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            const controller = new AbortController();
            const timeout = setTimeout(() => {
                controller.abort();
            }, 1000); // Set timeout to 1 second.
            try {
                const response = yield fetch(endpoint, {
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                return true;
            }
            catch (_a) {
                clearTimeout(timeout);
                return false;
            }
        });
    }
    // Method to get the list of files
    getFiles() {
        return Promise.resolve(this.files);
    }
    // Method to set or update the last sync date
    setLastSync(date) {
        this.lastSync = date;
    }
    // Method to get the last sync date
    getLastSync() {
        return this.lastSync;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWJzdHJhY3RGaWxlTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkFic3RyYWN0RmlsZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUVBLE1BQU0sQ0FBTixJQUFZLFNBTVg7QUFORCxXQUFZLFNBQVM7SUFDbkIsK0NBQU8sQ0FBQTtJQUNQLDJDQUFLLENBQUE7SUFDTCwrQ0FBTyxDQUFBO0lBQ1AsMkNBQUssQ0FBQTtJQUNMLG1DQUFtQztBQUNyQyxDQUFDLEVBTlcsU0FBUyxLQUFULFNBQVMsUUFNcEI7QUFFRCxNQUFNLE9BQWdCLFdBQVc7SUFLL0I7UUFDRSxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztRQUNoQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztRQUNyQixJQUFJLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUM7SUFDakMsQ0FBQztJQUVLLFFBQVEsQ0FBQyxRQUFnQjs7WUFDN0IsTUFBTSxVQUFVLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUN6QyxNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFO2dCQUM5QixVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDckIsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsMkJBQTJCO1lBRXJDLElBQUksQ0FBQztnQkFDSCxNQUFNLFFBQVEsR0FBRyxNQUFNLEtBQUssQ0FBQyxRQUFRLEVBQUU7b0JBQ3JDLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTTtpQkFDMUIsQ0FBQyxDQUFDO2dCQUNILFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDdEIsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDO1lBQUMsV0FBTSxDQUFDO2dCQUNQLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDdEIsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1FBQ0gsQ0FBQztLQUFBO0lBS0Qsa0NBQWtDO0lBQzNCLFFBQVE7UUFDYixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCw2Q0FBNkM7SUFDdEMsV0FBVyxDQUFDLElBQVU7UUFDM0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDdkIsQ0FBQztJQUVELG1DQUFtQztJQUM1QixXQUFXO1FBQ2hCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN2QixDQUFDO0NBTUYiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBGaWxlIH0gZnJvbSBcIi4vU3luY2hyb25pemVcIjtcclxuXHJcbmV4cG9ydCBlbnVtIFN5bmNTdGF0ZSB7XHJcbiAgT2ZmbGluZSxcclxuICBSZWFkeSxcclxuICBTeW5jaW5nLFxyXG4gIEVycm9yLFxyXG4gIC8vIEFkZCBvdGhlciBzdGF0ZXMgaGVyZSBhcyBuZWVkZWQuXHJcbn1cclxuXHJcbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBGaWxlTWFuYWdlciB7XHJcbiAgcHVibGljIGZpbGVzOiBGaWxlW107XHJcbiAgcHVibGljIGxhc3RTeW5jOiBEYXRlIHwgbnVsbDtcclxuICBwdWJsaWMgc3RhdGU6IFN5bmNTdGF0ZTtcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLmZpbGVzID0gW107XHJcbiAgICB0aGlzLmxhc3RTeW5jID0gbnVsbDtcclxuICAgIHRoaXMuc3RhdGUgPSBTeW5jU3RhdGUuT2ZmbGluZTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGlzT25saW5lKGVuZHBvaW50OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XHJcbiAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcclxuICAgIH0sIDEwMDApOyAvLyBTZXQgdGltZW91dCB0byAxIHNlY29uZC5cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGVuZHBvaW50LCB7XHJcbiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcclxuICAgICAgfSk7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBNZXRob2QgdG8gYXV0aGVudGljYXRlXHJcbiAgcHVibGljIGFic3RyYWN0IGF1dGhlbnRpY2F0ZSgpOiB2b2lkO1xyXG5cclxuICAvLyBNZXRob2QgdG8gZ2V0IHRoZSBsaXN0IG9mIGZpbGVzXHJcbiAgcHVibGljIGdldEZpbGVzKCk6IFByb21pc2U8RmlsZVtdPiB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuZmlsZXMpO1xyXG4gIH1cclxuXHJcbiAgLy8gTWV0aG9kIHRvIHNldCBvciB1cGRhdGUgdGhlIGxhc3Qgc3luYyBkYXRlXHJcbiAgcHVibGljIHNldExhc3RTeW5jKGRhdGU6IERhdGUpOiB2b2lkIHtcclxuICAgIHRoaXMubGFzdFN5bmMgPSBkYXRlO1xyXG4gIH1cclxuXHJcbiAgLy8gTWV0aG9kIHRvIGdldCB0aGUgbGFzdCBzeW5jIGRhdGVcclxuICBwdWJsaWMgZ2V0TGFzdFN5bmMoKTogRGF0ZSB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMubGFzdFN5bmM7XHJcbiAgfVxyXG5cclxuICAvLyBBYnN0cmFjdCBtZXRob2RzIGZvciBmaWxlIG9wZXJhdGlvbnMgLSB0byBiZSBpbXBsZW1lbnRlZCBpbiBkZXJpdmVkIGNsYXNzZXNcclxuICBhYnN0cmFjdCByZWFkRmlsZShmaWxlOiBGaWxlKTogUHJvbWlzZTxCdWZmZXI+OyAvLyBBc3N1bWluZyByZWFkIHJldHVybnMgZmlsZSBjb250ZW50IGFzIGEgc3RyaW5nXHJcbiAgYWJzdHJhY3Qgd3JpdGVGaWxlKGZpbGU6IEZpbGUsIGNvbnRlbnQ6IEJ1ZmZlcik6IFByb21pc2U8dm9pZD47IC8vIFdyaXRlIGZpbGUgY29udGVudFxyXG4gIGFic3RyYWN0IGRlbGV0ZUZpbGUoZmlsZTogRmlsZSk6IFByb21pc2U8dm9pZD47XHJcbn1cclxuIl19