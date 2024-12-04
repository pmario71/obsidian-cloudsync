"use strict";
exports.__esModule = true;
exports.LogManager = void 0;
var types_1 = require("./types");
var LogManager = /** @class */ (function () {
    function LogManager() {
    }
    LogManager.setLogFunction = function (fn) {
        LogManager.logFunction = fn;
    };
    LogManager.normalizePath = function (str) {
        return str.replace(/\\/g, '/');
    };
    LogManager.safeStringify = function (value) {
        var _this = this;
        var seen = new WeakSet();
        var process = function (val) {
            // Handle string values - normalize if it looks like a path
            if (typeof val === 'string') {
                return _this.normalizePath(val);
            }
            // Handle basic types directly
            if (typeof val !== 'object' || val === null) {
                return val;
            }
            // Handle Error objects specially
            if (val instanceof Error) {
                return {
                    name: val.name,
                    message: _this.normalizePath(val.message),
                    stack: _this.normalizePath(val.stack || '')
                };
            }
            // Handle circular references
            if (seen.has(val)) {
                return '[Circular]';
            }
            seen.add(val);
            // Handle AWS SDK objects specially
            if (val.constructor) {
                if (val.constructor.name.includes('Command')) {
                    return "[AWS ".concat(val.constructor.name, "]");
                }
                if (val.constructor.name === 'S3Client') {
                    return '[AWS S3Client]';
                }
            }
            // For arrays, process each value
            if (Array.isArray(val)) {
                return val.map(function (v) { return process(v); });
            }
            // For objects, process each value
            var obj = {};
            var entries = Object.entries(val).filter(function (_a) {
                var k = _a[0], v = _a[1];
                return typeof v !== 'function' && !k.startsWith('_');
            });
            // If object has only one property, return its value directly
            if (entries.length === 1) {
                return process(entries[0][1]);
            }
            // Otherwise process all properties
            for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                var _a = entries_1[_i], k = _a[0], v = _a[1];
                obj[k] = process(v);
            }
            return obj;
        };
        var processed = process(value);
        return typeof processed === 'object' ? JSON.stringify(processed) : String(processed);
    };
    LogManager.log = function (level, message, data, update) {
        var logMessage = this.normalizePath(message);
        var logType;
        // Add data to message if provided
        if (data !== undefined) {
            try {
                logMessage += " ".concat(this.safeStringify(data));
            }
            catch (e) {
                logMessage += " [Unable to stringify data: ".concat(e.message, "]");
            }
        }
        // Map LogLevel to log type
        switch (level) {
            case types_1.LogLevel.None:
                return; // Don't log anything for None level
            case types_1.LogLevel.Error:
                logType = 'error';
                break;
            case types_1.LogLevel.Info:
                logType = 'info';
                break;
            case types_1.LogLevel.Trace:
                logType = 'trace';
                break;
            case types_1.LogLevel.Debug:
                logType = 'debug';
                break;
            default:
                logType = 'info';
        }
        // Let main.ts handle the log level filtering
        LogManager.logFunction(logMessage, logType, update);
    };
    LogManager.addDelimiter = function () {
        // Special message type for delimiter
        LogManager.logFunction('', 'delimiter');
    };
    LogManager.logFunction = function () { }; // Default no-op function
    return LogManager;
}());
exports.LogManager = LogManager;
