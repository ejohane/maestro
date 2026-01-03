import { NextRequest, NextResponse } from "next/server";
import { configService } from "@/lib/services/config";
import { sessionStorage } from "@/lib/services/sessions";
import { openCodeService } from "@/lib/services/opencode";
import type { PermissionResponse } from "@/lib/types/api";

interface RouteParams {
  params: Promise<{ id: string; issueNumber: string }>;
}

interface PermissionRequestBody {
  sessionId: string;
  permissionId: string;
  response: PermissionResponse;
}

/**
 * POST /api/projects/[id]/swarm/[issueNumber]/permission
 *
 * Responds to an agent's permission request during swarm execution.
 *
 * Request body:
 * - sessionId: The agent session that requested permission
 * - permissionId: The specific permission request ID
 * - response: "once" | "always" | "reject"
 *
 * This endpoint:
 * 1. Validates the request body
 * 2. Verifies the project and swarm session exist
 * 3. Forwards the permission response to OpenCode
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id: projectId, issueNumber: issueNumberStr } = await params;
  const issueNumber = parseInt(issueNumberStr, 10);

  if (isNaN(issueNumber) || issueNumber <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid issue number" },
      { status: 400 }
    );
  }

  let body: PermissionRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { sessionId, permissionId, response } = body;

  // Validate required fields
  if (!sessionId || !permissionId || !response) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required fields: sessionId, permissionId, response",
      },
      { status: 400 }
    );
  }

  // Validate response value
  if (!["once", "always", "reject"].includes(response)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid response. Must be 'once', 'always', or 'reject'",
      },
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

    // 2. Get swarm session
    const swarmSession = await sessionStorage.getSwarmSession(
      projectId,
      issueNumber
    );
    if (!swarmSession) {
      return NextResponse.json(
        { success: false, error: "No active swarm found for this issue" },
        { status: 404 }
      );
    }

    // 3. Respond to permission via OpenCode
    const success = await openCodeService.respondToPermission(
      swarmSession.worktreePath,
      sessionId,
      permissionId,
      response
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to respond to permission" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error responding to permission:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
