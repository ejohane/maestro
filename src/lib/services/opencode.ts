// OpenCode SDK Service Wrapper
// Provides typed methods for interacting with OpenCode AI sessions

import { createOpencodeClient, OpencodeClient, TextPart } from "@opencode-ai/sdk";

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
}

// Singleton instance for application-wide use
export const openCodeService = new OpenCodeService();
