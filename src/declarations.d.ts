declare module 'diff-match-patch' {
    export class diff_match_patch {
        constructor();
        Diff_Timeout: number;
        Match_Threshold: number;
        Patch_DeleteThreshold: number;
        static readonly DIFF_DELETE: -1;
        static readonly DIFF_INSERT: 1;
        static readonly DIFF_EQUAL: 0;
        diff_main(text1: string, text2: string, checkLines?: boolean): Array<[number, string]>;
        diff_linesToChars_(text1: string, text2: string): {chars1: string, chars2: string, lineArray: string[]};
        diff_charsToLines_(diffs: Array<[number, string]>, lineArray: string[]): void;
        diff_cleanupSemantic(diffs: Array<[number, string]>): void;
    }
}
