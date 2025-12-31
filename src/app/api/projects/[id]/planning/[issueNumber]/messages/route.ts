import { configService } from "@/lib/services/config";
import { openCodeService } from "@/lib/services/opencode";
import { sessionStorage } from "@/lib/services/sessions";
import { worktreeService } from "@/lib/services/worktree";

/**
 * GET /api/projects/[id]/planning/[issueNumber]/messages
 * 
 * Fetch all messages for the planning session.
 * Returns the message history from the OpenCode session.
 * 
 * Response:
 * - messages: Array of messages with role, parts, and metadata
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
      return Response.json(
        { error: "No worktree exists for this issue" },
        { status: 404 }
      );
    }

    // Get session mapping
    const planningSession = await sessionStorage.getPlanningSession(
      projectId,
      issueNumber
    );

    if (!planningSession) {
      return Response.json(
        { error: "No planning session found" },
        { status: 404 }
      );
    }

    // Fetch messages from OpenCode
    const messages = await openCodeService.getSessionMessages(
      worktree.path,
      planningSession.sessionId
    );

    return Response.json({ messages });
  } catch (err) {
    console.error("Error fetching session messages:", err);
    return Response.json(
      { error: "Failed to fetch session messages" },
      { status: 500 }
    );
  }
}
