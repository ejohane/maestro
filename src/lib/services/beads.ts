// BeadsService - CLI Wrapper for bd (beads) commands
// Provides TypeScript API for beads operations from the frontend

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================
// Types
// ============================================================

export interface Bead {
  id: string; // e.g., "maestro-g88"
  title: string;
  description?: string;
  type: "epic" | "task" | "bug" | "feature" | "question" | "docs";
  status: "open" | "in_progress" | "closed";
  priority: 0 | 1 | 2 | 3 | 4; // P0=critical, P4=backlog
  parent?: string; // Parent bead ID
  children?: string[]; // Child bead IDs
  blocks?: string[]; // IDs of beads this blocks
  blockedBy?: string[]; // IDs of beads blocking this
  files?: string[]; // Associated file paths
  createdAt: string;
  updatedAt: string;
}

export interface BeadTree {
  root: Bead; // The epic
  children: BeadTree[]; // Nested structure
}

export interface CreateBeadOptions {
  title: string;
  type: Bead["type"];
  priority?: Bead["priority"];
  parent?: string;
  description?: string;
}

export interface UpdateBeadOptions {
  status?: Bead["status"];
  priority?: Bead["priority"];
  title?: string;
  description?: string;
}

// ============================================================
// Errors
// ============================================================

export type BeadsErrorCode =
  | "COMMAND_FAILED"
  | "PARSE_ERROR"
  | "NOT_FOUND"
  | "TIMEOUT";

export class BeadsError extends Error {
  constructor(
    message: string,
    public code: BeadsErrorCode,
    public details?: string
  ) {
    super(message);
    this.name = "BeadsError";
  }
}

// ============================================================
// CLI Helper
// ============================================================

const COMMAND_TIMEOUT = 30000; // 30 seconds

/**
 * Execute a bd CLI command in the specified worktree directory
 */
async function runBeadsCommand(
  worktreePath: string,
  command: string
): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`bd ${command}`, {
      cwd: worktreePath,
      env: { ...process.env },
      timeout: COMMAND_TIMEOUT,
    });

    if (stderr && !stderr.includes("warning")) {
      console.warn("bd stderr:", stderr);
    }

    return stdout.trim();
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string; killed?: boolean };

    if (err.killed) {
      throw new BeadsError(
        `bd command timed out: bd ${command}`,
        "TIMEOUT",
        `Command did not complete within ${COMMAND_TIMEOUT}ms`
      );
    }

    throw new BeadsError(
      `bd command failed: bd ${command}`,
      "COMMAND_FAILED",
      err.stderr || err.message || String(error)
    );
  }
}

// ============================================================
// Normalization
// ============================================================

/**
 * Normalize CLI output to match the Bead interface
 * Handles different field naming conventions from bd CLI
 */
