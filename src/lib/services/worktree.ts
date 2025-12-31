// WorktreeService - Git Worktree Lifecycle Management
// Manages isolated worktrees for planning sessions

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Types
export interface WorktreeInfo {
  path: string;           // Full path to worktree
  branch: string;         // Branch name (e.g., 'feature/issue-6-planning-mode')
  issueNumber: number;
  projectPath: string;    // Original project path
  createdAt: string;      // ISO timestamp
  depsInstalled: boolean; // Whether node_modules exists
}

export type WorktreeErrorCode = 'NOT_GIT_REPO' | 'BRANCH_CONFLICT' | 'PATH_OCCUPIED' | 'GIT_ERROR';

export class WorktreeError extends Error {
  constructor(
    message: string,
    public code: WorktreeErrorCode,
    public details?: string
  ) {
    super(message);
    this.name = 'WorktreeError';
  }
}

class WorktreeService {
  private baseDir = path.join(os.homedir(), '.maestro', 'worktrees');
  private metadataDir = path.join(os.homedir(), '.maestro', 'worktree-metadata');

  // ============================================================
  // Core Operations
  // ============================================================

  /**
   * Create a new worktree for a project and issue
   * If branch already exists, resumes from existing worktree
   */
  async createWorktree(
    projectPath: string,
    issueNumber: number,
    issueTitle: string
  ): Promise<WorktreeInfo> {
    // Validate project is a git repository
    await this.validateGitRepo(projectPath);

    const slug = await this.getProjectSlug(projectPath);
    const worktreePath = path.join(this.baseDir, slug, `issue-${issueNumber}`);
    const branchName = this.getBranchName(issueNumber, issueTitle);

    // Ensure parent directories exist
    await fs.mkdir(path.dirname(worktreePath), { recursive: true });
    await fs.mkdir(path.join(this.metadataDir, slug), { recursive: true });

    // Check if path is already occupied by something other than our worktree
    if (await this.pathExists(worktreePath)) {
      const isValidWorktree = await this.isGitWorktree(worktreePath);
      if (!isValidWorktree) {
        throw new WorktreeError(
          `Path ${worktreePath} is occupied by non-worktree files`,
          'PATH_OCCUPIED',
          'Remove the directory manually or choose a different issue number'
        );
      }
      // Path exists and is a valid worktree - load existing metadata
      const existing = await this.loadWorktreeMetadata(projectPath, issueNumber);
      if (existing) {
        return existing;
      }
    }

    // Get default branch name (main/master)
    const defaultBranch = await this.getDefaultBranch(projectPath);

    // Check if branch already exists
    const branchAlreadyExists = await this.branchExists(projectPath, branchName);

    if (branchAlreadyExists) {
      // Check if worktree already exists for this branch
      const existingWorktree = await this.findWorktreeForBranch(projectPath, branchName);
      if (existingWorktree) {
        // Resume existing worktree
        return existingWorktree;
      }

      // Create worktree from existing branch
      try {
        await execAsync(
          `git worktree add "${this.escapeShellArg(worktreePath)}" "${this.escapeShellArg(branchName)}"`,
          { cwd: projectPath }
        );
      } catch (err) {
        throw new WorktreeError(
          `Failed to create worktree from existing branch: ${branchName}`,
          'GIT_ERROR',
          err instanceof Error ? err.message : String(err)
        );
      }
    } else {
      // Create new branch and worktree
      try {
        await execAsync(
          `git worktree add -b "${this.escapeShellArg(branchName)}" "${this.escapeShellArg(worktreePath)}" "${this.escapeShellArg(defaultBranch)}"`,
          { cwd: projectPath }
        );
      } catch (err) {
        throw new WorktreeError(
          `Failed to create worktree with new branch: ${branchName}`,
          'GIT_ERROR',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    // Store metadata in centralized location (not in worktree)
    const info: WorktreeInfo = {
      path: worktreePath,
      branch: branchName,
      issueNumber,
      projectPath,
      createdAt: new Date().toISOString(),
      depsInstalled: false,
    };

    await this.storeWorktreeMetadata(info);

    return info;
  }

  /**
   * Get worktree info for a project and issue
   * Returns null if no worktree exists
   */
  async getWorktree(projectPath: string, issueNumber: number): Promise<WorktreeInfo | null> {
    const metadata = await this.loadWorktreeMetadata(projectPath, issueNumber);
    if (!metadata) {
      return null;
    }

    // Verify worktree still exists on disk
    if (!(await this.pathExists(metadata.path))) {
      // Worktree was deleted externally, clean up metadata
      await this.deleteWorktreeMetadata(projectPath, issueNumber);
      return null;
    }

    return metadata;
  }

  /**
   * Delete a worktree, its branch, and metadata
   */
  async deleteWorktree(projectPath: string, issueNumber: number): Promise<void> {
    const metadata = await this.loadWorktreeMetadata(projectPath, issueNumber);
    
    if (metadata) {
      // Remove the worktree using git
      try {
        await execAsync(
          `git worktree remove "${this.escapeShellArg(metadata.path)}" --force`,
          { cwd: projectPath }
        );
      } catch {
        // Worktree might already be removed, try to prune
        try {
          await execAsync('git worktree prune', { cwd: projectPath });
        } catch {
          // Ignore prune errors
        }
      }

      // Delete the branch
      try {
        await execAsync(
          `git branch -D "${this.escapeShellArg(metadata.branch)}"`,
          { cwd: projectPath }
        );
      } catch {
        // Branch might already be deleted or merged
      }

      // Clean up worktree directory if it still exists
      try {
        await fs.rm(metadata.path, { recursive: true, force: true });
      } catch {
        // Directory might already be deleted
      }
    }

    // Always delete metadata
    await this.deleteWorktreeMetadata(projectPath, issueNumber);
  }

  // ============================================================
  // Status Checks
  // ============================================================

  /**
   * Check if a worktree exists for a project and issue
   */
  async worktreeExists(projectPath: string, issueNumber: number): Promise<boolean> {
    const worktree = await this.getWorktree(projectPath, issueNumber);
    return worktree !== null;
  }

  /**
   * Check if dependencies are installed in the worktree
   */
  async areDepsInstalled(projectPath: string, issueNumber: number): Promise<boolean> {
    const metadata = await this.loadWorktreeMetadata(projectPath, issueNumber);
    if (!metadata) {
      return false;
    }
    return metadata.depsInstalled;
  }

  // ============================================================
  // Markers
  // ============================================================

  /**
   * Mark dependencies as installed for a worktree
   */
  async markDepsInstalled(projectPath: string, issueNumber: number): Promise<void> {
    const metadata = await this.loadWorktreeMetadata(projectPath, issueNumber);
    if (metadata) {
      metadata.depsInstalled = true;
      await this.storeWorktreeMetadata(metadata);
    }
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Get a filesystem-safe slug for a project
   * Derived from git remote URL or directory basename
   */
  async getProjectSlug(projectPath: string): Promise<string> {
    try {
      // Try to get from git remote URL
      const { stdout } = await execAsync('git remote get-url origin', { cwd: projectPath });
      const url = stdout.trim();
      
      // Extract repo name from URL
      // Handles: https://github.com/user/repo.git, git@github.com:user/repo.git
      const match = url.match(/[/:]([^/]+)\.git$/) || url.match(/[/:]([^/]+)$/);
      if (match) {
        return this.slugify(match[1]);
      }
    } catch {
      // No remote or git error - fall back to directory name
    }

    // Fallback to directory basename
    return this.slugify(path.basename(projectPath));
  }

  /**
   * Get the worktree path for a project and issue
   */
  async getWorktreePath(projectPath: string, issueNumber: number): Promise<string> {
    const slug = await this.getProjectSlug(projectPath);
    return path.join(this.baseDir, slug, `issue-${issueNumber}`);
  }

  /**
   * Generate a branch name from issue number and title
   * Format: feature/issue-{n}-{slug}
   */
  getBranchName(issueNumber: number, issueTitle: string): string {
    const slug = this.slugify(issueTitle).substring(0, 50);
    return `feature/issue-${issueNumber}-${slug}`;
  }

  // ============================================================
  // Git Helpers
  // ============================================================

  /**
   * Get the default branch for a repository (usually 'main' or 'master')
   */
  async getDefaultBranch(projectPath: string): Promise<string> {
    try {
      // Try to get from remote HEAD
      const { stdout } = await execAsync(
        'git symbolic-ref refs/remotes/origin/HEAD --short',
        { cwd: projectPath }
      );
      // Returns something like 'origin/main', extract just 'main'
      return stdout.trim().replace('origin/', '');
    } catch {
      // Fallback: check if 'main' or 'master' exists
      try {
        await execAsync('git rev-parse --verify main', { cwd: projectPath });
        return 'main';
      } catch {
        return 'master';
      }
    }
  }

  /**
   * Check if a branch exists in the repository
   */
  async branchExists(projectPath: string, branchName: string): Promise<boolean> {
    try {
      await execAsync(
        `git rev-parse --verify "${this.escapeShellArg(branchName)}"`,
        { cwd: projectPath }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find an existing worktree for a given branch
   */
  async findWorktreeForBranch(projectPath: string, branchName: string): Promise<WorktreeInfo | null> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', { cwd: projectPath });
      const lines = stdout.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('worktree ')) {
          const worktreePath = lines[i].replace('worktree ', '');
          // Check next few lines for branch info
          const branchLine = lines.slice(i, i + 5).find(l => l.startsWith('branch '));
          if (branchLine) {
            // Branch line format: "branch refs/heads/feature/issue-6-..."
            const fullBranchRef = branchLine.replace('branch ', '');
            const actualBranch = fullBranchRef.replace('refs/heads/', '');
            
            if (actualBranch === branchName) {
              // Found it - try to load metadata
              const issueMatch = worktreePath.match(/issue-(\d+)/);
              if (issueMatch) {
                const metadata = await this.loadWorktreeMetadata(projectPath, parseInt(issueMatch[1]));
                if (metadata) {
                  return metadata;
                }
                // No metadata but worktree exists - create metadata
                const info: WorktreeInfo = {
                  path: worktreePath,
                  branch: branchName,
                  issueNumber: parseInt(issueMatch[1]),
                  projectPath,
                  createdAt: new Date().toISOString(),
                  depsInstalled: await this.hasNodeModules(worktreePath),
                };
                await this.storeWorktreeMetadata(info);
                return info;
              }
            }
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Get the metadata file path for a project and issue
   */
  private async getMetadataPath(projectPath: string, issueNumber: number): Promise<string> {
    const slug = await this.getProjectSlug(projectPath);
    return path.join(this.metadataDir, slug, `issue-${issueNumber}.json`);
  }

  /**
   * Store worktree metadata to disk
   */
  private async storeWorktreeMetadata(info: WorktreeInfo): Promise<void> {
    const metadataPath = await this.getMetadataPath(info.projectPath, info.issueNumber);
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(info, null, 2), 'utf-8');
  }

  /**
   * Load worktree metadata from disk
   */
  private async loadWorktreeMetadata(projectPath: string, issueNumber: number): Promise<WorktreeInfo | null> {
    try {
      const metadataPath = await this.getMetadataPath(projectPath, issueNumber);
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content) as WorktreeInfo;
    } catch {
      return null;
    }
  }

  /**
   * Delete worktree metadata from disk
   */
  private async deleteWorktreeMetadata(projectPath: string, issueNumber: number): Promise<void> {
    try {
      const metadataPath = await this.getMetadataPath(projectPath, issueNumber);
      await fs.unlink(metadataPath);
    } catch {
      // File might not exist
    }
  }

  /**
   * Validate that a path is a git repository
   */
  private async validateGitRepo(projectPath: string): Promise<void> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: projectPath });
    } catch {
      throw new WorktreeError(
        `${projectPath} is not a git repository`,
        'NOT_GIT_REPO',
        'Initialize a git repository with "git init" first'
      );
    }
  }

  /**
   * Check if a path exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a path is a valid git worktree
   */
  private async isGitWorktree(worktreePath: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: worktreePath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if node_modules exists in a directory
   */
  private async hasNodeModules(dirPath: string): Promise<boolean> {
    return this.pathExists(path.join(dirPath, 'node_modules'));
  }

  /**
   * Create a filesystem-safe slug from a string
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  /**
   * Escape a string for safe use in shell commands
   * Note: We use double quotes in execAsync, so we escape double quotes
   */
  private escapeShellArg(arg: string): string {
    // Escape backslashes and double quotes
    return arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

// Singleton instance for application-wide use
export const worktreeService = new WorktreeService();
