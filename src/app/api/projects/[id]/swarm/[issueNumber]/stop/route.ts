import { NextRequest, NextResponse } from "next/server";
import { configService } from "@/lib/services/config";
import { sessionStorage } from "@/lib/services/sessions";
import { openCodeService } from "@/lib/services/opencode";
import { removeSwarmLabel } from "@/lib/services/github-labels";
import type { StopSwarmResponse } from "@/lib/types/api";

interface RouteParams {
  params: Promise<{ id: string; issueNumber: string }>;
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<StopSwarmResponse>> {
  const { id: projectId, issueNumber: issueNumberStr } = await params;
  const issueNumber = parseInt(issueNumberStr, 10);

  if (isNaN(issueNumber) || issueNumber <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid issue number" },
      { status: 400 }
    );
  }

  const errors: string[] = [];

  try {
    // 1. Get project config
    const project = await configService.getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // 2. Get swarm session
    const swarmSession = await sessionStorage.getSwarmSession(projectId, issueNumber);
    if (!swarmSession) {
      return NextResponse.json(
        { success: false, error: "No swarm session found for this issue" },
        { status: 404 }
      );
    }

    // 3. Abort orchestrator session (this should also abort child sessions)
    try {
      const aborted = await openCodeService.abortSession(
        swarmSession.worktreePath,
        swarmSession.sessionId
      );
      if (!aborted) {
        errors.push("Failed to abort session: abortSession returned false");
      }
    } catch (abortError) {
      errors.push(
        `Failed to abort session: ${abortError instanceof Error ? abortError.message : "Unknown error"}`
      );
    }

    // 4. Remove swarm label from GitHub issue
    try {
      await removeSwarmLabel(project.path, issueNumber);
    } catch (labelError) {
      errors.push(
        `Failed to remove label: ${labelError instanceof Error ? labelError.message : "Unknown error"}`
      );
    }

    // 5. Update swarm session status to 'stopped'
    try {
      const updated = await sessionStorage.updateSwarmStatus(
        projectId,
        issueNumber,
        "stopped"
      );
      if (!updated) {
        errors.push("Failed to update session status: session not found");
      }
    } catch (storageError) {
      errors.push(
        `Failed to update session status: ${storageError instanceof Error ? storageError.message : "Unknown error"}`
      );
    }

    // 6. Return result
    if (errors.length > 0) {
      console.warn("Swarm stopped with cleanup errors:", errors);
      // Still return success if swarm was found - partial cleanup is acceptable
      // The swarm is effectively stopped even if label removal or status update failed
      return NextResponse.json({
        success: true,
        error: `Swarm stopped with cleanup errors: ${errors.join("; ")}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to stop swarm:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to stop swarm",
      },
      { status: 500 }
    );
  }
}
