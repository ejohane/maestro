import { openCodeService } from "@/lib/services/opencode";
import { configService } from "@/lib/services/config";
import { sessionStorage } from "@/lib/services/sessions";
import { NextResponse } from "next/server";

interface ToolState {
  status: "pending" | "running" | "completed" | "error";
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  time?: { start?: number; end?: number };
}

interface OpenCodePart {
  id?: string;
  sessionID?: string;
  messageID?: string;
  type?: string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: ToolState;
  time?: { start?: number; end?: number };
}

interface OpenCodeEventPayload {
  type: string;
  properties?: {
    delta?: string;
    status?: string | { type?: string };
    error?: string;
    sessionID?: string;
    part?: OpenCodePart;
  };
}

interface OpenCodeGlobalEvent {
  directory: string;
  payload: OpenCodeEventPayload;
}

interface BeadContext {
  id: string;
  title: string;
}

interface ChatRequestBody {
  message?: string;
  beadContext?: BeadContext;
}

/**
 * Build a contextual message that includes bead context and worktree reminder
 */
function buildContextualMessage(
  message: string,
  worktreePath: string,
  beadContext?: BeadContext
): string {
  const parts: string[] = [];
  
  // Always include worktree reminder
  parts.push(`[Working Directory: ${worktreePath}]`);
  
  // Add bead context if provided
  if (beadContext) {
    parts.push(`[Context: Working on bead "${beadContext.title}" (ID: ${beadContext.id})]`);
  }
  
  parts.push("");
  parts.push(message);
  
  return parts.join("\n");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  const resolvedParams = await params;
  const { id, issueNumber } = resolvedParams;

  // Parse request body
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, beadContext } = body;

  // Validate message
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Validate project exists
  const project = await configService.getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get planning session
  const session = await sessionStorage.getPlanningSession(id, parseInt(issueNumber));
  if (!session) {
    return NextResponse.json(
      { error: "No planning session found", code: "PLANNING_SESSION_NOT_FOUND" },
      { status: 404 }
    );
  }

  const { sessionId, worktreePath } = session;

  // Verify session is still alive in OpenCode
  const sessionExists = await openCodeService.isSessionAlive(worktreePath, sessionId);
  if (!sessionExists) {
    return NextResponse.json(
      { error: "Planning session expired", code: "SESSION_EXPIRED" },
      { status: 410 }
    );
  }

  // Build message with worktree context and optional bead context
  const fullMessage = buildContextualMessage(message, worktreePath, beadContext);

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendData = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const sendDone = () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      };

      try {
        // Start async prompt with full tool access (planning mode)
        await openCodeService.sendPlanningMessageAsync(
          worktreePath,
          sessionId,
          fullMessage
        );

        // Subscribe to events (use worktreePath as that's the session directory)
        const events = await openCodeService.subscribeToEvents(worktreePath);

        // Track parts by ID to avoid duplicate streaming
        const trackedParts = new Map<string, string>(); // partId -> partType

        for await (const rawEvent of events) {
          // Events may come wrapped in GlobalEvent with directory and payload
          // or directly as the event payload - handle both cases
          const globalEvent = rawEvent as OpenCodeGlobalEvent;
          const event = globalEvent.payload ?? (rawEvent as OpenCodeEventPayload);

          if (!event || !event.type) continue;

          // Handle part updates
          if (event.type === "message.part.updated") {
            const part = event.properties?.part;
            if (!part) continue;

            // Only process events for our specific session
            const eventSessionId = part.sessionID;
            if (eventSessionId && eventSessionId !== sessionId) {
              continue; // Skip events from other sessions
            }

            const partId = part.id;
            const partType = part.type;

            if (!partId || !partType) continue;

            // Track this part
            if (!trackedParts.has(partId)) {
              trackedParts.set(partId, partType);
            }

            // Handle text parts - stream delta
            if (partType === "text" && event.properties?.delta) {
              sendData({
                type: "text",
                partId,
                delta: event.properties.delta,
              });
            }

            // Handle reasoning parts - stream delta
            if (partType === "reasoning" && event.properties?.delta) {
              sendData({
                type: "reasoning",
                partId,
                delta: event.properties.delta,
                time: part.time,
              });
            }

            // Handle tool parts - send full state updates
            if (partType === "tool" && part.state) {
              sendData({
                type: "tool",
                partId,
                tool: part.tool,
                callID: part.callID,
                state: part.state,
              });
            }
          }

          // Session returned to idle = response complete
          // Filter by sessionId to ensure we're tracking the right session
          // Note: status can be string "idle" or object { type: "idle" }
          if (event.type === "session.status") {
            const status = event.properties?.status;
            const isIdle =
              status === "idle" ||
              (typeof status === "object" && status?.type === "idle");

            if (isIdle) {
              const eventSessionId = event.properties?.sessionID;
              if (eventSessionId && eventSessionId !== sessionId) {
                continue; // Skip status events from other sessions
              }
              sendDone();
              controller.close();
              break;
            }
          }

          // Handle errors - filter by sessionId
          if (event.type === "session.error") {
            const eventSessionId = event.properties?.sessionID;
            if (eventSessionId && eventSessionId !== sessionId) {
              continue; // Skip errors from other sessions
            }
            sendData({ error: event.properties?.error || "Session error" });
            controller.close();
            break;
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        
        // Check if it's an OpenCode connection error
        if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("fetch failed")) {
          sendData({ error: "OpenCode service unavailable", code: "SERVICE_UNAVAILABLE" });
        } else {
          sendData({ error: errorMsg });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
