import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Types
export interface SessionMapping {
  projectId: string;       // Project UUID (from Maestro config)
  projectPath: string;     // Project absolute path (for verification)
  issueNumber: number;     // GitHub issue number
  sessionId: string;       // OpenCode session ID
  createdAt: string;       // ISO timestamp
  lastAccessedAt: string;  // ISO timestamp (updated on access)
}

export interface SessionStore {
  version: 1;              // For future migrations
  mappings: SessionMapping[];
}

class SessionStorageService {
  private configDir = path.join(os.homedir(), ".maestro");
  private storePath = path.join(this.configDir, "sessions.json");

  /**
   * Get a session mapping for a specific project and issue
   */
  async getSession(projectId: string, issueNumber: number): Promise<SessionMapping | null> {
    const store = await this.readStore();
    return store.mappings.find(
      (m) => m.projectId === projectId && m.issueNumber === issueNumber
    ) ?? null;
  }

  /**
   * Save a session mapping (creates or updates)
   */
  async saveSession(
    projectId: string,
    projectPath: string,
    issueNumber: number,
    sessionId: string
  ): Promise<SessionMapping> {
    const store = await this.readStore();
    const now = new Date().toISOString();

    // Check if mapping already exists
    const existingIndex = store.mappings.findIndex(
      (m) => m.projectId === projectId && m.issueNumber === issueNumber
    );

    const mapping: SessionMapping = {
      projectId,
      projectPath,
      issueNumber,
      sessionId,
      createdAt: existingIndex >= 0 ? store.mappings[existingIndex].createdAt : now,
      lastAccessedAt: now,
    };

    if (existingIndex >= 0) {
      store.mappings[existingIndex] = mapping;
    } else {
      store.mappings.push(mapping);
    }

    await this.writeStore(store);
    return mapping;
  }

  /**
   * Remove a session mapping
   */
  async removeSession(projectId: string, issueNumber: number): Promise<boolean> {
    const store = await this.readStore();
    const initialLength = store.mappings.length;

    store.mappings = store.mappings.filter(
      (m) => !(m.projectId === projectId && m.issueNumber === issueNumber)
    );

    if (store.mappings.length !== initialLength) {
      await this.writeStore(store);
      return true;
    }

    return false;
  }

  /**
   * Update lastAccessedAt timestamp for a session
   */
  async touchSession(projectId: string, issueNumber: number): Promise<boolean> {
    const store = await this.readStore();
    const mapping = store.mappings.find(
      (m) => m.projectId === projectId && m.issueNumber === issueNumber
    );

    if (!mapping) {
      return false;
    }

    mapping.lastAccessedAt = new Date().toISOString();
    await this.writeStore(store);
    return true;
  }

  /**
   * Read store from disk, handling missing or corrupt files gracefully
   */
  private async readStore(): Promise<SessionStore> {
    try {
      const content = await fs.readFile(this.storePath, "utf-8");
      const parsed = JSON.parse(content);

      // Basic validation
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        parsed.version === 1 &&
        Array.isArray(parsed.mappings)
      ) {
        return parsed as SessionStore;
      }

      // Invalid structure, return empty store
      console.warn("Session store has invalid structure, using empty store");
      return this.emptyStore();
    } catch (err: unknown) {
      // File doesn't exist - return empty store
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ENOENT"
      ) {
        return this.emptyStore();
      }

      // JSON parse error - return empty store
      if (err instanceof SyntaxError) {
        console.warn("Session store is corrupted, using empty store");
        return this.emptyStore();
      }

      // Re-throw unexpected errors
      throw err;
    }
  }

  /**
   * Write store to disk atomically (write to temp file, then rename)
   */
  private async writeStore(store: SessionStore): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    // Create temp file path with random suffix for atomicity
    const tempPath = `${this.storePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

    try {
      // Write to temp file
      await fs.writeFile(tempPath, JSON.stringify(store, null, 2), "utf-8");

      // Atomic rename
      await fs.rename(tempPath, this.storePath);
    } catch (err) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw err;
    }
  }

  /**
   * Create an empty store structure
   */
  private emptyStore(): SessionStore {
    return {
      version: 1,
      mappings: [],
    };
  }
}

export const sessionStorage = new SessionStorageService();
