import { __awaiter } from "tslib";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, } from "@aws-sdk/client-s3";
import { FileManager } from "./AbstractFileManager";
export class S3FileManager extends FileManager {
    constructor(accessKeyId, secretAccessKey, bucketName, region) {
        super();
        this.accessKeyId = accessKeyId;
        this.secretAccessKey = secretAccessKey;
        this.bucketName = bucketName;
        this.region = region;
        this.s3 = new S3Client();
        this.authenticate();
    }
    isOnline() {
        return Promise.resolve(false);
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.s3 = new S3Client({
                    region: this.region,
                    credentials: {
                        accessKeyId: this.accessKeyId,
                        secretAccessKey: this.secretAccessKey,
                    },
                });
            }
            catch (error) {
                console.error("Failed to authenticate:", error);
            }
        });
    }
    path(file) {
        return encodeURIComponent(file.name);
    }
    readFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: file.remoteName,
            });
            const data = yield this.s3.send(command);
            const body = data.Body;
            if (!body) {
                throw new Error("Received unexpected data type from S3");
            }
            if (body instanceof Blob) {
                const arrayBuffer = yield body.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }
            else if (body instanceof ReadableStream) {
                const reader = body.getReader();
                const chunks = [];
                let result;
                while (!(result = yield reader.read()).done) {
                    chunks.push(result.value);
                }
                let totalLength = 0;
                for (const chunk of chunks) {
                    totalLength += chunk.length;
                }
                const combined = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                }
                return Buffer.from(combined);
            }
            else {
                throw new Error("Received unexpected data type from S3");
            }
        });
    }
    writeFile(file, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: file.name,
                Body: content,
                ContentType: file.mime,
                Metadata: {
                    originalLastModified: file.lastModified.toISOString(),
                },
            });
            yield this.s3.send(command);
        });
    }
    deleteFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: file.remoteName,
            });
            yield this.s3.send(command);
        });
    }
    getFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
            });
            const data = (yield this.s3.send(command));
            const files = ((_a = data.Contents) === null || _a === void 0 ? void 0 : _a.map((file) => ({
                name: decodeURIComponent(file.Key),
                localName: "",
                remoteName: file.Key,
                mime: "",
                lastModified: file.LastModified,
                size: file.Size,
                md5: file.ETag.replace(/"/g, ""),
                isDirectory: false,
            }))) || [];
            return files;
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXdzRmlsZU1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJBd3NGaWxlTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUNMLFFBQVEsRUFJUixvQkFBb0IsRUFDcEIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixtQkFBbUIsR0FFcEIsTUFBTSxvQkFBb0IsQ0FBQztBQUc1QixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFcEQsTUFBTSxPQUFPLGFBQWMsU0FBUSxXQUFXO0lBTzVDLFlBQ0UsV0FBbUIsRUFDbkIsZUFBdUIsRUFDdkIsVUFBa0IsRUFDbEIsTUFBYztRQUVkLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkMsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDN0IsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN0QixDQUFDO0lBRUQsUUFBUTtRQUNOLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRVksWUFBWTs7WUFDdkIsSUFBSSxDQUFDO2dCQUNILElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxRQUFRLENBQUM7b0JBQ3JCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtvQkFDbkIsV0FBVyxFQUFFO3dCQUNYLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVzt3QkFDN0IsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlO3FCQUN0QztpQkFDRixDQUFDLENBQUM7WUFDTCxDQUFDO1lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDZixPQUFPLENB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LE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVTtnQkFDdkIsR0FBRyxFQUFFLElBQUksQ0FBQyxVQUFVO2FBQ3JCLENBQUMsQ0FBQztZQUVILE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUIsQ0FBQztLQUFBO0lBRVksUUFBUTs7O1lBQ25CLE1BQU0sT0FBTyxHQUFHLElBQUksb0JBQW9CLENBQUM7Z0JBQ3ZDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVTthQUN4QixDQUFDLENBQUM7WUFFSCxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQStCLENBQUM7WUFDekUsTUFBTSxLQUFLLEdBQ1QsQ0FBQSxNQUFBLElBQUksQ0FBQyxRQUFRLDBDQUFFLEdBQUcsQ0FDaEIsQ0FBQyxJQUtBLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ0wsSUFBSSxFQUFFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxHQUFJLENBQUM7Z0JBQ25DLFNBQVMsRUFBRSxFQUFFO2dCQUNiLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBSTtnQkFDckIsSUFBSSxFQUFFLEVBQUU7Z0JBQ1IsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFhO2dCQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUs7Z0JBQ2hCLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO2dCQUNqQyxXQUFXLEVBQUUsS0FBSzthQUNuQixDQUFDLENBQ0gsS0FBSSxFQUFFLENBQUM7WUFFVixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7S0FBQTtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcclxuICBTM0NsaWVudCxcclxuICBIZWFkQnVja2V0Q29tbWFuZCxcclxuICBDcmVhdGVCdWNrZXRDb21tYW5kLFxyXG4gIFB1dEJ1Y2tldENvcnNDb21tYW5kLFxyXG4gIExpc3RPYmplY3RzVjJDb21tYW5kLFxyXG4gIEdldE9iamVjdENvbW1hbmQsXHJcbiAgUHV0T2JqZWN0Q29tbWFuZCxcclxuICBEZWxldGVPYmplY3RDb21tYW5kLFxyXG4gIExpc3RPYmplY3RzVjJDb21tYW5kT3V0cHV0LFxyXG59IGZyb20gXCJAYXdzLXNkay9jbGllbnQtczNcIjtcclxuaW1wb3J0IHsgUmVhZGFibGUgfSBmcm9tIFwic3RyZWFtXCI7XHJcbmltcG9ydCB7IEZpbGUgfSBmcm9tIFwiLi9TeW5jaHJvbml6ZVwiO1xyXG5pbXBvcnQgeyBGaWxlTWFuYWdlciB9IGZyb20gXCIuL0Fic3RyYWN0RmlsZU1hbmFnZXJcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBTM0ZpbGVNYW5hZ2VyIGV4dGVuZHMgRmlsZU1hbmFnZXIge1xyXG4gIHByaXZhdGUgczM6IFMzQ2xpZW50O1xyXG4gIHByaXZhdGUgYWNjZXNzS2V5SWQ6IHN0cmluZztcclxuICBwcml2YXRlIHNlY3JldEFjY2Vzc0tleTogc3RyaW5nO1xyXG4gIHByaXZhdGUgYnVja2V0TmFtZTogc3RyaW5nO1xyXG4gIHByaXZhdGUgcmVnaW9uOiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgYWNjZXNzS2V5SWQ6IHN0cmluZyxcclxuICAgIHNlY3JldEFjY2Vzc0tleTogc3RyaW5nLFxyXG4gICAgYnVja2V0TmFtZTogc3RyaW5nLFxyXG4gICAgcmVnaW9uOiBzdHJpbmdcclxuICApIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICB0aGlzLmFjY2Vzc0tleUlkID0gYWNjZXNzS2V5SWQ7XHJcbiAgICB0aGlzLnNlY3JldEFjY2Vzc0tleSA9IHNlY3JldEFjY2Vzc0tleTtcclxuICAgIHRoaXMuYnVja2V0TmFtZSA9IGJ1Y2tldE5hbWU7XHJcbiAgICB0aGlzLnJlZ2lvbiA9IHJlZ2lvbjtcclxuICAgIHRoaXMuczMgPSBuZXcgUzNDbGllbnQoKTtcclxuICAgIHRoaXMuYXV0aGVudGljYXRlKCk7XHJcbiAgfVxyXG5cclxuICBpc09ubGluZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGF1dGhlbnRpY2F0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMuczMgPSBuZXcgUzNDbGllbnQoe1xyXG4gICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXHJcbiAgICAgICAgY3JlZGVudGlhbHM6IHtcclxuICAgICAgICAgIGFjY2Vzc0tleUlkOiB0aGlzLmFjY2Vzc0tleUlkLFxyXG4gICAgICAgICAgc2VjcmV0QWNjZXNzS2V5OiB0aGlzLnNlY3JldEFjY2Vzc0tleSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gYXV0aGVudGljYXRlOlwiLCBlcnJvcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgcGF0aChmaWxlOiBGaWxlKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoZmlsZS5uYW1lKTtcclxuICB9XHJcblxyXG4gIGFzeW5jIHJlYWRGaWxlKGZpbGU6IEZpbGUpOiBQcm9taXNlPEJ1ZmZlcj4ge1xyXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBHZXRPYmplY3RDb21tYW5kKHtcclxuICAgICAgQnVja2V0OiB0aGlzLmJ1Y2tldE5hbWUsXHJcbiAgICAgIEtleTogZmlsZS5yZW1vdGVOYW1lLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuczMuc2VuZChjb21tYW5kKTtcclxuXHJcbiAgICBjb25zdCBib2R5ID0gZGF0YS5Cb2R5O1xyXG4gICAgaWYgKCFib2R5KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlJlY2VpdmVkIHVuZXhwZWN0ZWQgZGF0YSB0eXBlIGZyb20gUzNcIik7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGJvZHkgaW5zdGFuY2VvZiBCbG9iKSB7XHJcbiAgICAgIGNvbnN0IGFycmF5QnVmZmVyID0gYXdhaXQgYm9keS5hcnJheUJ1ZmZlcigpO1xyXG4gICAgICByZXR1cm4gQnVmZmVyLmZyb20oYXJyYXlCdWZmZXIpO1xyXG4gICAgfSBlbHNlIGlmIChib2R5IGluc3RhbmNlb2YgUmVhZGFibGVTdHJlYW0pIHtcclxuICAgICAgY29uc3QgcmVhZGVyID0gYm9keS5nZXRSZWFkZXIoKTtcclxuICAgICAgY29uc3QgY2h1bmtzOiBVaW50OEFycmF5W10gPSBbXTtcclxuICAgICAgbGV0IHJlc3VsdDtcclxuICAgICAgd2hpbGUgKCEocmVzdWx0ID0gYXdhaXQgcmVhZGVyLnJlYWQoKSkuZG9uZSkge1xyXG4gICAgICAgIGNodW5rcy5wdXNoKHJlc3VsdC52YWx1ZSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGxldCB0b3RhbExlbmd0aCA9IDA7XHJcbiAgICAgIGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7XHJcbiAgICAgICAgdG90YWxMZW5ndGggKz0gY2h1bmsubGVuZ3RoO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBjb21iaW5lZCA9IG5ldyBVaW50OEFycmF5KHRvdGFsTGVuZ3RoKTtcclxuICAgICAgbGV0IG9mZnNldCA9IDA7XHJcbiAgICAgIGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7XHJcbiAgICAgICAgY29tYmluZWQuc2V0KGNodW5rLCBvZmZzZXQpO1xyXG4gICAgICAgIG9mZnNldCArPSBjaHVuay5sZW5ndGg7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbShjb21iaW5lZCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZWNlaXZlZCB1bmV4cGVjdGVkIGRhdGEgdHlwZSBmcm9tIFMzXCIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIHdyaXRlRmlsZShmaWxlOiBGaWxlLCBjb250ZW50OiBCdWZmZXIpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgUHV0T2JqZWN0Q29tbWFuZCh7XHJcbiAgICAgIEJ1Y2tldDogdGhpcy5idWNrZXROYW1lLFxyXG4gICAgICBLZXk6IGZpbGUubmFtZSxcclxuICAgICAgQm9keTogY29udGVudCxcclxuICAgICAgQ29udGVudFR5cGU6IGZpbGUubWltZSxcclxuICAgICAgTWV0YWRhdGE6IHtcclxuICAgICAgICBvcmlnaW5hbExhc3RNb2RpZmllZDogZmlsZS5sYXN0TW9kaWZpZWQudG9JU09TdHJpbmcoKSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIGF3YWl0IHRoaXMuczMuc2VuZChjb21tYW5kKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBkZWxldGVGaWxlKGZpbGU6IEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgRGVsZXRlT2JqZWN0Q29tbWFuZCh7XHJcbiAgICAgIEJ1Y2tldDogdGhpcy5idWNrZXROYW1lLFxyXG4gICAgICBLZXk6IGZpbGUucmVtb3RlTmFtZSxcclxuICAgIH0pO1xyXG5cclxuICAgIGF3YWl0IHRoaXMuczMuc2VuZChjb21tYW5kKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBnZXRGaWxlcygpOiBQcm9taXNlPEZpbGVbXT4ge1xyXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBMaXN0T2JqZWN0c1YyQ29tbWFuZCh7XHJcbiAgICAgIEJ1Y2tldDogdGhpcy5idWNrZXROYW1lLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IChhd2FpdCB0aGlzLnMzLnNlbmQoY29tbWFuZCkpIGFzIExpc3RPYmplY3RzVjJDb21tYW5kT3V0cHV0O1xyXG4gICAgY29uc3QgZmlsZXM6IEZpbGVbXSA9XHJcbiAgICAgIGRhdGEuQ29udGVudHM/Lm1hcChcclxuICAgICAgICAoZmlsZToge1xyXG4gICAgICAgICAgS2V5Pzogc3RyaW5nO1xyXG4gICAgICAgICAgTGFzdE1vZGlmaWVkPzogRGF0ZTtcclxuICAgICAgICAgIFNpemU/OiBudW1iZXI7XHJcbiAgICAgICAgICBFVGFnPzogc3RyaW5nO1xyXG4gICAgICAgIH0pID0+ICh7XHJcbiAgICAgICAgICBuYW1lOiBkZWNvZGVVUklDb21wb25lbnQoZmlsZS5LZXkhKSxcclxuICAgICAgICAgIGxvY2FsTmFtZTogXCJcIixcclxuICAgICAgICAgIHJlbW90ZU5hbWU6IGZpbGUuS2V5ISxcclxuICAgICAgICAgIG1pbWU6IFwiXCIsXHJcbiAgICAgICAgICBsYXN0TW9kaWZpZWQ6IGZpbGUuTGFzdE1vZGlmaWVkISxcclxuICAgICAgICAgIHNpemU6IGZpbGUuU2l6ZSEsXHJcbiAgICAgICAgICBtZDU6IGZpbGUuRVRhZyEucmVwbGFjZSgvXCIvZywgXCJcIiksXHJcbiAgICAgICAgICBpc0RpcmVjdG9yeTogZmFsc2UsXHJcbiAgICAgICAgfSlcclxuICAgICAgKSB8fCBbXTtcclxuXHJcbiAgICByZXR1cm4gZmlsZXM7XHJcbiAgfVxyXG59XHJcbiJdfQ==