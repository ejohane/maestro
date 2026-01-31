import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";

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

const slugify = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized || fallback;
};

const truncateSlug = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength).replace(/-+$/g, "");
};

const getConversationHash = (conversationId: string): string => {
  const parts = conversationId.split("_");
  return parts.length > 1 ? parts[1] : conversationId;
};

const buildWorkspaceDirName = (
  projectName: string,
  conversationTitle: string | undefined,
  conversationId: string
): string => {
  const projectSlug = truncateSlug(slugify(projectName, "project"), 24);
  const titleSlug = truncateSlug(slugify(conversationTitle ?? "untitled", "untitled"), 32);
  const hash = getConversationHash(conversationId);
  return `${projectSlug}--${titleSlug}--${hash}`;
};

const runGit = async (repoRoot: string, args: string[]): Promise<GitRunResult> => {
  const { stdout, stderr } = await execFileAsync("git", ["-C", repoRoot, ...args]);
  return { stdout: stdout.trim(), stderr: stderr.trim() };
};

const parseRepoFromRemote = (remote: string): string | null => {
  const cleaned = remote.trim().replace(/\.git$/i, "");
  if (!cleaned) {
    return null;
  }
  const scpMatch = cleaned.match(/^[^@]+@[^:]+:(.+)$/);
  if (scpMatch) {
    const pathPart = scpMatch[1].replace(/^\/+/, "");
    const [org, repo] = pathPart.split("/");
    if (org && repo) {
      return `${org}/${repo}`;
    }
  }
  try {
    const url = new URL(cleaned);
    const pathPart = url.pathname.replace(/^\/+/, "");
    const [org, repo] = pathPart.split("/");
    if (org && repo) {
      return `${org}/${repo}`;
    }
  } catch {
    return null;
  }
  return null;
};

export const getRepoDisplayName = async (repoRoot: string): Promise<string> => {
  try {
    const { stdout } = await runGit(repoRoot, ["remote", "get-url", "origin"]);
    const parsed = parseRepoFromRemote(stdout);
    if (parsed) {
      return parsed;
    }
  } catch {
    // ignore missing remotes
  }
  return path.basename(repoRoot);
};

export const getRepoSlug = async (repoRoot: string): Promise<string> => {
  const displayName = await getRepoDisplayName(repoRoot);
  const slug = displayName
    .replace(/[\s/]+/g, "--")
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/--+/g, "--")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || path.basename(repoRoot).toLowerCase();
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

export const removeWorktree = async (repoRoot: string, worktreePath: string): Promise<void> => {
  try {
    const stat = await fs.stat(worktreePath);
    if (!stat.isDirectory()) {
      return;
    }
  } catch {
    await runGit(repoRoot, ["worktree", "prune"]);
    return;
  }
  await runGit(repoRoot, ["worktree", "remove", "--force", worktreePath]);
};

export const deleteBranch = async (repoRoot: string, branch: string): Promise<void> => {
  if (!(await refExists(repoRoot, branch))) {
    return;
  }
  await runGit(repoRoot, ["branch", "-D", branch]);
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
  projectName: string;
  conversationTitle?: string;
  defaultBranch: string;
  fromRef?: string;
  stash?: boolean;
}): Promise<WorkspaceResult> => {
  const {
    repoRoot,
    conversationId,
    projectName,
    conversationTitle,
    defaultBranch,
    fromRef,
    stash
  } = options;
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
    await fetchAll(repoRoot);
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
  const workspaceDirName = buildWorkspaceDirName(projectName, conversationTitle, conversationId);
  const worktreePath = path.join(os.homedir(), ".maestro", "workspaces", workspaceDirName);
  await createWorktree(repoRoot, worktreePath, branch);

  return { branch, worktreePath, baseRef, baseSha, stashRef };
};
