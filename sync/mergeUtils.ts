import { File } from "./AbstractManager";
import { LogLevel } from "./types";
import { LogManager } from "../LogManager";
import * as CryptoJS from 'crypto-js';

const DIFF_DELETE = -1;
const DIFF_INSERT = 1;
const DIFF_EQUAL = 0;

type DiffOp = typeof DIFF_DELETE | typeof DIFF_EQUAL | typeof DIFF_INSERT;
type Diff = [DiffOp, string];

class DiffEngine {
    private readonly maxLineChars = 40000;

    constructor(
        private timeout = 1.0,
        private matchThreshold = 0.0,
        private deleteThreshold = 0.0
    ) {}

    private linesToChars(text1: string, text2: string): { chars1: string, chars2: string, lineArray: string[] } {
        const lineArray: string[] = [''];  // First element is empty since split may have empty strings
        const lineHash = new Map<string, number>();

        // Walk the text inserting a character for each unique line
        const chars1 = this.linesToCharsMunge(text1, lineArray, lineHash);
        const chars2 = this.linesToCharsMunge(text2, lineArray, lineHash);

        return { chars1, chars2, lineArray };
    }

    private linesToCharsMunge(text: string, lineArray: string[], lineHash: Map<string, number>): string {
        let chars = '';
        const lines = text.split('\n');

        for (const line of lines) {
            if (!lineHash.has(line)) {
                lineArray.push(line);
                lineHash.set(line, lineArray.length - 1);
            }
            chars += String.fromCharCode(lineHash.get(line)!);

            if (lineArray.length >= this.maxLineChars) {
                break;
            }
        }

        return chars;
    }

    private charsToLines(diffs: Diff[], lineArray: string[]): void {
        for (const diff of diffs) {
            const text = diff[1];
            const chars: string[] = [];

            for (let i = 0; i < text.length; i++) {
                chars.push(lineArray[text.charCodeAt(i)]);
            }

            diff[1] = chars.join('\n');
        }
    }

    private findCommonPrefix(text1: string, text2: string): number {
        const n = Math.min(text1.length, text2.length);
        for (let i = 0; i < n; i++) {
            if (text1[i] !== text2[i]) {
                return i;
            }
        }
        return n;
    }

    private findCommonSuffix(text1: string, text2: string): number {
        const text1Length = text1.length;
        const text2Length = text2.length;
        const n = Math.min(text1Length, text2Length);

        for (let i = 1; i <= n; i++) {
            if (text1[text1Length - i] !== text2[text2Length - i]) {
                return i - 1;
            }
        }
        return n;
    }

    private computeDiff(text1: string, text2: string): Diff[] {
        // Check for equality (speedup)
        if (text1 === text2) {
            return text1 ? [[DIFF_EQUAL, text1]] : [];
        }

        // Trim common prefix and suffix
        const commonPrefix = this.findCommonPrefix(text1, text2);
        const commonSuffix = this.findCommonSuffix(
            text1.slice(commonPrefix),
            text2.slice(commonPrefix)
        );

        const diffs: Diff[] = [];

        if (commonPrefix) {
            diffs.push([DIFF_EQUAL, text1.slice(0, commonPrefix)]);
        }

        const trimmedText1 = text1.slice(commonPrefix, text1.length - commonSuffix);
        const trimmedText2 = text2.slice(commonPrefix, text2.length - commonSuffix);

        // Check for complete deletion or insertion
        if (!trimmedText1) {
            if (trimmedText2) {
                diffs.push([DIFF_INSERT, trimmedText2]);
            }
        } else if (!trimmedText2) {
            diffs.push([DIFF_DELETE, trimmedText1]);
        } else {
            // Both texts have content, find the differences
            if (trimmedText2.includes(trimmedText1)) {
                // Text1 is completely contained within text2
                const index = trimmedText2.indexOf(trimmedText1);
                diffs.push(
                    [DIFF_INSERT, trimmedText2.slice(0, index)],
                    [DIFF_EQUAL, trimmedText1],
                    [DIFF_INSERT, trimmedText2.slice(index + trimmedText1.length)]
                );
            } else if (trimmedText1.includes(trimmedText2)) {
                // Text2 is completely contained within text1
                const index = trimmedText1.indexOf(trimmedText2);
                diffs.push(
                    [DIFF_DELETE, trimmedText1.slice(0, index)],
                    [DIFF_EQUAL, trimmedText2],
                    [DIFF_DELETE, trimmedText1.slice(index + trimmedText2.length)]
                );
            } else {
                // Complex diff required
                diffs.push(
                    [DIFF_DELETE, trimmedText1],
                    [DIFF_INSERT, trimmedText2]
                );
            }
        }

        if (commonSuffix) {
            diffs.push([DIFF_EQUAL, text1.slice(text1.length - commonSuffix)]);
        }

        return diffs;
    }

