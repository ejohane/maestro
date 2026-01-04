// OpenCode SDK Service Wrapper
// Provides typed methods for interacting with OpenCode AI sessions

import {
  createOpencodeClient,
  OpencodeClient,
  TextPart,
  Session,
  SessionStatus,
  Permission,
} from "@opencode-ai/sdk";

// Re-export SDK types for consumers of this service
export type { Session, SessionStatus, Permission };

// Default model configuration - Claude Opus 4.5
const DEFAULT_MODEL = {
  providerID: "anthropic",
  modelID: "claude-opus-4-5",
};

export interface OpenCodeConfig {
  baseUrl: string;
}

export class OpenCodeService {
  private client: OpencodeClient;

  constructor(config?: Partial<OpenCodeConfig>) {
    this.client = createOpencodeClient({
      baseUrl: config?.baseUrl || process.env.OPENCODE_URL || "http://localhost:4096",
    });
  }

  /**
   * Create a new OpenCode session
   * @param projectPath - Absolute path to the project directory
   * @param title - Session title for identification
   * @returns Object containing the new session ID
   */
  async createSession(projectPath: string, title: string): Promise<{ id: string }> {
    const result = await this.client.session.create({
      query: { directory: projectPath },
      body: { title },
    });

    if (!result.data?.id) {
      throw new Error("Failed to create session: no session ID returned");
    }

    return { id: result.data.id };
  }

