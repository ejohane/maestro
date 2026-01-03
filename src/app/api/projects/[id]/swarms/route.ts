import { NextRequest, NextResponse } from "next/server";
import { configService } from "@/lib/services/config";
import { sessionStorage } from "@/lib/services/sessions";
import { openCodeService } from "@/lib/services/opencode";
import { beadsService } from "@/lib/services/beads";
import type { ActiveSwarm, SwarmProgress } from "@/lib/types/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id: projectId } = await params;

  try {
    // 1. Verify project exists
    const project = await configService.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2. Get all swarm sessions for this project
    const swarmSessions = await sessionStorage.listSwarmSessions(projectId);

    // 3. Enrich each swarm with additional data
    const swarms: ActiveSwarm[] = await Promise.all(
      swarmSessions.map(async (session) => {
        // Default values
        let issueTitle = `Issue #${session.issueNumber}`;
        let progress: SwarmProgress = {
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          percentage: 0,
        };
        let agents = { total: 0, running: 0, blocked: 0 };

        // Try to get beads progress
        try {
          const allBeads = await beadsService.list(session.worktreePath);
          // Filter to beads for this epic
          const epicBeads = allBeads.filter(
            (b) => b.id === session.epicId || b.id.startsWith(session.epicId + ".")
          );
          const tasks = epicBeads.filter((b) => b.type === "task");
          
          progress = {
            total: tasks.length,
            completed: tasks.filter((b) => b.status === "closed").length,
            inProgress: tasks.filter((b) => b.status === "in_progress").length,
            pending: tasks.filter((b) => b.status === "open").length,
            percentage: tasks.length > 0
              ? Math.round((tasks.filter((b) => b.status === "closed").length / tasks.length) * 100)
              : 0,
          };
        } catch {
          // Keep default progress
        }

        // Try to get agent counts
        try {
          const children = await openCodeService.getChildSessions(
            session.worktreePath,
            session.sessionId
          );
          const statuses = await openCodeService.getSessionStatuses(session.worktreePath);
          
          agents.total = children.length;
          agents.running = children.filter((c) => statuses[c.id]?.type === "busy").length;
        } catch {
          // Keep default counts
        }

        return {
          issueNumber: session.issueNumber,
          issueTitle,
          epicId: session.epicId,
          sessionId: session.sessionId,
          worktreePath: session.worktreePath,
          status: session.status,
          progress,
          agents,
          startedAt: session.startedAt,
        };
      })
    );

    return NextResponse.json({ swarms });

  } catch (error) {
    console.error("Failed to list swarms:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list swarms" },
      { status: 500 }
    );
  }
}
