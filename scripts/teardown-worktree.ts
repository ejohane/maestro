#!/usr/bin/env bun
/**
 * Teardown script for cleaning up Maestro git worktrees.
 *
 * Usage:
 *   bun scripts/teardown-worktree.ts <project-path> <issue-number> [--dry-run]
 *   bun scripts/teardown-worktree.ts /Users/erik/dev/zine 15
 *   bun scripts/teardown-worktree.ts /Users/erik/dev/zine 15 --dry-run
 *
 * Options:
 *   --dry-run    Preview what would be deleted without actually deleting
 *
 * This script will:
 * 1. Remove the git worktree folder (~/.maestro/worktrees/{project}/issue-{N})
 * 2. Remove worktree metadata (~/.maestro/worktree-metadata/{project}/issue-{N}.json)
 * 3. Remove planning session mapping from ~/.maestro/sessions.json
 * 4. In the original repo: prune worktree refs, checkout main/master, pull latest
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Configuration
const MAESTRO_DIR = path.join(os.homedir(), ".maestro");
const WORKTREES_DIR = path.join(MAESTRO_DIR, "worktrees");
const METADATA_DIR = path.join(MAESTRO_DIR, "worktree-metadata");
const SESSIONS_PATH = path.join(MAESTRO_DIR, "sessions.json");

// Types
interface SessionMapping {
  projectId: string;
  projectPath: string;
  issueNumber: number;
  sessionId: string;
  sessionType?: "discussion" | "planning";
  worktreePath?: string;
  createdAt: string;
  lastAccessedAt: string;
}

interface SessionStore {
  version: 1;
  mappings: SessionMapping[];
}

// Helpers
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

async function getProjectSlug(projectPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd: projectPath,
    });
    const url = stdout.trim();
    const match = url.match(/[/:]([^/]+)\.git$/) || url.match(/[/:]([^/]+)$/);
    if (match) {
      return slugify(match[1]);
    }
  } catch {
    // Fall back to directory name
  }
  return slugify(path.basename(projectPath));
}

async function getDefaultBranch(projectPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "git symbolic-ref refs/remotes/origin/HEAD --short",
      { cwd: projectPath }
    );
    return stdout.trim().replace("origin/", "");
  } catch {
    try {
      await execAsync("git rev-parse --verify main", { cwd: projectPath });
      return "main";
    } catch {
      return "master";
    }
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readSessionStore(): Promise<SessionStore> {
  try {
    const content = await fs.readFile(SESSIONS_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { version: 1, mappings: [] };
  }
}

async function writeSessionStore(store: SessionStore): Promise<void> {
  await fs.writeFile(SESSIONS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

// Main teardown function
async function teardownWorktree(
  projectPath: string,
  issueNumber: number,
  dryRun: boolean = false
): Promise<void> {
  const absoluteProjectPath = path.resolve(projectPath);
  const slug = await getProjectSlug(absoluteProjectPath);

  if (dryRun) {
    console.log("\n[DRY RUN] No changes will be made.\n");
  }

  console.log(`Tearing down worktree for ${slug}/issue-${issueNumber}...`);
  console.log(`Project path: ${absoluteProjectPath}\n`);

  // 1. Remove the worktree folder
  const worktreePath = path.join(WORKTREES_DIR, slug, `issue-${issueNumber}`);
  console.log(`[1/4] Removing worktree folder: ${worktreePath}`);

  if (await pathExists(worktreePath)) {
    if (dryRun) {
      console.log("      Would remove worktree folder");
    } else {
      try {
        // Try to remove via git first (proper cleanup)
        await execAsync(
          `git worktree remove "${worktreePath}" --force`,
          { cwd: absoluteProjectPath }
        );
        console.log("      Removed via git worktree remove");
      } catch {
        // If git fails, force remove the directory
        try {
          await fs.rm(worktreePath, { recursive: true, force: true });
          console.log("      Force removed directory");
        } catch (err) {
          console.error(`      Failed to remove: ${err}`);
        }
      }
    }
  } else {
    console.log("      (not found, skipping)");
  }

  // 2. Remove worktree metadata
  const metadataPath = path.join(METADATA_DIR, slug, `issue-${issueNumber}.json`);
  console.log(`[2/4] Removing metadata: ${metadataPath}`);

  if (await pathExists(metadataPath)) {
    if (dryRun) {
      console.log("      Would remove metadata file");
    } else {
      try {
        await fs.unlink(metadataPath);
        console.log("      Removed metadata file");
      } catch (err) {
        console.error(`      Failed to remove: ${err}`);
      }
    }
  } else {
    console.log("      (not found, skipping)");
  }

  // 3. Remove planning session from sessions.json
  console.log(`[3/4] Removing planning session from sessions.json`);

  try {
    const store = await readSessionStore();
    
    // Find planning sessions matching this project path and issue
    const matchingSessions = store.mappings.filter((m) => {
      return (
        m.projectPath === absoluteProjectPath &&
        m.issueNumber === issueNumber &&
        m.sessionType === "planning"
      );
    });

    if (matchingSessions.length > 0) {
      if (dryRun) {
        console.log(`      Would remove ${matchingSessions.length} planning session(s)`);
      } else {
        store.mappings = store.mappings.filter((m) => {
          const isMatch =
            m.projectPath === absoluteProjectPath &&
            m.issueNumber === issueNumber &&
            m.sessionType === "planning";
          return !isMatch;
        });
        await writeSessionStore(store);
        console.log(`      Removed ${matchingSessions.length} planning session(s)`);
      }
    } else {
      console.log("      (no planning sessions found, skipping)");
    }
  } catch (err) {
    console.error(`      Failed to update sessions: ${err}`);
  }

  // 4. Cleanup in the original repo
  console.log(`[4/4] Cleaning up original repo`);

  if (dryRun) {
    const defaultBranch = await getDefaultBranch(absoluteProjectPath);
    console.log("      Would prune worktree references");
    console.log(`      Would checkout ${defaultBranch}`);
    console.log("      Would pull latest changes");
  } else {
    try {
      // Prune worktree references
      console.log("      Pruning worktree references...");
      await execAsync("git worktree prune", { cwd: absoluteProjectPath });

      // Checkout default branch
      const defaultBranch = await getDefaultBranch(absoluteProjectPath);
      console.log(`      Checking out ${defaultBranch}...`);
      
      try {
        await execAsync(`git checkout ${defaultBranch}`, {
          cwd: absoluteProjectPath,
        });
      } catch (err) {
        // Might already be on the branch or have uncommitted changes
        console.log(`      (checkout skipped: ${err instanceof Error ? err.message.split('\n')[0] : err})`);
      }

      // Pull latest
      console.log("      Pulling latest changes...");
      try {
        const { stdout } = await execAsync("git pull", {
          cwd: absoluteProjectPath,
        });
        console.log(`      ${stdout.trim() || "Already up to date"}`);
      } catch (err) {
        console.log(`      (pull skipped: ${err instanceof Error ? err.message.split('\n')[0] : err})`);
      }
    } catch (err) {
      console.error(`      Error during repo cleanup: ${err}`);
    }
  }

  console.log(dryRun ? "\n[DRY RUN] Complete - no changes made.\n" : "\nTeardown complete!\n");
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filteredArgs = args.filter((a) => a !== "--dry-run");

  if (filteredArgs.length < 2) {
    console.error("Usage: bun scripts/teardown-worktree.ts <project-path> <issue-number> [--dry-run]");
    console.error("Example: bun scripts/teardown-worktree.ts /Users/erik/dev/zine 15");
    console.error("         bun scripts/teardown-worktree.ts /Users/erik/dev/zine 15 --dry-run");
    process.exit(1);
  }

  const projectPath = filteredArgs[0];
  const issueNumber = parseInt(filteredArgs[1], 10);

  if (isNaN(issueNumber)) {
    console.error(`Invalid issue number: ${filteredArgs[1]}`);
    process.exit(1);
  }

  // Validate project path exists
  if (!(await pathExists(projectPath))) {
    console.error(`Project path does not exist: ${projectPath}`);
    process.exit(1);
  }

  await teardownWorktree(projectPath, issueNumber, dryRun);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
