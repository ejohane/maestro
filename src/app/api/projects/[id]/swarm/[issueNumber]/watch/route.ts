// Swarm Watch API - Server-Sent Events for real-time swarm updates
// GET /api/projects/{id}/swarm/{issueNumber}/watch
//
// This endpoint streams real-time swarm events to the frontend.
// It uses OpenCode's event subscription to:
// - Track agent lifecycle (created, status changes)
// - Forward permission requests
// - Monitor orchestrator status
// - Calculate progress from beads
//
// Architecture:
// - Subscribes to OpenCode event stream (subscribeToEvents)
// - Filters events to only those relevant to this swarm
// - Tracks child sessions (agents) of the orchestrator
// - Sends SSE events with typed payloads

import { NextRequest } from "next/server";
import { configService } from "@/lib/services/config";
import { sessionStorage } from "@/lib/services/sessions";
import { openCodeService } from "@/lib/services/opencode";
import { beadsService, Bead } from "@/lib/services/beads";
import { getBeadsForEpic } from "@/lib/services/beads-utils";
import type { SwarmProgress, AgentStatus } from "@/lib/types/api";

// Constants
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
const PROGRESS_CHECK_INTERVAL_MS = 5000; // 5 seconds

interface RouteParams {
  params: Promise<{ id: string; issueNumber: string }>;
}

// Internal types for tracking state
interface AgentInfo {
  status: AgentStatus;
  title: string;
}

// Raw event types from OpenCode subscription
interface OpenCodeEventBase {
  type: string;
  properties?: Record<string, unknown>;
}

interface SessionInfo {
  id: string;
  parentID?: string;
  title?: string;
}

interface SessionCreatedEvent extends OpenCodeEventBase {
  type: "session.created";
  properties: {
    info: SessionInfo;
  };
}

interface SessionUpdatedEvent extends OpenCodeEventBase {
  type: "session.updated";
  properties: {
    info: SessionInfo;
  };
}

interface SessionStatusEvent extends OpenCodeEventBase {
  type: "session.status";
  properties: {
    sessionID: string;
    status: {
      type: string; // "busy", "idle", "retry"
      running?: boolean;
    };
  };
}

interface PermissionUpdatedEvent extends OpenCodeEventBase {
  type: "permission.updated";
  properties: {
    id: string;
    sessionID: string;
    type: string;
    pattern?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    status?: string; // "pending", "allowed", "rejected"
  };
}

interface MessagePartUpdatedEvent extends OpenCodeEventBase {
  type: "message.part.updated";
  properties: {
    sessionID: string;
    messageID: string;
    part: {
      type: string;
      tool?: string;
      state?: {
        status?: string;
        title?: string;
      };
    };
  };
}

type OpenCodeEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SessionStatusEvent
  | PermissionUpdatedEvent
  | MessagePartUpdatedEvent
  | OpenCodeEventBase;

/**
 * Calculate progress from beads under an epic
 */
