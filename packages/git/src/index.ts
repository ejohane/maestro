import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

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

const runGit = async (repoRoot: string, args: string[]): Promise<GitRunResult> => {
  const { stdout, stderr } = await execFileAsync("git", ["-C", repoRoot, ...args]);
  return { stdout: stdout.trim(), stderr: stderr.trim() };
};

export const resolveRepoRoot = async (inputPath: string): Promise<string> => {
  const { stdout } = await execFileAsync("git", ["-C", inputPath, "rev-parse", "--show-toplevel"]);
  return stdout.trim();
};

export const assertGitRepo = async (repoRoot: string): Promise<void> => {
  await runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
};

export const isDirty = async (repoRoot: string): Promise<boolean> => {
  const { stdout } = await runGit(repoRoot, ["status", "--porcelain"]);
  return stdout.length > 0;
};

export const refExists = async (repoRoot: string, ref: string): Promise<boolean> => {
  try {
    await runGit(repoRoot, ["rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
};

export const fetchAll = async (repoRoot: string): Promise<void> => {
  await runGit(repoRoot, ["fetch", "--all", "--prune"]);
};

export const resolveRef = async (repoRoot: string, ref: string): Promise<string> => {
  const { stdout } = await runGit(repoRoot, ["rev-parse", ref]);
  return stdout;
};

export const createBranch = async (
  repoRoot: string,
  branch: string,
  sha: string
): Promise<void> => {
  await runGit(repoRoot, ["branch", branch, sha]);
};

export const createWorktree = async (
  repoRoot: string,
  worktreePath: string,
  branch: string
): Promise<void> => {
  await fs.mkdir(path.dirname(worktreePath), { recursive: true });
  await runGit(repoRoot, ["worktree", "add", worktreePath, branch]);
};

export const stashChanges = async (
  repoRoot: string,
  conversationId: string
): Promise<string> => {
  await runGit(repoRoot, [
    "stash",
    "push",
    "-u",
    "-m",
    `maestro: start ${conversationId}`
  ]);
  const { stdout } = await runGit(repoRoot, ["stash", "list", "-1", "--format=%H"]);
  return stdout;
};

export const prepareWorkspace = async (options: {
  repoRoot: string;
  conversationId: string;
  defaultBranch: string;
  fromRef?: string;
  stash?: boolean;
}): Promise<WorkspaceResult> => {
  const { repoRoot, conversationId, defaultBranch, fromRef, stash } = options;
  const dirty = await isDirty(repoRoot);
  let stashRef: string | undefined;
  if (dirty) {
    if (!stash) {
      throw new Error("Repository has uncommitted changes. Use --stash to proceed.");
    }
    stashRef = await stashChanges(repoRoot, conversationId);
  }

  let baseRef = fromRef;
  if (!baseRef) {
    const remoteRef = `origin/${defaultBranch}`;
    baseRef = (await refExists(repoRoot, remoteRef)) ? remoteRef : defaultBranch;
  }

  let baseSha: string;
  try {
    baseSha = await resolveRef(repoRoot, baseRef);
  } catch {
    await fetchAll(repoRoot);
    if (!(await refExists(repoRoot, baseRef))) {
      throw new Error(`Base ref not found: ${baseRef}`);
    }
    baseSha = await resolveRef(repoRoot, baseRef);
  }

  const branch = `conv/${conversationId}`;
  await createBranch(repoRoot, branch, baseSha);
  const worktreePath = path.join(repoRoot, ".maestro", "workspaces", conversationId);
  await createWorktree(repoRoot, worktreePath, branch);

  return { branch, worktreePath, baseRef, baseSha, stashRef };
};
