import { openCodeService } from "@/lib/services/opencode";
import { configService } from "@/lib/services/config";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  const { id } = await params;

  let body: { message?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, sessionId } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 }
    );
  }

  const project = await configService.getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify session exists before streaming
  const sessionExists = await openCodeService.isSessionAlive(
    project.path,
    sessionId
  );
  if (!sessionExists) {
    return NextResponse.json(
      { error: "Session not found", code: "SESSION_NOT_FOUND" },
      { status: 404 }
    );
  }

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
        // Start async prompt (returns immediately without waiting for response)
        // Use bash-enabled mode to allow gh CLI commands for issue management
        await openCodeService.sendMessageWithBashAsync(
          project.path,
          sessionId,
          message
        );

        // Subscribe to events
        const events = await openCodeService.subscribeToEvents(project.path);
        
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
                delta: event.properties.delta 
              });
            }
            
            // Handle reasoning parts - stream delta
            if (partType === "reasoning" && event.properties?.delta) {
              sendData({ 
                type: "reasoning",
                partId,
                delta: event.properties.delta,
                time: part.time
              });
            }
            
            // Handle tool parts - send full state updates
            if (partType === "tool" && part.state) {
              sendData({ 
                type: "tool",
                partId,
                tool: part.tool,
                callID: part.callID,
                state: part.state
              });
            }
          }

          // Session returned to idle = response complete
          // Filter by sessionId to ensure we're tracking the right session
          // Note: status can be string "idle" or object { type: "idle" }
          if (event.type === "session.status") {
            const status = event.properties?.status;
            const isIdle = status === "idle" || 
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
        sendData({ error: errorMsg });
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
