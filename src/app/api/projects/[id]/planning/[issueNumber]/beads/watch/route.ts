// Beads Watch API - Server-Sent Events for real-time bead updates
// GET /api/projects/{id}/planning/{issueNumber}/beads/watch
//
// This endpoint uses the `bd activity --follow` subprocess to receive real-time
// bead mutation events. When the AI agent creates or modifies beads, events are
// streamed via NDJSON and trigger UI updates.
//
// Architecture:
// - Spawns `bd activity --follow --json --since 0s` subprocess
// - Parses NDJSON events (one JSON object per line)
// - Triggers debounced bead list refresh on any mutation event
// - Automatic restart with backoff on subprocess failure
// - Falls back to 5-second polling if subprocess repeatedly fails
//
// Why subprocess instead of fs.watch:
// - Worktrees share the main repo's .beads/ directory (no local .beads/)
// - bd activity watches SQLite mutations directly, not file exports
// - No platform-specific inotify/FSEvents issues
// - Semantic events (create/update/delete) instead of raw file changes

import { spawn, ChildProcess } from "child_process";
import { configService } from "@/lib/services/config";
import { worktreeService } from "@/lib/services/worktree";
import { beadsService, Bead, BeadsError } from "@/lib/services/beads";
import { getBeadsForIssue } from "@/lib/services/beads-utils";

// Constants
const DEBOUNCE_MS = 100;
const POLL_INTERVAL_MS = 5000;
const RESTART_DELAY_MS = 1000;      // Base delay before restart
const MAX_RESTART_ATTEMPTS = 5;      // Max restarts before polling fallback

interface BeadsUpdateEvent {
  type: "update";
  beads: Bead[];
  timestamp: string;
}

interface BeadsErrorEvent {
  type: "error";
  error: string;
  code?: string;
}

interface BeadsConnectedEvent {
  type: "connected";
  timestamp: string;
}

type BeadsEvent = BeadsUpdateEvent | BeadsErrorEvent | BeadsConnectedEvent;

