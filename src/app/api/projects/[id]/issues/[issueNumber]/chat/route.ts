import { openCodeService } from "@/lib/services/opencode";
import { configService } from "@/lib/services/config";
import { NextResponse } from "next/server";

interface OpenCodeEvent {
  type: string;
  properties?: {
    delta?: string;
    status?: string;
    error?: string;
  };
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

        for await (const rawEvent of events) {
          const event = rawEvent as OpenCodeEvent;

          // Handle text delta updates
          if (
            event.type === "message.part.updated" &&
            event.properties?.delta
          ) {
            sendData({ delta: event.properties.delta });
          }

          // Session returned to idle = response complete
          if (
            event.type === "session.status" &&
            event.properties?.status === "idle"
          ) {
            sendDone();
            controller.close();
            break;
          }

          // Handle errors
          if (event.type === "session.error") {
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