function normalizeBeadFromCLI(raw: Record<string, unknown>): Bead {
  // Normalize status - bd uses underscores, we use underscores too but ensure valid values
  let status: Bead["status"] = "open";
  const rawStatus = String(raw.status || "open").toLowerCase();
  if (rawStatus === "in_progress" || rawStatus === "in-progress") {
    status = "in_progress";
  } else if (rawStatus === "closed") {
    status = "closed";
  }

  // Normalize type
  let type: Bead["type"] = "task";
  const rawType = String(raw.issue_type || raw.type || "task").toLowerCase();
  if (["epic", "task", "bug", "feature", "question", "docs"].includes(rawType)) {
    type = rawType as Bead["type"];
  }

  // Normalize priority (bd uses 0-4, we use the same)
  let priority: Bead["priority"] = 2;
  const rawPriority = raw.priority;
  if (typeof rawPriority === "number" && rawPriority >= 0 && rawPriority <= 4) {
    priority = rawPriority as Bead["priority"];
  } else if (typeof rawPriority === "string") {
    const parsed = parseInt(rawPriority.replace(/^P/i, ""), 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 4) {
      priority = parsed as Bead["priority"];
    }
  }

  // Extract parent from dependencies if not directly available
  let parent: string | undefined = raw.parent as string | undefined;
  if (!parent && Array.isArray(raw.dependencies)) {
    const parentDep = (raw.dependencies as Array<{ dependency_type?: string; id?: string }>)
      .find(d => d.dependency_type === "parent-child");
    if (parentDep) {
      parent = parentDep.id;
    }
  }
  
  // Infer parent from ID structure if not found elsewhere
  // IDs like "maestro-5zh.15" indicate parent "maestro-5zh"
  if (!parent && typeof raw.id === "string") {
    const id = raw.id;
    const lastDotIndex = id.lastIndexOf(".");
    if (lastDotIndex > 0) {
      const suffix = id.substring(lastDotIndex + 1);
      // Only infer parent if suffix is numeric (e.g., ".15", ".1")
      if (/^\d+$/.test(suffix)) {
        parent = id.substring(0, lastDotIndex);
      }
    }
  }

  // Extract blocked-by from dependencies
  let blockedBy: string[] = [];
  if (Array.isArray(raw.blocked_by)) {
    blockedBy = raw.blocked_by as string[];
  } else if (Array.isArray(raw.blockedBy)) {
    blockedBy = raw.blockedBy as string[];
  } else if (Array.isArray(raw.dependencies)) {
    blockedBy = (raw.dependencies as Array<{ dependency_type?: string; id?: string }>)
      .filter(d => d.dependency_type === "blocks")
      .map(d => d.id)
      .filter((id): id is string => typeof id === "string");
  }

  // Extract blocks (dependents)
  let blocks: string[] = [];
  if (Array.isArray(raw.blocks)) {
    blocks = raw.blocks as string[];
  } else if (Array.isArray(raw.dependents)) {
    blocks = (raw.dependents as Array<{ dependency_type?: string; id?: string }>)
      .filter(d => d.dependency_type === "blocks")
      .map(d => d.id)
      .filter((id): id is string => typeof id === "string");
  }

  return {
    id: String(raw.id || ""),
    title: String(raw.title || ""),
    description: raw.description ? String(raw.description) : undefined,
    type,
    status,
    priority,
    parent,
    children: Array.isArray(raw.children) ? (raw.children as string[]) : [],
    blocks,
    blockedBy,
    files: Array.isArray(raw.files) ? (raw.files as string[]) : [],
    createdAt: String(raw.created_at || raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updated_at || raw.updatedAt || new Date().toISOString()),
  };
}

/**
 * Safely parse JSON output from bd CLI
 */
function parseBeadsJson<T>(output: string, context: string): T {
  if (!output || output === "[]" || output === "null") {
    return [] as unknown as T;
  }

  try {
    return JSON.parse(output) as T;
    } catch {
      throw new BeadsError(
        `Failed to parse bd ${context} output`,
        "PARSE_ERROR",
        `Invalid JSON: ${output.substring(0, 200)}${output.length > 200 ? "..." : ""}`
      );
    }
}

// ============================================================
// BeadsService Class
// ============================================================

export class BeadsService {
  // ============================================================
  // Read Operations
  // ============================================================

  /**
   * List all beads in the worktree
   */
  async list(worktreePath: string): Promise<Bead[]> {
    const output = await runBeadsCommand(worktreePath, "list --json");

    if (!output || output === "[]") {
      return [];
    }

    const raw = parseBeadsJson<Record<string, unknown>[]>(output, "list");

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map(normalizeBeadFromCLI);
  }

