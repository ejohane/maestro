import { NextRequest, NextResponse } from "next/server";
import { configService } from "@/lib/services/config";
import { sessionStorage } from "@/lib/services/sessions";
import { openCodeService } from "@/lib/services/opencode";

interface RouteParams {
  params: Promise<{ id: string; issueNumber: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id: projectId, issueNumber: issueNumberStr } = await params;
  const issueNumber = parseInt(issueNumberStr, 10);

  if (isNaN(issueNumber)) {
    return NextResponse.json({ exists: false, error: "Invalid issue number" }, { status: 400 });
  }

  try {
    // 1. Verify project exists
    const project = await configService.getProject(projectId);
    if (!project) {
      return NextResponse.json({ exists: false, error: "Project not found" }, { status: 404 });
    }

    // 2. Get swarm session from storage
    const swarmSession = await sessionStorage.getSwarmSession(projectId, issueNumber);

    if (!swarmSession) {
      return NextResponse.json({ exists: false, session: null });
    }

    // 3. Check if orchestrator is still alive (for running swarms)
    let isAlive = false;
    if (swarmSession.status === "running") {
      // Check if session exists - use getChildSessions or similar to verify
      try {
        const statuses = await openCodeService.getSessionStatuses(swarmSession.worktreePath);
        isAlive = swarmSession.sessionId in statuses;
      } catch {
        isAlive = false;
      }

      // If stored as running but dead, update status
      if (!isAlive) {
        await sessionStorage.updateSwarmStatus(projectId, issueNumber, "error");
        swarmSession.status = "error";
      }
    }

    // 4. Return session info
    return NextResponse.json({
      exists: true,
      session: {
        orchestratorSessionId: swarmSession.sessionId,
        worktreePath: swarmSession.worktreePath,
        epicId: swarmSession.epicId,
        status: swarmSession.status,
        startedAt: swarmSession.startedAt,
        isAlive,
      },
    });

  } catch (error) {
    console.error("Failed to get swarm session:", error);
    return NextResponse.json(
      { exists: false, error: error instanceof Error ? error.message : "Failed to get session" },
      { status: 500 }
    );
  }
}
