import { configService } from "@/lib/services/config";
import { openCodeService } from "@/lib/services/opencode";
import { sessionStorage } from "@/lib/services/sessions";
import { worktreeService } from "@/lib/services/worktree";

/**
 * Session status response type
 */
interface SessionStatusResponse {
  exists: boolean;
  worktreePath?: string;
  branch?: string;
  depsInstalled?: boolean;
  sessionId?: string;
  sessionAlive?: boolean;
}

/**
 * Session creation response type
 */
interface SessionCreateResponse {
  sessionId: string;
  worktreePath: string;
  branch: string;
  isRecovered: boolean;
}

/**
 * GET /api/projects/[id]/planning/[issueNumber]/session
 * 
 * Check if an existing planning session exists for this issue.
 * Returns session info if found, or exists: false if no session.
 * 
 * Response:
 * - exists: boolean - Whether a session exists
 * - worktreePath?: string - Path to the worktree (if exists)
 * - branch?: string - Branch name (if exists)
 * - depsInstalled?: boolean - Whether deps are installed (if exists)
 * - sessionId?: string - OpenCode session ID (if exists)
 * - sessionAlive?: boolean - Whether the session is still alive (if exists)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
): Promise<Response> {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  const issueNumber = parseInt(resolvedParams.issueNumber, 10);

  // Validate issue number
  if (isNaN(issueNumber) || issueNumber <= 0) {
    return Response.json(
      { error: "Invalid issue number" },
      { status: 400 }
    );
  }

  // Get project from config
  const project = await configService.getProject(projectId);
  if (!project) {
    return Response.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  try {
    // Check for existing worktree
    const worktree = await worktreeService.getWorktree(project.path, issueNumber);
    
    if (!worktree) {
      // No worktree exists
      const response: SessionStatusResponse = { exists: false };
      return Response.json(response);
    }

    // Worktree exists, check for session
    const planningSession = await sessionStorage.getPlanningSession(
      projectId,
      issueNumber
    );

    if (!planningSession) {
      // Worktree exists but no session mapping
      const response: SessionStatusResponse = {
        exists: false,
        worktreePath: worktree.path,
        branch: worktree.branch,
        depsInstalled: worktree.depsInstalled,
      };
      return Response.json(response);
    }

    // Check if session is still alive
    const sessionAlive = await openCodeService.isSessionAlive(
      worktree.path,
      planningSession.sessionId
    );

    const response: SessionStatusResponse = {
      exists: true,
      worktreePath: worktree.path,
      branch: worktree.branch,
      depsInstalled: worktree.depsInstalled,
      sessionId: planningSession.sessionId,
      sessionAlive,
    };

    return Response.json(response);
  } catch (err) {
    console.error("Error checking session status:", err);
    return Response.json(
      { error: "Failed to check session status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/planning/[issueNumber]/session
 * 
 * Create a new OpenCode session for an existing planning worktree.
 * This is used to recover from a dead session when the worktree still exists.
 * 
 * Prerequisites:
 * - Project must exist
 * - Worktree must already exist for this issue
 * 
 * Response:
 * - sessionId: string - The new OpenCode session ID
 * - worktreePath: string - Path to the worktree
 * - branch: string - Branch name
 * - isRecovered: boolean - true if this replaced a dead session
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
): Promise<Response> {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  const issueNumber = parseInt(resolvedParams.issueNumber, 10);

  // Validate issue number
  if (isNaN(issueNumber) || issueNumber <= 0) {
    return Response.json(
      { error: "Invalid issue number" },
      { status: 400 }
    );
  }

  // Get project from config
  const project = await configService.getProject(projectId);
  if (!project) {
    return Response.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  try {
    // Check for existing worktree - required for this endpoint
    const worktree = await worktreeService.getWorktree(project.path, issueNumber);
    
    if (!worktree) {
      // No worktree exists - caller should use setup endpoint instead
      return Response.json(
        { error: "No worktree exists for this issue. Use setup endpoint first." },
        { status: 404 }
      );
    }

    // Check if there's an existing session that's still alive
    const existingSession = await sessionStorage.getPlanningSession(
      projectId,
      issueNumber
    );

    let isRecovered = false;

    if (existingSession) {
      // Check if it's still alive
      const sessionAlive = await openCodeService.isSessionAlive(
        worktree.path,
        existingSession.sessionId
      );

      if (sessionAlive) {
        // Session is still alive - return it
        const response: SessionCreateResponse = {
          sessionId: existingSession.sessionId,
          worktreePath: worktree.path,
          branch: worktree.branch,
          isRecovered: false,
        };
        return Response.json(response);
      }

      // Session is dead - will create new one
      isRecovered = true;
    }

    // Create new OpenCode session in the worktree context
    const sessionTitle = `Planning: Issue #${issueNumber}`;
    const { id: newSessionId } = await openCodeService.createPlanningSession(
      worktree.path,
      sessionTitle
    );

    // Save the session mapping
    await sessionStorage.savePlanningSession(
      projectId,
      project.path,
      issueNumber,
      newSessionId,
      worktree.path
    );

    const response: SessionCreateResponse = {
      sessionId: newSessionId,
      worktreePath: worktree.path,
      branch: worktree.branch,
      isRecovered,
    };

    return Response.json(response, { status: isRecovered ? 200 : 201 });
  } catch (err) {
    console.error("Error creating planning session:", err);
    return Response.json(
      { error: "Failed to create planning session" },
      { status: 500 }
    );
  }
}