  /**
   * Get a single bead by ID
   * Returns null if not found
   */
  async get(worktreePath: string, id: string): Promise<Bead | null> {
    try {
      const output = await runBeadsCommand(
        worktreePath,
        `show ${this.escapeArg(id)} --json`
      );

      if (!output) {
        return null;
      }

      // bd show can return an array with single item or an object
      const raw = parseBeadsJson<Record<string, unknown> | Record<string, unknown>[]>(
        output,
        "show"
      );

      if (Array.isArray(raw)) {
        if (raw.length === 0) {
          return null;
        }
        return normalizeBeadFromCLI(raw[0]);
      }

      return normalizeBeadFromCLI(raw);
    } catch (error) {
      if (
        error instanceof BeadsError &&
        error.code === "COMMAND_FAILED" &&
        error.details?.includes("not found")
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get beads that are ready to work on (no blockers)
   */
  async getReady(worktreePath: string): Promise<Bead[]> {
    const output = await runBeadsCommand(worktreePath, "ready --json");

    if (!output || output === "[]") {
      return [];
    }

    const raw = parseBeadsJson<Record<string, unknown>[]>(output, "ready");

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.map(normalizeBeadFromCLI);
  }

  /**
   * Get a bead tree starting from an epic
   * Builds hierarchical structure from parent-child relationships
   */
  async getTree(worktreePath: string, epicId: string): Promise<BeadTree> {
    const allBeads = await this.list(worktreePath);
    const beadMap = new Map(allBeads.map((b) => [b.id, b]));

    const epic = beadMap.get(epicId);
    if (!epic) {
      throw new BeadsError(`Epic not found: ${epicId}`, "NOT_FOUND");
    }

    // Build tree recursively
    const buildTree = (bead: Bead): BeadTree => {
      const children = allBeads
        .filter((b) => b.parent === bead.id)
        .map(buildTree);

      return { root: bead, children };
    };

    return buildTree(epic);
  }

  // ============================================================
  // Write Operations
  // ============================================================

  /**
   * Create a new bead
   */
  async create(worktreePath: string, options: CreateBeadOptions): Promise<Bead> {
    const args: string[] = ["create"];

    // Title (required)
    args.push(`--title=${this.escapeArg(options.title)}`);

    // Type
    args.push(`--type=${options.type}`);

    // Priority (optional, default 2)
    if (options.priority !== undefined) {
      args.push(`--priority=${options.priority}`);
    }

    // Parent (optional)
    if (options.parent) {
      args.push(`--parent=${this.escapeArg(options.parent)}`);
    }

    // Description (optional)
    if (options.description) {
      args.push(`--description=${this.escapeArg(options.description)}`);
    }

    // Add --json flag for output
    args.push("--json");

    const output = await runBeadsCommand(worktreePath, args.join(" "));

    // bd create --json outputs the created bead
    if (!output) {
      throw new BeadsError(
        "No output from bd create command",
        "PARSE_ERROR",
        "Expected JSON output with created bead"
      );
    }

    const raw = parseBeadsJson<Record<string, unknown> | Record<string, unknown>[]>(
      output,
      "create"
    );

    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        throw new BeadsError(
          "bd create returned empty array",
          "PARSE_ERROR",
          "Expected created bead in output"
        );
      }
      return normalizeBeadFromCLI(raw[0]);
    }

    return normalizeBeadFromCLI(raw);
  }

  /**
   * Update an existing bead
   */
  async update(
    worktreePath: string,
    id: string,
    updates: UpdateBeadOptions
  ): Promise<Bead> {
    const args: string[] = ["update", this.escapeArg(id)];

    // Status
    if (updates.status) {
      args.push(`--status=${updates.status}`);
    }

    // Priority
    if (updates.priority !== undefined) {
      args.push(`--priority=${updates.priority}`);
    }

    // Title
    if (updates.title) {
      args.push(`--title=${this.escapeArg(updates.title)}`);
    }

    // Description
    if (updates.description) {
      args.push(`--description=${this.escapeArg(updates.description)}`);
    }

    await runBeadsCommand(worktreePath, args.join(" "));

    // Fetch updated bead
    const updated = await this.get(worktreePath, id);
    if (!updated) {
      throw new BeadsError(
        `Bead not found after update: ${id}`,
        "NOT_FOUND",
        "Bead may have been deleted"
      );
    }

    return updated;
  }

  /**
   * Close a bead
   */
  async close(worktreePath: string, id: string, reason?: string): Promise<void> {
    const args: string[] = ["close", this.escapeArg(id)];

    if (reason) {
      args.push(`--reason=${this.escapeArg(reason)}`);
    }

    await runBeadsCommand(worktreePath, args.join(" "));
  }

  // ============================================================
  // Dependency Operations
  // ============================================================

  /**
   * Add a dependency between beads
   * beadId depends on dependsOnId
   */
  async addDependency(
    worktreePath: string,
    beadId: string,
    dependsOnId: string
  ): Promise<void> {
    await runBeadsCommand(
      worktreePath,
      `dep add ${this.escapeArg(beadId)} ${this.escapeArg(dependsOnId)}`
    );
  }

  /**
   * Remove a dependency between beads
   */
  async removeDependency(
    worktreePath: string,
    beadId: string,
    dependsOnId: string
  ): Promise<void> {
    await runBeadsCommand(
      worktreePath,
      `dep remove ${this.escapeArg(beadId)} ${this.escapeArg(dependsOnId)}`
    );
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Escape a string for safe use in shell commands
   */
  private escapeArg(arg: string): string {
    // Wrap in single quotes and escape any single quotes inside
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const beadsService = new BeadsService();
