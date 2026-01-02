import { NextResponse } from "next/server";
import { configService } from "@/lib/services/config";
import { sessionStorage } from "@/lib/services/sessions";
import { worktreeService } from "@/lib/services/worktree";
import { removePlanningLabel } from "@/lib/services/github-labels";

interface EndPlanningRequest {
  cleanup?: boolean;
}

interface EndPlanningResponse {
  success: boolean;
  labelRemoved: boolean;
  sessionRemoved: boolean;
  worktreeRemoved: boolean;
  errors: string[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  const { id: projectId, issueNumber: issueNumStr } = await params;
  const issueNumber = parseInt(issueNumStr, 10);

  if (isNaN(issueNumber) || issueNumber <= 0) {
    return NextResponse.json(
      { error: "Invalid issue number" },
      { status: 400 }
    );
  }

  const project = await configService.getProject(projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  let cleanup = false;
  try {
    const body: EndPlanningRequest = await request.json();
    cleanup = body.cleanup === true;
  } catch {
    // No body or invalid JSON - use defaults
  }

  const results: EndPlanningResponse = {
    success: false,
    labelRemoved: false,
    sessionRemoved: false,
    worktreeRemoved: false,
    errors: [],
  };

  // 1. Remove planning label from GitHub issue
  try {
    await removePlanningLabel(project.path, issueNumber);
    results.labelRemoved = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Failed to remove label: ${msg}`);
  }

  // 2. Optionally clean up session and worktree
  if (cleanup) {
    try {
      const removed = await sessionStorage.removeSession(
        projectId, 
        issueNumber, 
        "planning"
      );
      results.sessionRemoved = removed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Failed to remove session: ${msg}`);
    }

    try {
      await worktreeService.deleteWorktree(project.path, issueNumber);
      results.worktreeRemoved = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("not found") && !msg.includes("does not exist")) {
        results.errors.push(`Failed to remove worktree: ${msg}`);
      } else {
        results.worktreeRemoved = true;
      }
    }
  }

  // Success if label was removed
  results.success = results.labelRemoved;

  return NextResponse.json(results);
}
