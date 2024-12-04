"use strict";
exports.__esModule = true;
exports.DEFAULT_SETTINGS = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["None"] = "None";
    LogLevel["Error"] = "Error";
    LogLevel["Info"] = "Info";
    LogLevel["Trace"] = "Trace";
    LogLevel["Debug"] = "Debug";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
exports.DEFAULT_SETTINGS = {
    azureEnabled: false,
    awsEnabled: false,
    gcpEnabled: false,
    logLevel: LogLevel.Info,
    azure: {
        account: "",
        accessKey: ""
    },
    aws: {
        accessKey: "",
        secretKey: "",
        bucket: "",
        region: "us-east-1"
    },
    gcp: {
        privateKey: "",
        clientEmail: "",
        bucket: ""
    },
    syncIgnore: ""
};
