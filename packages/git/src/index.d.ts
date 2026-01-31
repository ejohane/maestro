export interface GitRunResult {
    stdout: string;
    stderr: string;
}
export interface WorkspaceResult {
    branch: string;
    worktreePath: string;
    baseRef: string;
    baseSha: string;
    stashRef?: string;
}
export declare const getRepoDisplayName: (repoRoot: string) => Promise<string>;
export declare const getRepoSlug: (repoRoot: string) => Promise<string>;
export declare const resolveRepoRoot: (inputPath: string) => Promise<string>;
export declare const assertGitRepo: (repoRoot: string) => Promise<void>;
export declare const isDirty: (repoRoot: string) => Promise<boolean>;
export declare const refExists: (repoRoot: string, ref: string) => Promise<boolean>;
export declare const fetchAll: (repoRoot: string) => Promise<void>;
export declare const resolveRef: (repoRoot: string, ref: string) => Promise<string>;
export declare const createBranch: (repoRoot: string, branch: string, sha: string) => Promise<void>;
export declare const createWorktree: (repoRoot: string, worktreePath: string, branch: string) => Promise<void>;
export declare const stashChanges: (repoRoot: string, conversationId: string) => Promise<string>;
export declare const prepareWorkspace: (options: {
    repoRoot: string;
    conversationId: string;
    projectName: string;
    conversationTitle?: string;
    defaultBranch: string;
    fromRef?: string;
    stash?: boolean;
}) => Promise<WorkspaceResult>;