/**
 * GET /api/projects/{id}/planning/{issueNumber}/beads/watch
 *
 * Server-Sent Events endpoint for real-time bead updates.
 * Watches the .beads/ directory for changes and streams updates to clients.
 *
 * Falls back to polling if file watching is unavailable.
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
    return new Response(
      JSON.stringify({ error: "Invalid issue number" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get project
  const project = await configService.getProject(projectId);
  if (!project) {
    return new Response(
      JSON.stringify({ error: "Project not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get worktree
  const worktree = await worktreeService.getWorktree(project.path, issueNumber);
  if (!worktree) {
    return new Response(
      JSON.stringify({ error: "Worktree not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const worktreePath = worktree.path;

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Track cleanup state
      let isCleanedUp = false;
      let debounceTimer: NodeJS.Timeout | null = null;
      let pollInterval: NodeJS.Timeout | null = null;
      // Subprocess tracking
      let activityProc: ChildProcess | null = null;  // Subprocess handle
      let lineBuffer = "";                           // Buffer for incomplete NDJSON lines
      let restartAttempts = 0;                       // Track restart attempts for backoff

      /**
       * Send an SSE event to the client
       */
      function sendEvent(event: BeadsEvent): void {
        if (isCleanedUp) return;

        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          // Stream might be closed, ignore encoding errors
          console.error("Failed to send SSE event:", error);
        }
      }

      /**
       * Fetch current beads and send update event
       * Only sends beads that belong to this issue's epic tree
       */
      async function sendBeadsUpdate(): Promise<void> {
        if (isCleanedUp) return;

        try {
          // Fetch all beads from shared database
          const allBeads = await beadsService.list(worktreePath);
          
          // Filter to only beads that belong to this issue's epic
          // Returns empty array if no epic found yet (don't show other issues' beads)
          const issueBeads = getBeadsForIssue(allBeads, issueNumber);
          
          sendEvent({
            type: "update",
            beads: issueBeads,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Failed to fetch beads:", error);

          if (error instanceof BeadsError) {
            sendEvent({
              type: "error",
              error: error.message,
              code: error.code,
            });
          } else {
            sendEvent({
              type: "error",
              error: "Failed to fetch beads",
            });
          }
        }
      }

      /**
       * Debounced version of sendBeadsUpdate
       */
      function debouncedSendBeads(): void {
        if (isCleanedUp) return;

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          sendBeadsUpdate();
        }, DEBOUNCE_MS);
      }

      /**
       * Clean up all resources
       */
      function cleanup(): void {
        if (isCleanedUp) return;
        isCleanedUp = true;

        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }

        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }

        // Kill the activity subprocess
        if (activityProc) {
          activityProc.kill("SIGTERM");
          activityProc = null;
        }

        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      }

      /**
       * Start polling as fallback when file watching is unavailable
       */
      function startPolling(): void {
        if (isCleanedUp || pollInterval) return;

        console.log(`[beads-watch] Falling back to polling (${POLL_INTERVAL_MS}ms)`);

        pollInterval = setInterval(() => {
          if (!isCleanedUp) {
            sendBeadsUpdate();
          }
        }, POLL_INTERVAL_MS);
      }

      /**
       * Start bd activity subprocess for real-time bead updates
       */
      function startActivityStream(): void {
        if (isCleanedUp) return;

        // Use --since 0s to skip historical events, only receive new ones
        activityProc = spawn("bd", ["activity", "--follow", "--json", "--since", "0s"], {
          cwd: worktreePath,
          stdio: ["ignore", "pipe", "pipe"],
        });

        // Track successful operation to reset restart counter
        let hasReceivedData = false;

        // Handle stdout (NDJSON event stream)
        activityProc.stdout?.on("data", (data: Buffer) => {
          if (isCleanedUp) return;

          // First data received = process is working, reset restart counter
          if (!hasReceivedData) {
            hasReceivedData = true;
            restartAttempts = 0;  // Reset on successful operation
          }

          // Append to line buffer and parse complete lines
          lineBuffer += data.toString();
          const lines = lineBuffer.split("\n");
          
          // Keep incomplete last line in buffer
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              // Parse to validate JSON
              // Any valid event means something changed - trigger refresh
              JSON.parse(trimmed);
              debouncedSendBeads();
            } catch {
              // Not valid JSON - might be a partial line or log message
              // Ignore silently
            }
          }
        });

        // Handle stderr (warnings/errors from bd)
        activityProc.stderr?.on("data", (data: Buffer) => {
          // Log but don't treat as fatal - bd may output warnings
          console.warn("[beads-watch] bd stderr:", data.toString().trim());
        });

        // Handle spawn error (e.g., bd not found)
        activityProc.on("error", (err) => {
          console.error("[beads-watch] Activity process spawn error:", err);
          activityProc = null;

          if (!isCleanedUp) {
            sendEvent({ type: "error", error: "Activity stream failed to start" });
            startPolling();
          }
        });

        // Handle process exit
        activityProc.on("close", (code) => {
          activityProc = null;
          if (isCleanedUp) return;

          console.log(`[beads-watch] Activity process exited with code ${code}`);

          // Attempt restart with linear backoff
          if (restartAttempts < MAX_RESTART_ATTEMPTS) {
            restartAttempts++;
            const delay = RESTART_DELAY_MS * restartAttempts;
            console.log(`[beads-watch] Restarting in ${delay}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})`);
            
            setTimeout(() => {
              if (!isCleanedUp) startActivityStream();
            }, delay);
          } else {
            console.error("[beads-watch] Max restart attempts reached, falling back to polling");
            startPolling();
          }
        });

        console.log(`[beads-watch] Started bd activity --follow for ${worktreePath}`);
      }

      // Handle request abort (client disconnect)
      request.signal.addEventListener("abort", () => {
        console.log("[beads-watch] Client disconnected");
        cleanup();
      });

      // Send connected event
      sendEvent({
        type: "connected",
        timestamp: new Date().toISOString(),
      });

      // Send initial beads state
      await sendBeadsUpdate();

      // Start the bd activity stream for real-time updates
      startActivityStream();
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