    diffMain(text1: string, text2: string): Diff[] {
        // Convert to line mode
        const lineMode = this.linesToChars(text1, text2);
        const diffs = this.computeDiff(lineMode.chars1, lineMode.chars2);
        this.charsToLines(diffs, lineMode.lineArray);
        return diffs;
    }
}

export async function diffMerge(
    file: File,
    localRead: (file: File) => Promise<Uint8Array>,
    remoteRead: (file: File) => Promise<Uint8Array>,
    localWrite: (file: File, content: Uint8Array) => Promise<void>,
    remoteWrite: (file: File, content: Uint8Array) => Promise<void>
): Promise<void> {
    log(LogLevel.Debug, `Starting merge for ${file.name}`);

    try {
        log(LogLevel.Debug, 'Reading file versions');
        const decoder = new TextDecoder();
        const [localContent, remoteContent] = await Promise.all([
            localRead(file).then(buf => decoder.decode(buf)),
            remoteRead(file).then(buf => decoder.decode(buf))
        ]);

        const diffEngine = new DiffEngine(1.0, 0.0, 0.0);

        // Ensure consistent line endings
        let str1 = localContent;
        let str2 = remoteContent;
        if (!str1.endsWith('\n')) str1 += '\n';
        if (!str2.endsWith('\n')) str2 += '\n';

        // Clean only diff markers at the beginning of lines
        str1 = str1.split('\n').map(line => line.replace(/^[－＋]/, '')).join('\n');
        str2 = str2.split('\n').map(line => line.replace(/^[－＋]/, '')).join('\n');

        const diffs = diffEngine.diffMain(str1, str2);

        // Process diffs line by line to ensure clean separation
        const mergedLines: string[] = [];

        diffs.forEach(([op, text]) => {
            const lines = text.split('\n');
            lines.forEach((line, idx) => {
                if (line === '') return;
                if (op === DIFF_DELETE) {
                    mergedLines.push('－' + line);
                } else if (op === DIFF_INSERT) {
                    mergedLines.push('＋' + line);
                } else {
                    mergedLines.push(line);
                }
                if (idx < lines.length - 1 || text.endsWith('\n')) {
                    mergedLines[mergedLines.length - 1] += '\n';
                }
            });
        });

        const encoder = new TextEncoder();
        const mergedContent = encoder.encode(mergedLines.join(''));
        log(LogLevel.Debug, `Merged content:\n${decoder.decode(mergedContent)}`);

        await Promise.all([
            localWrite(file, mergedContent),
            remoteWrite(file, mergedContent)
        ]);

        // Update file metadata after merge
        const md5 = CryptoJS.MD5(decoder.decode(mergedContent)).toString(CryptoJS.enc.Hex);
        file.md5 = md5;
        file.lastModified = new Date();

    } catch (error) {
        log(LogLevel.Error, `Error during merge: ${error}`);
        throw error;
    }
}

function log(level: LogLevel, message: string) {
    LogManager.log(level, `[MergeUtils] ${message}`);
}
