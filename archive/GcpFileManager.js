import { __awaiter } from "tslib";
import { GoogleAuth } from "google-auth-library";
import { FileManager } from "./AbstractFileManager";
import fetch from "node-fetch";
import * as xml2js from "xml2js";
export class GCPFileManager extends FileManager {
    constructor(privatekey, clientemail, bucketname) {
        super();
        this.accessToken = "";
        this.privateKey = privatekey.replace(/\\n/g, "\n");
        this.clientEmail = clientemail;
        this.bucketName = bucketname;
        this.authPromise = this.authenticate();
    }
    isOnline() {
        return Promise.resolve(false);
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const auth = new GoogleAuth({
                credentials: {
                    client_email: this.clientEmail,
                    private_key: this.privateKey,
                },
                scopes: ["https://www.googleapis.com/auth/devstorage.full_control"],
            });
            const client = yield auth.getClient();
            const response = yield client.getAccessToken();
            this.accessToken = (_a = response.token) !== null && _a !== void 0 ? _a : "";
        });
    }
    path(file) {
        return encodeURIComponent(file.name);
    }
    readFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = encodeURIComponent(file.remoteName);
            const url = `https://${this.bucketName}.storage.googleapis.com/${fileName}`;
            yield this.authPromise;
            const response = yield fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            });
            const arrayBuffer = yield response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        });
    }
    writeFile(file, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = encodeURIComponent(file.name);
            const url = `https://${this.bucketName}.storage.googleapis.com/${fileName}`;
            yield this.authPromise;
            yield fetch(url, {
                method: "PUT",
                body: content,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    "Content-Type": file.mime,
                },
            });
        });
    }
    deleteFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = encodeURIComponent(file.remoteName);
            const url = `https://${this.bucketName}.storage.googleapis.com/${fileName}`;
            yield this.authPromise;
            yield fetch(url, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            });
        });
    }
    getFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://${this.bucketName}.storage.googleapis.com`;
            yield this.authPromise;
            const response = yield fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            });
            const data = yield response.text();
            const result = yield xml2js.parseStringPromise(data);
            const items = result.ListBucketResult.Contents;
            if (!items || items.length === 0) {
                return [];
            }
            return items.map((item) => {
                const key = item.Key[0];
                const lastModified = new Date(item.LastModified[0]);
                const eTag = item.ETag[0];
                const size = Number(item.Size[0]);
                return {
                    name: decodeURIComponent(key),
                    localName: "",
                    remoteName: key,
                    mime: "", // MIME type is not provided in the XML API response
                    lastModified: lastModified,
                    size: size,
                    md5: eTag.replace(/"/g, ""), // Remove quotes from ETag
                    isDirectory: false,
                    url: `https://${this.bucketName}.storage.googleapis.com/${encodeURIComponent(key)}`,
                };
            });
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2NwRmlsZU1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJHY3BGaWxlTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRWpELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNwRCxPQUFPLEtBQUssTUFBTSxZQUFZLENBQUM7QUFDL0IsT0FBTyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFakMsTUFBTSxPQUFPLGNBQWUsU0FBUSxXQUFXO0lBTzdDLFlBQVksVUFBa0IsRUFBRSxXQUFtQixFQUFFLFVBQWtCO1FBQ3JFLEtBQUssRUFBRSxDQUFDO1FBSkYsZ0JBQVcsR0FBVyxFQUFFLENBQUM7UUFLL0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN6QyxDQUFDO0lBRUQsUUFBUTtRQUNOLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRVksWUFBWTs7O1lBQ3ZCLE1BQU0sSUFBSSxHQUFHLElBQUksVUFBVSxDQUFDO2dCQUMxQixXQUFXLEVBQUU7b0JBQ1gsWUFBWSxFQUFFLElBQUksQ0FBQyxXQUFXO29CQUM5QixXQUFXLEVBQUUsSUFBSSxDQUFDLFVBQVU7aUJBQzdCO2dCQUNELE1BQU0sRUFBRSxDQUFDLHlEQUF5RCxDQUFDO2FBQ3BFLENBQUMsQ0FBQztZQUNILE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQy9DLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBQSxRQUFRLENBQUMsS0FBSyxtQ0FBSSxFQUFFLENBQUM7UUFDMUMsQ0FBQztLQUFBO0lBRU0sSUFBSSxDQUFDLElBQVU7UUFDcEIsT0FBTyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVLLFFBQVEsQ0FBQyxJQUFVOztZQUN2QixNQUFNLFFBQVEsR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDckQsTUFBTSxHQUFHLEdBQUcsV0FBVyxJQUFJLENBQUMsVUFBVSwyQkFBMkIsUUFBUSxFQUFFLENBQUM7WUFDNUUsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDO1lBQ3ZCLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsRUFBRTtnQkFDaEMsT0FBTyxFQUFFO29CQUNQLGFBQWEsRUFBRSxVQUFVLElBQUksQ0FBQyxXQUFXLEVBQUU7aUJBQzVDO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsTUFBTSxXQUFXLEdBQUcsTUFBTSxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDakQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7S0FBQTtJQUVLLFNBQVMsQ0FBQyxJQUFVLEVBQUUsT0FBZTs7WUFDekMsTUFBTSxRQUFRLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQy9DLE1BQU0sR0FBRyxHQUFHLFdBQVcsSUFBSSxDQUFDLFVBQVUsMkJBQTJCLFFBQVEsRUFBRSxDQUFDO1lBQzVFLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUN2QixNQUFNLEtBQUssQ0FBQyxHQUFHLEVBQUU7Z0JBQ2YsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsSUFBSSxFQUFFLE9BQU87Z0JBQ2IsT0FBTyxFQUFFO29CQUNQLGFBQWEsRUFBRSxVQUFVLElBQUksQ0FBQyxXQUFXLEVBQUU7b0JBQzNDLGNBQWMsRUFBRSxJQUFJLENBQUMsSUFBSTtpQkFDMUI7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDO0tBQUE7SUFFSyxVQUFVLENBQUMsSUFBVTs7WUFDekIsTUFBTSxRQUFRLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3JELE1BQU0sR0FBRyxHQUFHLFdBQVcsSUFBSSxDQUFDLFVBQVUsMkJBQTJCLFFBQVEsRUFBRSxDQUFDO1lBQzVFLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUN2QixNQUFNLEtBQUssQ0FBQyxHQUFHLEVBQUU7Z0JBQ2YsTUFBTSxFQUFFLFFBQVE7Z0JBQ2hCLE9BQU8sRUFBRTtvQkFDUCxhQUFhLEVBQUUsVUFBVSxJQUFJLENBQUMsV0FBVyxFQUFFO2lCQUM1QzthQUNGLENBQUMsQ0FBQztRQUNMLENBQUM7S0FBQTtJQUVZLFFBQVE7O1lBQ25CLE1BQU0sR0FBRyxHQUFHLFdBQVcsSUFBSSxDQUFDLFVBQVUseUJBQXlCLENBQUM7WUFDaEUsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDO1lBQ3ZCLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsRUFBRTtnQkFDaEMsT0FBTyxFQUFFO29CQUNQLGFBQWEsRUFBRSxVQUFVLElBQUksQ0FBQyxXQUFXLEVBQUU7aUJBQzVDO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsTUFBTSxJQUFJLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbkMsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQztZQUUvQyxJQUFJLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ2pDLE9BQU8sRUFBRSxDQUFDO1lBQ1osQ0FBQztZQUVELE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO2dCQUM3QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN4QixNQUFNLFlBQVksR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRWxDLE9BQU87b0JBQ0wsSUFBSSxFQUFFLGtCQUFrQixDQUFDLEdBQUcsQ0FBQztvQkFDN0IsU0FBUyxFQUFFLEVBQUU7b0JBQ2IsVUFBVSxFQUFFLEdBQUc7b0JBQ2YsSUFBSSxFQUFFLEVBQUUsRUFBRSxvREFBb0Q7b0JBQzlELFlBQVksRUFBRSxZQUFZO29CQUMxQixJQUFJLEVBQUUsSUFBSTtvQkFDVixHQUFHLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUUsMEJBQTBCO29CQUN2RCxXQUFXLEVBQUUsS0FBSztvQkFDbEIsR0FBRyxFQUFFLFdBQ0gsSUFBSSxDQUFDLFVBQ1AsMkJBQTJCLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFO2lCQUNyRCxDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQUE7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEdvb2dsZUF1dGggfSBmcm9tIFwiZ29vZ2xlLWF1dGgtbGlicmFyeVwiO1xyXG5pbXBvcnQgeyBGaWxlIH0gZnJvbSBcIi4vU3luY2hyb25pemVcIjtcclxuaW1wb3J0IHsgRmlsZU1hbmFnZXIgfSBmcm9tIFwiLi9BYnN0cmFjdEZpbGVNYW5hZ2VyXCI7XHJcbmltcG9ydCBmZXRjaCBmcm9tIFwibm9kZS1mZXRjaFwiO1xyXG5pbXBvcnQgKiBhcyB4bWwyanMgZnJvbSBcInhtbDJqc1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEdDUEZpbGVNYW5hZ2VyIGV4dGVuZHMgRmlsZU1hbmFnZXIge1xyXG4gIHByaXZhdGUgcHJpdmF0ZUtleTogc3RyaW5nO1xyXG4gIHByaXZhdGUgY2xpZW50RW1haWw6IHN0cmluZztcclxuICBwcml2YXRlIGJ1Y2tldE5hbWU6IHN0cmluZztcclxuICBwcml2YXRlIGFjY2Vzc1Rva2VuOiBzdHJpbmcgPSBcIlwiO1xyXG4gIHByaXZhdGUgYXV0aFByb21pc2U6IFByb21pc2U8dm9pZD47XHJcblxyXG4gIGNvbnN0cnVjdG9yKHByaXZhdGVrZXk6IHN0cmluZywgY2xpZW50ZW1haWw6IHN0cmluZywgYnVja2V0bmFtZTogc3RyaW5nKSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5wcml2YXRlS2V5ID0gcHJpdmF0ZWtleS5yZXBsYWNlKC9cXFxcbi9nLCBcIlxcblwiKTtcclxuICAgIHRoaXMuY2xpZW50RW1haWwgPSBjbGllbnRlbWFpbDtcclxuICAgIHRoaXMuYnVja2V0TmFtZSA9IGJ1Y2tldG5hbWU7XHJcbiAgICB0aGlzLmF1dGhQcm9taXNlID0gdGhpcy5hdXRoZW50aWNhdGUoKTtcclxuICB9XHJcblxyXG4gIGlzT25saW5lKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgYXV0aGVudGljYXRlKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXV0aCA9IG5ldyBHb29nbGVBdXRoKHtcclxuICAgICAgY3JlZGVudGlhbHM6IHtcclxuICAgICAgICBjbGllbnRfZW1haWw6IHRoaXMuY2xpZW50RW1haWwsXHJcbiAgICAgICAgcHJpdmF0ZV9rZXk6IHRoaXMucHJpdmF0ZUtleSxcclxuICAgICAgfSxcclxuICAgICAgc2NvcGVzOiBbXCJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL2RldnN0b3JhZ2UuZnVsbF9jb250cm9sXCJdLFxyXG4gICAgfSk7XHJcbiAgICBjb25zdCBjbGllbnQgPSBhd2FpdCBhdXRoLmdldENsaWVudCgpO1xyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjbGllbnQuZ2V0QWNjZXNzVG9rZW4oKTtcclxuICAgIHRoaXMuYWNjZXNzVG9rZW4gPSByZXNwb25zZS50b2tlbiA/PyBcIlwiO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHBhdGgoZmlsZTogRmlsZSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KGZpbGUubmFtZSk7XHJcbiAgfVxyXG5cclxuICBhc3luYyByZWFkRmlsZShmaWxlOiBGaWxlKTogUHJvbWlzZTxCdWZmZXI+IHtcclxuICAgIGNvbnN0IGZpbGVOYW1lID0gZW5jb2RlVVJJQ29tcG9uZW50KGZpbGUucmVtb3RlTmFtZSk7XHJcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMuYnVja2V0TmFtZX0uc3RvcmFnZS5nb29nbGVhcGlzLmNvbS8ke2ZpbGVOYW1lfWA7XHJcbiAgICBhd2FpdCB0aGlzLmF1dGhQcm9taXNlO1xyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLmFjY2Vzc1Rva2VufWAsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBhcnJheUJ1ZmZlciA9IGF3YWl0IHJlc3BvbnNlLmFycmF5QnVmZmVyKCk7XHJcbiAgICByZXR1cm4gQnVmZmVyLmZyb20oYXJyYXlCdWZmZXIpO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgd3JpdGVGaWxlKGZpbGU6IEZpbGUsIGNvbnRlbnQ6IEJ1ZmZlcik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgZmlsZU5hbWUgPSBlbmNvZGVVUklDb21wb25lbnQoZmlsZS5uYW1lKTtcclxuICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5idWNrZXROYW1lfS5zdG9yYWdlLmdvb2dsZWFwaXMuY29tLyR7ZmlsZU5hbWV9YDtcclxuICAgIGF3YWl0IHRoaXMuYXV0aFByb21pc2U7XHJcbiAgICBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgbWV0aG9kOiBcIlBVVFwiLFxyXG4gICAgICBib2R5OiBjb250ZW50LFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMuYWNjZXNzVG9rZW59YCxcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBmaWxlLm1pbWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGFzeW5jIGRlbGV0ZUZpbGUoZmlsZTogRmlsZSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgZmlsZU5hbWUgPSBlbmNvZGVVUklDb21wb25lbnQoZmlsZS5yZW1vdGVOYW1lKTtcclxuICAgIGNvbnN0IHVybCA9IGBodHRwczovLyR7dGhpcy5idWNrZXROYW1lfS5zdG9yYWdlLmdvb2dsZWFwaXMuY29tLyR7ZmlsZU5hbWV9YDtcclxuICAgIGF3YWl0IHRoaXMuYXV0aFByb21pc2U7XHJcbiAgICBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgbWV0aG9kOiBcIkRFTEVURVwiLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMuYWNjZXNzVG9rZW59YCxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGdldEZpbGVzKCk6IFByb21pc2U8RmlsZVtdPiB7XHJcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly8ke3RoaXMuYnVja2V0TmFtZX0uc3RvcmFnZS5nb29nbGVhcGlzLmNvbWA7XHJcbiAgICBhd2FpdCB0aGlzLmF1dGhQcm9taXNlO1xyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLmFjY2Vzc1Rva2VufWAsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgeG1sMmpzLnBhcnNlU3RyaW5nUHJvbWlzZShkYXRhKTtcclxuICAgIGNvbnN0IGl0ZW1zID0gcmVzdWx0Lkxpc3RCdWNrZXRSZXN1bHQuQ29udGVudHM7XHJcblxyXG4gICAgaWYgKCFpdGVtcyB8fCBpdGVtcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBpdGVtcy5tYXAoKGl0ZW06IGFueSkgPT4ge1xyXG4gICAgICBjb25zdCBrZXkgPSBpdGVtLktleVswXTtcclxuICAgICAgY29uc3QgbGFzdE1vZGlmaWVkID0gbmV3IERhdGUoaXRlbS5MYXN0TW9kaWZpZWRbMF0pO1xyXG4gICAgICBjb25zdCBlVGFnID0gaXRlbS5FVGFnWzBdO1xyXG4gICAgICBjb25zdCBzaXplID0gTnVtYmVyKGl0ZW0uU2l6ZVswXSk7XHJcblxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IGRlY29kZVVSSUNvbXBvbmVudChrZXkpLFxyXG4gICAgICAgIGxvY2FsTmFtZTogXCJcIixcclxuICAgICAgICByZW1vdGVOYW1lOiBrZXksXHJcbiAgICAgICAgbWltZTogXCJcIiwgLy8gTUlNRSB0eXBlIGlzIG5vdCBwcm92aWRlZCBpbiB0aGUgWE1MIEFQSSByZXNwb25zZVxyXG4gICAgICAgIGxhc3RNb2RpZmllZDogbGFzdE1vZGlmaWVkLFxyXG4gICAgICAgIHNpemU6IHNpemUsXHJcbiAgICAgICAgbWQ1OiBlVGFnLnJlcGxhY2UoL1wiL2csIFwiXCIpLCAvLyBSZW1vdmUgcXVvdGVzIGZyb20gRVRhZ1xyXG4gICAgICAgIGlzRGlyZWN0b3J5OiBmYWxzZSxcclxuICAgICAgICB1cmw6IGBodHRwczovLyR7XHJcbiAgICAgICAgICB0aGlzLmJ1Y2tldE5hbWVcclxuICAgICAgICB9LnN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vJHtlbmNvZGVVUklDb21wb25lbnQoa2V5KX1gLFxyXG4gICAgICB9O1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==