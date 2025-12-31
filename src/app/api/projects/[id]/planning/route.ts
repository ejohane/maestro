import { NextResponse } from "next/server";
import { sessionStorage } from "@/lib/services/sessions";
import { configService } from "@/lib/services/config";

export interface PlanningSessionInfo {
  issueNumber: number;
  issueTitle: string;
  worktreePath: string;
  createdAt: string;
}

// GET /api/projects/[id]/planning - List active planning sessions
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Verify project exists
    const project = await configService.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all planning sessions for this project
    const sessions = await sessionStorage.listPlanningSessions(projectId);

    // Map to response format
    const sessionInfos: PlanningSessionInfo[] = sessions.map((session) => ({
      issueNumber: session.issueNumber,
      issueTitle: `Issue #${session.issueNumber}`, // Placeholder - can enhance later with GitHub API
      worktreePath: session.worktreePath,
      createdAt: session.createdAt,
    }));

    // Sort by most recently created first
    sessionInfos.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ sessions: sessionInfos });
  } catch (error) {
    console.error("Failed to list planning sessions:", error);
    return NextResponse.json(
      { error: "Failed to list planning sessions" },
      { status: 500 }
    );
  }
}
