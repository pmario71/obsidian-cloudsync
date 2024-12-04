import { diff_match_patch } from "diff-match-patch";
import { File } from "./AbstractManager";
import { LogLevel } from "./types";
import { LogManager } from "./LogManager";

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

        const lineMode = dmp.diff_linesToChars_(str1, str2);
        const diffs = dmp.diff_main(lineMode.chars1, lineMode.chars2, false);
        dmp.diff_charsToLines_(diffs, lineMode.lineArray);
        dmp.diff_cleanupSemantic(diffs);

        const expandedDiffs = diffs.flatMap(([op, text]: Diff) =>
            text.split('\n').map((line: string, index: number, lines: string[]) =>
                [op, index < lines.length - 1 ? line + '\n' : line] as Diff
            ).filter(([_, line]: Diff) => line !== '')
        );

        const mergedContent = Buffer.from(
            expandedDiffs.map(([op, text]: Diff) => {
                if (op === diff_match_patch.DIFF_DELETE) return '－' + text;
                if (op === diff_match_patch.DIFF_INSERT) return '＋' + text;
                return text;
            }).join('')
        );

        log(LogLevel.Debug, `Merged content:\n${mergedContent.toString()}`);

        await Promise.all([
            localWrite(file, mergedContent),
            remoteWrite(file, mergedContent)
        ]);
    } catch (error) {
        log(LogLevel.Error, `Error during merge: ${error}`);
        throw error;
    }
}

function log(level: LogLevel, message: string) {
    LogManager.log(level, `[MergeUtils] ${message}`);
}
