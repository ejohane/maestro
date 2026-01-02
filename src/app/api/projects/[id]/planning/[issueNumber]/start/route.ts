import { configService } from "@/lib/services/config";
import { addPlanningLabel } from "@/lib/services/github-labels";
import { openCodeService } from "@/lib/services/opencode";
import { sessionStorage } from "@/lib/services/sessions";
import { worktreeService, WorktreeInfo } from "@/lib/services/worktree";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Pipeline step definitions
type StepId = "create_worktree" | "install_deps" | "create_session" | "send_prompt";
type StepStatus = "pending" | "in_progress" | "completed" | "skipped" | "error";

interface StepEvent {
  id: StepId;
  status: StepStatus;
  name: string;
  error?: string;
  sessionId?: string;
  worktreePath?: string;
}

interface CompleteEvent {
  sessionId: string;
  worktreePath: string;
}

interface ErrorEvent {
  error: string;
  details?: string;
}

// Step metadata
const STEPS: Record<StepId, { name: string }> = {
  create_worktree: { name: "Creating git worktree" },
  install_deps: { name: "Installing dependencies" },
  create_session: { name: "Creating OpenCode session" },
  send_prompt: { name: "Sending initial planning prompt" },
};

/**
 * POST /api/projects/[id]/planning/[issueNumber]/start
 * 
 * Starts the planning mode setup pipeline with SSE progress streaming.
 * 
 * Request body:
 * - issueTitle: string - Title of the issue for branch naming
 * 
 * SSE Events:
 * - event: step - Progress update for a pipeline step
 * - event: complete - Pipeline completed successfully
 * - event: error - Pipeline failed with error
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
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

  // Parse request body
  let issueTitle: string;
  try {
    const body = await request.json();
    issueTitle = body.issueTitle;
    if (!issueTitle || typeof issueTitle !== "string") {
      return new Response(
        JSON.stringify({ error: "issueTitle is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get project from config
  const project = await configService.getProject(projectId);
  if (!project) {
    return new Response(
      JSON.stringify({ error: "Project not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function sendStepEvent(step: StepEvent) {
        const data = `event: step\ndata: ${JSON.stringify(step)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      function sendCompleteEvent(data: CompleteEvent) {
        const event = `event: complete\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(event));
      }

      function sendErrorEvent(data: ErrorEvent) {
        const event = `event: error\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(event));
      }

      try {
        let worktreeInfo: WorktreeInfo;
        let sessionId: string;

        // ============================================================
        // Step 1: Create worktree (or resume existing)
        // ============================================================
        const existingWorktree = await worktreeService.getWorktree(
          project.path,
          issueNumber
        );

        if (existingWorktree) {
          // Resume existing worktree
          sendStepEvent({
            id: "create_worktree",
            status: "skipped",
            name: STEPS.create_worktree.name,
          });
          worktreeInfo = existingWorktree;
        } else {
          // Create new worktree
          sendStepEvent({
            id: "create_worktree",
            status: "in_progress",
            name: STEPS.create_worktree.name,
          });

          try {
            worktreeInfo = await worktreeService.createWorktree(
              project.path,
              issueNumber,
              issueTitle
            );
            sendStepEvent({
              id: "create_worktree",
              status: "completed",
              name: STEPS.create_worktree.name,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            sendStepEvent({
              id: "create_worktree",
              status: "error",
              name: STEPS.create_worktree.name,
              error: message,
            });
            sendErrorEvent({
              error: "Failed to create worktree",
              details: message,
            });
            controller.close();
            return;
          }
        }

        // ============================================================
        // Step 2: Install dependencies
        // ============================================================
        const depsInstalled = await worktreeService.areDepsInstalled(
          project.path,
          issueNumber
        );

        if (depsInstalled) {
          // Skip - deps already installed
          sendStepEvent({
            id: "install_deps",
            status: "skipped",
            name: STEPS.install_deps.name,
          });
        } else {
          // Install dependencies
          sendStepEvent({
            id: "install_deps",
            status: "in_progress",
            name: STEPS.install_deps.name,
          });

          try {
            await execAsync("bun install", {
              cwd: worktreeInfo.path,
              timeout: 120000, // 2 minute timeout for deps
            });
            await worktreeService.markDepsInstalled(project.path, issueNumber);
            sendStepEvent({
              id: "install_deps",
              status: "completed",
              name: STEPS.install_deps.name,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            sendStepEvent({
              id: "install_deps",
              status: "error",
              name: STEPS.install_deps.name,
              error: message,
            });
            sendErrorEvent({
              error: "Failed to install dependencies",
              details: message,
            });
            controller.close();
            return;
          }
        }

        // ============================================================
        // Step 3: Create session (or resume existing)
        // ============================================================
        const existingSession = await sessionStorage.getPlanningSession(
          projectId,
          issueNumber
        );

        let sessionAlive = false;
        if (existingSession) {
          // Check if session is still alive
          sessionAlive = await openCodeService.isSessionAlive(
            worktreeInfo.path,
            existingSession.sessionId
          );
        }

        if (existingSession && sessionAlive) {
          // Resume existing session
          sendStepEvent({
            id: "create_session",
            status: "skipped",
            name: STEPS.create_session.name,
          });
          sessionId = existingSession.sessionId;

          // Skip sending prompt since session already exists
          sendStepEvent({
            id: "send_prompt",
            status: "skipped",
            name: STEPS.send_prompt.name,
          });
        } else {
          // Create new session
          sendStepEvent({
            id: "create_session",
            status: "in_progress",
            name: STEPS.create_session.name,
          });

          try {
            const sessionTitle = `Planning: Issue #${issueNumber} - ${issueTitle}`;
            const result = await openCodeService.createPlanningSession(
              worktreeInfo.path,
              sessionTitle
            );
            sessionId = result.id;

            // Save session mapping
            await sessionStorage.savePlanningSession(
              projectId,
              project.path,
              issueNumber,
              sessionId,
              worktreeInfo.path
            );

            // Add planning label to GitHub issue
            // This is non-fatal - planning works even if label fails
            try {
              await addPlanningLabel(project.path, issueNumber);
            } catch (err) {
              // Log warning but dont fail the pipeline
              // Label is for filtering convenience, not core functionality
              console.warn(
                `[Planning Start] Failed to add planning label to issue #${issueNumber}:`,
                err instanceof Error ? err.message : err
              );
            }

            // Inject worktree context into the session so the AI knows where to work
            const worktreeContext = `<system-reminder>
IMPORTANT: You are working in a git worktree, NOT the main repository.

Working Directory: ${worktreeInfo.path}
Git Branch: ${worktreeInfo.branch}
Issue Number: ${issueNumber}

All file operations, bash commands, and git operations MUST be performed in this worktree directory (${worktreeInfo.path}), not the main repository. The main repository is located elsewhere and should not be modified.

CRITICAL FOR BEADS: You MUST use the \`bd\` CLI via bash for all beads operations. Do NOT use the built-in beads_* tools (beads_create, beads_update, beads_create_epic, etc.) as they may target the wrong database. Always run \`bd\` commands in the current working directory.

When running any commands, ensure you are operating within this worktree path.
</system-reminder>`;

            await openCodeService.injectContext(
              worktreeInfo.path,
              sessionId,
              worktreeContext
            );

            sendStepEvent({
              id: "create_session",
              status: "completed",
              name: STEPS.create_session.name,
              sessionId,
              worktreePath: worktreeInfo.path,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            sendStepEvent({
              id: "create_session",
              status: "error",
              name: STEPS.create_session.name,
              error: message,
            });
            sendErrorEvent({
              error: "Failed to create session",
              details: message,
            });
            controller.close();
            return;
          }

          // ============================================================
          // Step 4: Send initial planning prompt
          // ============================================================
          sendStepEvent({
            id: "send_prompt",
            status: "in_progress",
            name: STEPS.send_prompt.name,
          });

          try {
            await openCodeService.sendPlanningCommand(
              worktreeInfo.path,
              sessionId,
              "turn_gh_issue_into_beads",
              String(issueNumber)
            );

            sendStepEvent({
              id: "send_prompt",
              status: "completed",
              name: STEPS.send_prompt.name,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            sendStepEvent({
              id: "send_prompt",
              status: "error",
              name: STEPS.send_prompt.name,
              error: message,
            });
            sendErrorEvent({
              error: "Failed to send planning prompt",
              details: message,
            });
            controller.close();
            return;
          }
        }

        // ============================================================
        // Pipeline complete
        // ============================================================
        sendCompleteEvent({
          sessionId,
          worktreePath: worktreeInfo.path,
        });
      } catch (err) {
        // Catch-all for unexpected errors
        const message = err instanceof Error ? err.message : String(err);
        sendErrorEvent({
          error: "Pipeline failed unexpectedly",
          details: message,
        });
      } finally {
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
