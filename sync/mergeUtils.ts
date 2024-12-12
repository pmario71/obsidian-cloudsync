import { diff_match_patch } from "diff-match-patch";
import { File } from "./AbstractManager";
import { LogLevel } from "./types";
import { LogManager } from "../LogManager";
import { createHash } from "crypto";

type DiffOp = -1 | 0 | 1;
type Diff = [DiffOp, string];

export async function diffMerge(
    file: File,
    localRead: (file: File) => Promise<Buffer>,
    remoteRead: (file: File) => Promise<Buffer>,
    localWrite: (file: File, content: Buffer) => Promise<void>,
    remoteWrite: (file: File, content: Buffer) => Promise<void>
): Promise<void> {
    log(LogLevel.Debug, `Starting merge for ${file.name}`);

    try {
        log(LogLevel.Debug, 'Reading file versions');
        const [localContent, remoteContent] = await Promise.all([
            localRead(file).then(buf => buf.toString()),
            remoteRead(file).then(buf => buf.toString())
        ]);

        const dmp = new diff_match_patch();
        dmp.Diff_Timeout = 1.0;
        dmp.Match_Threshold = 0.0;
        dmp.Patch_DeleteThreshold = 0.0;

        // Ensure consistent line endings
        let str1 = localContent;
        let str2 = remoteContent;
        if (!str1.endsWith('\n')) str1 += '\n';
        if (!str2.endsWith('\n')) str2 += '\n';

        // Clean only diff markers at the beginning of lines
        str1 = str1.split('\n').map(line => line.replace(/^[－＋]/, '')).join('\n');
        str2 = str2.split('\n').map(line => line.replace(/^[－＋]/, '')).join('\n');

        const lineMode = dmp.diff_linesToChars_(str1, str2);
        const diffs = dmp.diff_main(lineMode.chars1, lineMode.chars2, false);
        dmp.diff_charsToLines_(diffs, lineMode.lineArray);

        // Skip semantic cleanup to prevent merging of adjacent changes
        // dmp.diff_cleanupSemantic(diffs);

        // Process diffs line by line to ensure clean separation
        const mergedLines: string[] = [];
        let currentLine = '';

        diffs.forEach(([op, text]) => {
            const lines = text.split('\n');
            lines.forEach((line, idx) => {
                if (line === '') return;
                if (op === diff_match_patch.DIFF_DELETE) {
                    mergedLines.push('－' + line);
                } else if (op === diff_match_patch.DIFF_INSERT) {
                    mergedLines.push('＋' + line);
                } else {
                    mergedLines.push(line);
                }
                if (idx < lines.length - 1 || text.endsWith('\n')) {
                    mergedLines[mergedLines.length - 1] += '\n';
                }
            });
        });

        const mergedContent = Buffer.from(mergedLines.join(''));
        log(LogLevel.Debug, `Merged content:\n${mergedContent.toString()}`);

        await Promise.all([
            localWrite(file, mergedContent),
            remoteWrite(file, mergedContent)
        ]);

        // Update file metadata after merge
        const md5 = createHash('md5').update(mergedContent).digest('hex');
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