  /**
   * Check if a session is still alive/valid
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Session ID to check
   * @returns true if session exists, false otherwise
   */
  async isSessionAlive(projectPath: string, sessionId: string): Promise<boolean> {
    try {
      await this.client.session.get({
        path: { id: sessionId },
        query: { directory: projectPath },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inject context into a session without triggering an AI response
   * Uses noReply: true and synthetic: true to mark as system context
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Target session ID
   * @param context - Context text to inject
   */
  async injectContext(projectPath: string, sessionId: string, context: string): Promise<void> {
    await this.client.session.prompt({
      path: { id: sessionId },
      query: { directory: projectPath },
      body: {
        noReply: true,
        parts: [
          {
            type: "text",
            text: context,
            synthetic: true,
          },
        ],
      },
    });
  }

  /**
   * Send a message with write/edit tools disabled (read-only mode)
   * Uses promptAsync for non-blocking execution
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Target session ID
   * @param message - Message to send
   */
  async sendReadOnlyMessageAsync(
    projectPath: string,
    sessionId: string,
    message: string
  ): Promise<void> {
    await this.client.session.promptAsync({
      path: { id: sessionId },
      query: { directory: projectPath },
      body: {
        model: DEFAULT_MODEL,
        tools: {
          bash: false,
          write: false,
          edit: false,
        },
        parts: [{ type: "text", text: message }],
      },
    });
  }

  /**
   * Send a message with bash enabled but file editing disabled
   * Allows running CLI commands (like gh) but prevents code changes
   * Uses promptAsync for non-blocking execution
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Target session ID
   * @param message - Message to send
   */
  async sendMessageWithBashAsync(
    projectPath: string,
    sessionId: string,
    message: string
  ): Promise<void> {
    await this.client.session.promptAsync({
      path: { id: sessionId },
      query: { directory: projectPath },
      body: {
        model: DEFAULT_MODEL,
        tools: {
          bash: true,
          write: false,
          edit: false,
        },
        parts: [{ type: "text", text: message }],
      },
    });
  }

  /**
   * Request a conversation summary from the AI
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Target session ID
   * @returns Summary text in markdown format
   */
  async generateSummary(projectPath: string, sessionId: string): Promise<string> {
    const result = await this.client.session.prompt({
      path: { id: sessionId },
      query: { directory: projectPath },
      body: {
        model: DEFAULT_MODEL,
        parts: [
          {
            type: "text",
            text: "Summarize our discussion so far in 2-3 paragraphs. Focus on key decisions made, open questions identified, and suggested next steps. Format as markdown.",
          },
        ],
      },
    });

    // Extract text from response parts
    const textPart = result.data?.parts?.find(
      (p): p is TextPart => p.type === "text"
    );
    return textPart?.text || "";
  }

  /**
   * Check if OpenCode service is healthy and responding
   * Uses project.list as a lightweight health check endpoint
   * @returns true if service is responding, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Use project.list as a lightweight health check
      // Since there's no dedicated health endpoint, this verifies the service is running
      await this.client.project.list({});
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to SSE events for a project
   * @param projectPath - Absolute path to the project directory
   * @returns AsyncIterable of events
   */
  async subscribeToEvents(projectPath: string): Promise<AsyncIterable<unknown>> {
    const events = await this.client.event.subscribe({
      query: { directory: projectPath },
    });
    return events.stream;
  }

  /**
   * Get session details
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Session ID to retrieve
   * @returns Session details or null if not found
   */
  async getSession(projectPath: string, sessionId: string) {
    try {
      const result = await this.client.session.get({
        path: { id: sessionId },
        query: { directory: projectPath },
      });
      return result.data;
    } catch {
      return null;
    }
  }

  /**
   * List all sessions for a project
   * @param projectPath - Absolute path to the project directory
   * @returns Array of sessions
   */
  async listSessions(projectPath: string) {
    const result = await this.client.session.list({
      query: { directory: projectPath },
    });
    return result.data || [];
  }

  /**
   * Delete a session
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Session ID to delete
   * @returns true if deleted, false otherwise
   */
  async deleteSession(projectPath: string, sessionId: string): Promise<boolean> {
    try {
      await this.client.session.delete({
        path: { id: sessionId },
        query: { directory: projectPath },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all messages for a session
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Session ID to retrieve messages for
   * @returns Array of messages with their parts, or empty array if not found
   */
  async getSessionMessages(projectPath: string, sessionId: string) {
    try {
      const result = await this.client.session.messages({
        path: { id: sessionId },
        query: { directory: projectPath },
      });
      return result.data || [];
    } catch {
      return [];
    }
  }

  // ============================================================
  // Planning Mode Methods (Full Tool Access)
  // ============================================================

  /**
   * Create a new session configured for planning mode.
   * Uses worktreePath as the directory context for the session.
   * @param worktreePath - Absolute path to the worktree directory
   * @param title - Optional session title for identification
   * @returns Object containing the new session ID
   */
  async createPlanningSession(
    worktreePath: string,
    title?: string
  ): Promise<{ id: string }> {
    const result = await this.client.session.create({
      query: { directory: worktreePath },
      body: { title: title || "Planning Session" },
    });

    if (!result.data?.id) {
      throw new Error("Failed to create planning session: no session ID returned");
    }

    return { id: result.data.id };
  }

  /**
   * Send a message with full tool access (bash, write, edit, read).
   * Used for planning sessions where the agent needs to create/modify beads.
   * Uses promptAsync for non-blocking execution.
   * @param worktreePath - Absolute path to the worktree directory
   * @param sessionId - Target session ID
   * @param message - Message to send
   */
  async sendPlanningMessageAsync(
    worktreePath: string,
    sessionId: string,
    message: string
  ): Promise<void> {
    await this.client.session.promptAsync({
      path: { id: sessionId },
      query: { directory: worktreePath },
      body: {
        model: DEFAULT_MODEL,
        tools: {
          bash: true,
          write: true,
          edit: true,
        },
        parts: [{ type: "text", text: message }],
      },
    });
  }

  /**
   * Execute a slash command in a planning session.
   * Uses the dedicated command endpoint for proper command parsing.
   * Synchronous - waits for command completion.
   * @param worktreePath - Absolute path to the worktree directory
   * @param sessionId - Target session ID
   * @param command - Command name (without leading slash, e.g. "turn_gh_issue_into_beads")
   * @param args - Command arguments as a string
   */
  async sendPlanningCommand(
    worktreePath: string,
    sessionId: string,
    command: string,
    args: string
  ): Promise<void> {
    await this.client.session.command({
      path: { id: sessionId },
      query: { directory: worktreePath },
      body: {
        command,
        arguments: args,
      },
    });
  }

  /**
   * Send a message to a planning session and stream the response.
   * Returns a ReadableStream suitable for SSE responses.
   * Enables full tool access (bash, write, edit).
   * @param worktreePath - Absolute path to the worktree directory
   * @param sessionId - Target session ID
   * @param message - Message to send
   * @returns ReadableStream for SSE consumption
   */
  async streamPlanningResponse(
    worktreePath: string,
    sessionId: string,
    message: string
  ): Promise<ReadableStream> {
    const result = await this.client.session.prompt({
      path: { id: sessionId },
      query: { directory: worktreePath },
      body: {
        model: DEFAULT_MODEL,
        tools: {
          bash: true,
          write: true,
          edit: true,
        },
        parts: [{ type: "text", text: message }],
      },
    });

    // Create a ReadableStream that emits the response as SSE events
    const encoder = new TextEncoder();
    const responseData = result.data;

    return new ReadableStream({
      start(controller) {
        // Emit the response as a single SSE event
        if (responseData) {
          const event = `data: ${JSON.stringify(responseData)}\n\n`;
          controller.enqueue(encoder.encode(event));
        }
        controller.close();
      },
    });
  }

  // ============================================================
  // Swarm Orchestration Methods
  // ============================================================

  /**
   * Get all child sessions of an orchestrator session.
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Parent session ID
   * @returns Array of child sessions, or empty array if none found
   */
  async getChildSessions(projectPath: string, sessionId: string): Promise<Session[]> {
    try {
      const result = await this.client.session.children({
        path: { id: sessionId },
        query: { directory: projectPath },
      });
      return result.data || [];
    } catch (error) {
      console.error(`Failed to get child sessions for ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Get the current status of all sessions in a project.
   * @param projectPath - Absolute path to the project directory
   * @returns Record mapping session IDs to their status
   */
  async getSessionStatuses(projectPath: string): Promise<Record<string, SessionStatus>> {
    try {
      const result = await this.client.session.status({
        query: { directory: projectPath },
      });
      return result.data || {};
    } catch (error) {
      console.error(`Failed to get session statuses:`, error);
      return {};
    }
  }

  /**
   * Abort an active session.
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Session ID to abort
   * @returns true if aborted successfully, false otherwise
   */
  async abortSession(projectPath: string, sessionId: string): Promise<boolean> {
    try {
      await this.client.session.abort({
        path: { id: sessionId },
        query: { directory: projectPath },
      });
      return true;
    } catch (error) {
      console.error(`Failed to abort session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Respond to a permission request.
   * @param projectPath - Absolute path to the project directory
   * @param sessionId - Session ID with the permission request
   * @param permissionId - ID of the permission to respond to
   * @param response - Response type: "once", "always", or "reject"
   * @returns true if responded successfully, false otherwise
   */
  async respondToPermission(
    projectPath: string,
    sessionId: string,
    permissionId: string,
    response: "once" | "always" | "reject"
  ): Promise<boolean> {
    try {
      await this.client.postSessionIdPermissionsPermissionId({
        path: { id: sessionId, permissionID: permissionId },
        query: { directory: projectPath },
        body: { response },
      });
      return true;
    } catch (error) {
      console.error(`Failed to respond to permission ${permissionId}:`, error);
      return false;
    }
  }

  /**
   * List all pending permission requests for a project.
   * Note: This SDK version doesn't have a dedicated permissions list endpoint.
   * Permissions are typically tracked via SSE events (EventPermissionUpdated).
   * This method returns an empty array - use event subscription for real-time permission tracking.
   * @param projectPath - Absolute path to the project directory
   * @returns Empty array (use event subscription for permission tracking)
   */
  async listPendingPermissions(_projectPath: string): Promise<Permission[]> {
    // The v1 SDK doesn't have a permission.list endpoint.
    // Permissions are tracked via SSE events (EventPermissionUpdated, EventPermissionReplied).
    // Consumers should subscribe to events to track pending permissions in real-time.
    console.warn(
      "listPendingPermissions: SDK v1 does not have a permissions list endpoint. " +
        "Use event subscription (subscribeToEvents) to track pending permissions."
    );
    return [];
  }
}

// Singleton instance for application-wide use
export const openCodeService = new OpenCodeService();
