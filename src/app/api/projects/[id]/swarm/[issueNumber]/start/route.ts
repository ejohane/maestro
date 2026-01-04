import { NextRequest, NextResponse } from "next/server";
import { configService } from "@/lib/services/config";
import { sessionStorage } from "@/lib/services/sessions";
import { openCodeService } from "@/lib/services/opencode";
import { addSwarmLabel } from "@/lib/services/github-labels";
import { beadsService } from "@/lib/services/beads";
import { findEpicBead } from "@/lib/services/beads-utils";
import type { StartSwarmResponse } from "@/lib/types/api";

interface RouteParams {
  params: Promise<{ id: string; issueNumber: string }>;
}

/**
 * POST /api/projects/[id]/swarm/[issueNumber]/start
 *
 * Initiates swarm execution for a planned issue.
 *
 * Prerequisites:
 * - Planning session must exist with a worktree
 * - Epic bead must exist for the issue
 *
 * This endpoint:
 * 1. Validates the planning session exists
 * 2. Checks no swarm is already running
 * 3. Finds the epic bead for the issue
 * 4. Adds the swarm label to GitHub
 * 5. Creates an orchestrator OpenCode session
 * 6. Saves the swarm session mapping
 * 7. Sends the /swarm command to start orchestration
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<StartSwarmResponse>> {
  const { id: projectId, issueNumber: issueNumberStr } = await params;
  const issueNumber = parseInt(issueNumberStr, 10);

  // Validate issue number
  if (isNaN(issueNumber) || issueNumber <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid issue number" },
      { status: 400 }
    );
  }

  try {
    // 1. Get project config
    const project = await configService.getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // 2. Get planning session (need worktree path)
    const planningSession = await sessionStorage.getPlanningSession(
      projectId,
      issueNumber
    );
    if (!planningSession || !planningSession.worktreePath) {
      return NextResponse.json(
        {
          success: false,
          error: "No active planning session found. Start planning first.",
        },
        { status: 400 }
      );
    }

    // 3. Check if swarm already running
    const existingSwarm = await sessionStorage.getSwarmSession(
      projectId,
      issueNumber
    );
    if (existingSwarm && existingSwarm.status === "running") {
      return NextResponse.json(
        { success: false, error: "Swarm already running for this issue" },
        { status: 409 }
      );
    }

    // 4. Find epic for this issue from beads
    const beads = await beadsService.list(planningSession.worktreePath);
    const epic = findEpicBead(beads, issueNumber);

    if (!epic) {
      return NextResponse.json(
        {
          success: false,
          error: `No epic found for issue #${issueNumber}. Complete planning first.`,
        },
        { status: 400 }
      );
    }

    const epicId = epic.id;

    // 5. Add swarm label to GitHub issue
    // Non-fatal - swarm works even if label fails
    try {
      await addSwarmLabel(project.path, issueNumber);
    } catch (err) {
      console.warn(
        `[Swarm Start] Failed to add swarm label to issue #${issueNumber}:`,
        err instanceof Error ? err.message : err
      );
    }

    // 6. Create new orchestrator session in worktree
    const title = `Swarm: Issue #${issueNumber}`;
    const session = await openCodeService.createSession(
      planningSession.worktreePath,
      title
    );

    // 7. Save swarm session mapping
    await sessionStorage.saveSwarmSession(
      projectId,
      project.path,
      issueNumber,
      session.id,
      planningSession.worktreePath,
      epicId
    );

    // 8. Send /swarm command to start orchestration
    // Using sendPlanningMessageAsync since swarm needs full tool access
    await openCodeService.sendPlanningMessageAsync(
      planningSession.worktreePath,
      session.id,
      `/swarm ${epicId}`
    );

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      worktreePath: planningSession.worktreePath,
      epicId,
    });
  } catch (error) {
    console.error("Failed to start swarm:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start swarm",
      },
      { status: 500 }
    );
  }
}
