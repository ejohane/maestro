import { openCodeService } from "@/lib/services/opencode";
import { configService } from "@/lib/services/config";
import { NextResponse } from "next/server";

interface OpenCodeEventPayload {
  type: string;
  properties?: {
    delta?: string;
    status?: string | { type?: string };
    error?: string;
    sessionID?: string;
    part?: {
      id?: string;
      sessionID?: string;
      messageID?: string;
      type?: string;
    };
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
        await openCodeService.sendReadOnlyMessageAsync(
          project.path,
          sessionId,
          message
        );

        // Subscribe to events
        const events = await openCodeService.subscribeToEvents(project.path);
        
        // Track which part ID we're streaming to avoid duplicates from multiple parts
        let trackedPartId: string | null = null;

        for await (const rawEvent of events) {
          // Events may come wrapped in GlobalEvent with directory and payload
          // or directly as the event payload - handle both cases
          const globalEvent = rawEvent as OpenCodeGlobalEvent;
          const event = globalEvent.payload ?? (rawEvent as OpenCodeEventPayload);
          
          if (!event || !event.type) continue;

          // Handle text delta updates - filter by sessionId and partId
          if (
            event.type === "message.part.updated" &&
            event.properties?.delta
          ) {
            // Only process events for our specific session
            const eventSessionId = event.properties?.part?.sessionID;
            if (eventSessionId && eventSessionId !== sessionId) {
              continue; // Skip events from other sessions
            }
            
            // Only process text parts (ignore reasoning, tool, etc.)
            if (event.properties?.part?.type !== "text") {
              continue;
            }
            
            // Track the first text part we see and only stream that one
            const partId = event.properties?.part?.id;
            if (!trackedPartId && partId) {
              trackedPartId = partId;
            }
            
            // Only stream deltas from the tracked part to avoid duplicates
            if (partId && trackedPartId && partId !== trackedPartId) {
              continue;
            }
            
            sendData({ delta: event.properties.delta });
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
