// Messages Watch API - Server-Sent Events for real-time message updates
// GET /api/projects/{id}/planning/{issueNumber}/messages/watch
//
// This endpoint uses OpenCode's event subscription to detect when the AI agent
// sends new messages, enabling real-time chat UI updates.

import { configService } from "@/lib/services/config";
import { worktreeService } from "@/lib/services/worktree";
import { sessionStorage } from "@/lib/services/sessions";
import { openCodeService } from "@/lib/services/opencode";

// Constants
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds as fallback
const HEARTBEAT_INTERVAL_MS = 30000; // Send heartbeat every 30 seconds

interface MessagesUpdateEvent {
  type: "update";
  messages: unknown[];
  timestamp: string;
}

interface MessagesErrorEvent {
  type: "error";
  error: string;
}

interface MessagesConnectedEvent {
  type: "connected";
  timestamp: string;
}

interface MessagesHeartbeatEvent {
  type: "heartbeat";
  timestamp: string;
}

type MessagesEvent =
  | MessagesUpdateEvent
  | MessagesErrorEvent
  | MessagesConnectedEvent
  | MessagesHeartbeatEvent;

/**
 * GET /api/projects/{id}/planning/{issueNumber}/messages/watch
 *
 * Server-Sent Events endpoint for real-time message updates.
 * Polls the OpenCode session for new messages and streams updates to clients.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
): Promise<Response> {
  // Resolve params
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  const issueNumber = parseInt(resolvedParams.issueNumber, 10);

  // Validate issue number
  if (isNaN(issueNumber) || issueNumber <= 0) {
    return new Response(JSON.stringify({ error: "Invalid issue number" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get project
  const project = await configService.getProject(projectId);
  if (!project) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get worktree
  const worktree = await worktreeService.getWorktree(project.path, issueNumber);
  if (!worktree) {
    return new Response(JSON.stringify({ error: "Worktree not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get planning session
  const planningSession = await sessionStorage.getPlanningSession(
    projectId,
    issueNumber
  );
  if (!planningSession) {
    return new Response(
      JSON.stringify({ error: "No planning session found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const worktreePath = worktree.path;
  const sessionId = planningSession.sessionId;

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Track cleanup state
      let isCleanedUp = false;
      let pollInterval: NodeJS.Timeout | null = null;
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let lastMessageCount = 0;
      let lastMessageHash = "";

      /**
       * Send an SSE event to the client
       */
      function sendEvent(event: MessagesEvent): void {
        if (isCleanedUp) return;

        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          // Stream might be closed, ignore encoding errors
          console.error("[messages-watch] Failed to send SSE event:", error);
        }
      }

      /**
       * Create a simple hash of messages for change detection
       */
      function hashMessages(messages: unknown[]): string {
        // Use message count and last message ID/content as a simple hash
        if (messages.length === 0) return "empty";

        const lastMsg = messages[messages.length - 1] as {
          info?: { id?: string };
          parts?: unknown[];
        };
        const lastMsgId = lastMsg?.info?.id || "unknown";
        const partsCount = lastMsg?.parts?.length || 0;

        return `${messages.length}-${lastMsgId}-${partsCount}`;
      }

      /**
       * Fetch current messages and send update event if changed
       */
      async function checkForUpdates(): Promise<void> {
        if (isCleanedUp) return;

        try {
          const messages = await openCodeService.getSessionMessages(
            worktreePath,
            sessionId
          );

          const currentHash = hashMessages(messages);

          // Only send update if messages have changed
          if (
            currentHash !== lastMessageHash ||
            messages.length !== lastMessageCount
          ) {
            lastMessageHash = currentHash;
            lastMessageCount = messages.length;

            sendEvent({
              type: "update",
              messages,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("[messages-watch] Failed to fetch messages:", error);
          sendEvent({
            type: "error",
            error: "Failed to fetch messages",
          });
        }
      }

      /**
       * Clean up all resources
       */
      function cleanup(): void {
        if (isCleanedUp) return;
        isCleanedUp = true;

        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }

        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      }

      // Handle request abort (client disconnect)
      request.signal.addEventListener("abort", () => {
        console.log("[messages-watch] Client disconnected");
        cleanup();
      });

      // Send connected event
      sendEvent({
        type: "connected",
        timestamp: new Date().toISOString(),
      });

      // Send initial messages state
      await checkForUpdates();

      // Start polling for updates
      pollInterval = setInterval(() => {
        if (!isCleanedUp) {
          checkForUpdates();
        }
      }, POLL_INTERVAL_MS);

      // Start heartbeat to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (!isCleanedUp) {
          sendEvent({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
          });
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
