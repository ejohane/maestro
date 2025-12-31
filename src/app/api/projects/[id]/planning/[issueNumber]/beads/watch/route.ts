// Beads Watch API - Server-Sent Events for real-time bead updates
// GET /api/projects/{id}/planning/{issueNumber}/beads/watch
//
// This endpoint uses file system watching on the `.beads/` directory to detect
// when the AI agent creates or modifies beads, enabling real-time UI updates.

import { watch, FSWatcher } from "fs";
import { access, constants } from "fs/promises";
import path from "path";
import { configService } from "@/lib/services/config";
import { worktreeService } from "@/lib/services/worktree";
import { beadsService, Bead, BeadsError } from "@/lib/services/beads";

// Constants
const DEBOUNCE_MS = 100;
const POLL_INTERVAL_MS = 5000;

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
 * Check if a directory exists and is accessible
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

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
  const beadsDir = path.join(worktreePath, ".beads");

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Track cleanup state
      let isCleanedUp = false;
      let debounceTimer: NodeJS.Timeout | null = null;
      let pollInterval: NodeJS.Timeout | null = null;
      let watcher: FSWatcher | null = null;

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
       */
      async function sendBeadsUpdate(): Promise<void> {
        if (isCleanedUp) return;

        try {
          const beads = await beadsService.list(worktreePath);
          sendEvent({
            type: "update",
            beads,
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

        if (watcher) {
          try {
            watcher.close();
          } catch {
            // Ignore close errors
          }
          watcher = null;
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

        console.log(`[beads-watch] File watching unavailable, falling back to polling (${POLL_INTERVAL_MS}ms)`);

        pollInterval = setInterval(() => {
          if (!isCleanedUp) {
            sendBeadsUpdate();
          }
        }, POLL_INTERVAL_MS);
      }

      /**
       * Set up file watcher for the .beads directory
       */
      async function setupWatcher(): Promise<void> {
        // Check if .beads directory exists
        const beadsDirExists = await directoryExists(beadsDir);

        if (!beadsDirExists) {
          // Directory doesn't exist yet - start polling until it's created
          // This handles the case where planning hasn't started yet
          console.log(`[beads-watch] .beads directory doesn't exist yet, waiting...`);
          startPolling();
          return;
        }

        try {
          // Watch for changes in the .beads directory
          watcher = watch(beadsDir, { recursive: true }, (eventType, filename) => {
            // Ignore non-relevant events
            if (!filename) return;

            // Only react to .json file changes (beads data files)
            if (filename.endsWith(".json") || filename.endsWith(".jsonl")) {
              debouncedSendBeads();
            }
          });

          // Handle watcher errors
          watcher.on("error", (error) => {
            console.error("[beads-watch] Watcher error:", error);

            // Close the broken watcher
            if (watcher) {
              try {
                watcher.close();
              } catch {
                // Ignore
              }
              watcher = null;
            }

            // Fall back to polling
            startPolling();
          });

          // Handle watcher close
          watcher.on("close", () => {
            watcher = null;
            // If not cleaned up, this was unexpected - start polling
            if (!isCleanedUp) {
              startPolling();
            }
          });

          console.log(`[beads-watch] Watching ${beadsDir}`);
        } catch (error) {
          console.error("[beads-watch] Failed to set up watcher:", error);
          // Fall back to polling
          startPolling();
        }
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

      // Set up file watching (or polling fallback)
      await setupWatcher();
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
