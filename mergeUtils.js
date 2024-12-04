"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.diffMerge = void 0;
var diff_match_patch_1 = require("diff-match-patch");
var types_1 = require("./types");
var LogManager_1 = require("./LogManager");
function diffMerge(file, localRead, remoteRead, localWrite, remoteWrite) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, localContent, remoteContent, dmp, _b, chars1, chars2, lineArray, diffs, mergedContent, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    log(types_1.LogLevel.Debug, "Starting merge for ".concat(file.name));
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    log(types_1.LogLevel.Debug, 'Reading file versions');
                    return [4 /*yield*/, Promise.all([
                            localRead(file).then(function (buf) { return buf.toString(); }),
                            remoteRead(file).then(function (buf) { return buf.toString(); })
                        ])];
                case 2:
                    _a = _c.sent(), localContent = _a[0], remoteContent = _a[1];
                    dmp = new diff_match_patch_1.diff_match_patch();
                    Object.assign(dmp, {
                        Diff_Timeout: 3,
                        Match_Threshold: 0.0,
                        Patch_DeleteThreshold: 0.0
                    });
                    _b = dmp.diff_linesToChars_(localContent, remoteContent), chars1 = _b.chars1, chars2 = _b.chars2, lineArray = _b.lineArray;
                    diffs = dmp.diff_main(chars1, chars2, false);
                    dmp.diff_charsToLines_(diffs, lineArray);
                    dmp.diff_cleanupSemantic(diffs);
                    mergedContent = Buffer.from(diffs
                        .map(function (_a) {
                        var op = _a[0], text = _a[1];
                        var trimmedText = text.replace(/^\n+|\n+$/g, '') + '\n';
                        if (op === diff_match_patch_1.diff_match_patch.DIFF_DELETE)
                            return '－' + trimmedText;
                        if (op === diff_match_patch_1.diff_match_patch.DIFF_INSERT)
                            return '＋' + trimmedText;
                        return trimmedText;
                    })
                        .join(''));
                    log(types_1.LogLevel.Debug, "Merged content:\n".concat(mergedContent.toString()));
                    return [4 /*yield*/, Promise.all([
                            localWrite(file, mergedContent),
                            remoteWrite(file, mergedContent)
                        ])];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _c.sent();
                    log(types_1.LogLevel.Error, "Error during merge: ".concat(error_1));
                    throw error_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.diffMerge = diffMerge;
function log(level, message) {
    LogManager_1.LogManager.log(level, "[MergeUtils] ".concat(message));
}
