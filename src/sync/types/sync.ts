import { File } from "../AbstractManager";

export interface Scenario {
    local: File | null;
    remote: File | null;
    rule: SyncRule;
}

export type SyncRule =
    | "LOCAL_TO_REMOTE"
    | "REMOTE_TO_LOCAL"
    | "DIFF_MERGE"
    | "DELETE_LOCAL"
    | "DELETE_REMOTE"
    | "TO_CACHE";