function calculateProgress(beads: Bead[]): SwarmProgress {
  // Only count tasks (not the epic itself)
  const tasks = beads.filter((b) => b.type === "task");
  const total = tasks.length;
  const completed = tasks.filter((b) => b.status === "closed").length;
  const inProgress = tasks.filter((b) => b.status === "in_progress").length;
  const pending = tasks.filter((b) => b.status === "open").length;

  return {
    total,
    completed,
    inProgress,
    pending,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Map OpenCode status type to AgentStatus
 */
function mapStatus(openCodeStatus: string): AgentStatus {
  switch (openCodeStatus) {
    case "busy":
      return "busy";
    case "idle":
      return "idle";
    case "retry":
      return "error";
    default:
      return "idle";
  }
}

/**
 * GET /api/projects/{id}/swarm/{issueNumber}/watch
 *
 * Server-Sent Events endpoint for real-time swarm updates.
 * Streams agent lifecycle events, permission requests, and progress updates.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
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

  // Get swarm session
  const swarmSession = await sessionStorage.getSwarmSession(
    projectId,
    issueNumber
  );
  if (!swarmSession) {
    return new Response(
      JSON.stringify({ error: "No swarm session found for this issue" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { worktreePath, sessionId: orchestratorSessionId, epicId } = swarmSession;

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Track cleanup state
      let isCleanedUp = false;
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let progressInterval: NodeJS.Timeout | null = null;

      // Track known agents (child sessions of orchestrator)
      const knownAgents = new Map<string, AgentInfo>();

      // Track last progress hash to avoid duplicate updates
      let lastProgressHash = "";

      /**
       * Send an SSE event to the client
       */
      function send(eventType: string, data: object): void {
        if (isCleanedUp) return;

        try {
          const event = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(event));
        } catch (error) {
          console.error("[swarm-watch] Failed to send SSE event:", error);
        }
      }

      /**
       * Send a heartbeat event
       */
      function sendHeartbeat(): void {
        send("heartbeat", { timestamp: Date.now() });
      }

      /**
       * Fetch and send progress update if changed
       */
      async function checkAndSendProgress(): Promise<void> {
        if (isCleanedUp) return;

        try {
          const allBeads = await beadsService.list(worktreePath);
          const epicBeads = getBeadsForEpic(allBeads, epicId);
          const progress = calculateProgress(epicBeads);

          // Create hash to detect changes
          const progressHash = `${progress.completed}/${progress.total}`;

          if (progressHash !== lastProgressHash) {
            lastProgressHash = progressHash;
            send("progress.updated", progress);

            // Check for completion
            if (progress.percentage === 100 && progress.total > 0) {
              send("swarm.completed", {
                completedAt: new Date().toISOString(),
              });

              // Update session status
              await sessionStorage.updateSwarmStatus(
                projectId,
                issueNumber,
                "completed"
              );
            }
          }
        } catch (error) {
          console.error("[swarm-watch] Failed to check progress:", error);
        }
      }

      /**
       * Clean up all resources
       */
      function cleanup(): void {
        if (isCleanedUp) return;
        isCleanedUp = true;

        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      }

      /**
       * Process an OpenCode event and send appropriate SSE event
       */
      function processEvent(rawEvent: unknown): void {
        if (isCleanedUp) return;

        const event = rawEvent as OpenCodeEvent;

        switch (event.type) {
          case "session.created": {
            const sessionEvent = event as SessionCreatedEvent;
            const session = sessionEvent.properties?.info;
            if (!session) break;

            // Only track child sessions of our orchestrator
            if (session.parentID === orchestratorSessionId) {
              const title = session.title || session.id.slice(0, 8);
              knownAgents.set(session.id, { status: "idle", title });
              send("agent.created", {
                sessionId: session.id,
                title,
                status: "idle",
              });
            }
            break;
          }

          case "session.updated": {
            const sessionEvent = event as SessionUpdatedEvent;
            const session = sessionEvent.properties?.info;
            if (!session) break;

            // Update title if changed
            if (knownAgents.has(session.id) && session.title) {
              const agent = knownAgents.get(session.id)!;
              agent.title = session.title;
            }
            break;
          }

          case "session.status": {
            const statusEvent = event as SessionStatusEvent;
            const props = statusEvent.properties;
            if (!props) break;

            const { sessionID, status } = props;

            // Track both orchestrator and child agents
            if (sessionID === orchestratorSessionId) {
              const mappedStatus = mapStatus(status.type);
              send("orchestrator.status", {
                sessionId: orchestratorSessionId,
                status: mappedStatus,
                epicId,
              });

              // If orchestrator becomes idle unexpectedly, might indicate error
              if (status.type === "retry") {
                send("swarm.error", {
                  error: "Orchestrator encountered an error and is retrying",
                });
              }
            } else if (knownAgents.has(sessionID)) {
              const mappedStatus = mapStatus(status.type);
              const agent = knownAgents.get(sessionID)!;
              agent.status = mappedStatus;
              send("agent.status", {
                sessionId: sessionID,
                status: mappedStatus,
              });
            }
            break;
          }

          case "permission.updated": {
            const permEvent = event as PermissionUpdatedEvent;
            const props = permEvent.properties;
            if (!props) break;

            const { id, sessionID, status } = props;

            // Only forward permissions for our agents
            if (!knownAgents.has(sessionID)) break;

            if (status === "pending") {
              // New permission request
              send("permission.requested", {
                id,
                sessionId: sessionID,
                type: props.type,
                pattern: props.pattern,
                title: props.title || `Permission request: ${props.type}`,
                metadata: props.metadata || {},
                requestedAt: new Date().toISOString(),
              });
            } else {
              // Permission was resolved (allowed or rejected)
              send("permission.resolved", {
                sessionId: sessionID,
                permissionId: id,
              });
            }
            break;
          }

          case "message.part.updated": {
            const msgEvent = event as MessagePartUpdatedEvent;
            const props = msgEvent.properties;
            if (!props) break;

            const { sessionID, part } = props;

            // Only track tool activity for our agents
            if (!knownAgents.has(sessionID)) break;

            if (part.type === "tool" && part.state?.status === "running") {
              const toolName = part.tool || "tool";
              const activity = part.state.title || `Using ${toolName}...`;
              send("agent.activity", {
                sessionId: sessionID,
                activity,
              });
            }
            break;
          }

          default:
            // Ignore unknown event types
            break;
        }
      }

      // Handle request abort (client disconnect)
      request.signal.addEventListener("abort", () => {
        console.log("[swarm-watch] Client disconnected");
        cleanup();
      });

      try {
        // 1. Get initial child sessions
        const children = await openCodeService.getChildSessions(
          worktreePath,
          orchestratorSessionId
        );

        // 2. Send connected event
        send("connected", {
          orchestratorSessionId,
          agentCount: children.length,
        });

        // 3. Send initial agent states
        for (const child of children) {
          const title = child.title || child.id.slice(0, 8);
          knownAgents.set(child.id, { status: "idle", title });
          send("agent.created", {
            sessionId: child.id,
            title,
            status: "idle",
          });
        }

        // 4. Send initial progress
        await checkAndSendProgress();

        // 5. Start heartbeat
        heartbeatInterval = setInterval(() => {
          if (!isCleanedUp) sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);

        // 6. Start periodic progress check
        progressInterval = setInterval(() => {
          if (!isCleanedUp) checkAndSendProgress();
        }, PROGRESS_CHECK_INTERVAL_MS);

        // 7. Subscribe to OpenCode events
        const eventStream = await openCodeService.subscribeToEvents(worktreePath);

        // Process events from the stream
        for await (const event of eventStream) {
          if (request.signal.aborted || isCleanedUp) break;
          processEvent(event);
        }
      } catch (error) {
        console.error("[swarm-watch] Error in event stream:", error);

        if (!isCleanedUp) {
          send("swarm.error", {
            error:
              error instanceof Error
                ? error.message
                : "Failed to connect to event stream",
          });
        }
      } finally {
        cleanup();
      }
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
