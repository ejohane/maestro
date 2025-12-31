// Beads API - Single Bead Operations
// GET /api/projects/{id}/planning/{issueNumber}/beads/{beadId} - Get single bead
// PATCH /api/projects/{id}/planning/{issueNumber}/beads/{beadId} - Update bead
// DELETE /api/projects/{id}/planning/{issueNumber}/beads/{beadId} - Close/delete bead

import { configService } from "@/lib/services/config";
import { worktreeService } from "@/lib/services/worktree";
import {
  beadsService,
  Bead,
  BeadsError,
  UpdateBeadOptions,
} from "@/lib/services/beads";

interface BeadResponse {
  bead: Bead;
}

interface DeleteResponse {
  success: true;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

type RouteParams = Promise<{ id: string; issueNumber: string; beadId: string }>;

/**
 * GET /api/projects/{id}/planning/{issueNumber}/beads/{beadId}
 *
 * Returns a single bead with full details.
 */
export async function GET(
  request: Request,
  { params }: { params: RouteParams }
): Promise<Response> {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const issueNumber = parseInt(resolvedParams.issueNumber, 10);
    const beadId = resolvedParams.beadId;

    // Validate issue number
    if (isNaN(issueNumber) || issueNumber <= 0) {
      return Response.json(
        { error: "Invalid issue number" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate bead ID
    if (!beadId || typeof beadId !== "string") {
      return Response.json(
        { error: "Invalid bead ID" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Get project
    const project = await configService.getProject(projectId);
    if (!project) {
      return Response.json(
        { error: "Project not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Get worktree
    const worktree = await worktreeService.getWorktree(project.path, issueNumber);
    if (!worktree) {
      return Response.json(
        { error: "Worktree not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Get bead
    const bead = await beadsService.get(worktree.path, beadId);
    if (!bead) {
      return Response.json(
        { error: "Bead not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    const response: BeadResponse = { bead };

    return Response.json(response);
  } catch (error) {
    console.error("Failed to get bead:", error);

    if (error instanceof BeadsError) {
      if (error.code === "NOT_FOUND") {
        return Response.json(
          { error: error.message, code: error.code } as ErrorResponse,
          { status: 404 }
        );
      }
      return Response.json(
        { error: error.message, code: error.code } as ErrorResponse,
        { status: 500 }
      );
    }

    return Response.json(
      { error: "Failed to get bead" } as ErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/{id}/planning/{issueNumber}/beads/{beadId}
 *
 * Updates a bead's properties.
 *
 * Request body:
 * - status?: 'open' | 'in_progress' | 'closed'
 * - priority?: 0 | 1 | 2 | 3 | 4
 * - title?: string
 */
export async function PATCH(
  request: Request,
  { params }: { params: RouteParams }
): Promise<Response> {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const issueNumber = parseInt(resolvedParams.issueNumber, 10);
    const beadId = resolvedParams.beadId;

    // Validate issue number
    if (isNaN(issueNumber) || issueNumber <= 0) {
      return Response.json(
        { error: "Invalid issue number" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate bead ID
    if (!beadId || typeof beadId !== "string") {
      return Response.json(
        { error: "Invalid bead ID" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Parse request body
    let body: UpdateBeadOptions;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid request body" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate at least one update field is provided
    const hasUpdates =
      body.status !== undefined ||
      body.priority !== undefined ||
      body.title !== undefined ||
      body.description !== undefined;

    if (!hasUpdates) {
      return Response.json(
        { error: "At least one update field is required (status, priority, title, description)" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate status if provided
    if (body.status !== undefined) {
      const validStatuses = ["open", "in_progress", "closed"];
      if (!validStatuses.includes(body.status)) {
        return Response.json(
          { error: "status must be one of: " + validStatuses.join(", ") } as ErrorResponse,
          { status: 400 }
        );
      }
    }

    // Validate priority if provided
    if (body.priority !== undefined) {
      if (typeof body.priority !== "number" || body.priority < 0 || body.priority > 4) {
        return Response.json(
          { error: "priority must be a number between 0 and 4" } as ErrorResponse,
          { status: 400 }
        );
      }
    }

    // Validate title if provided
    if (body.title !== undefined && typeof body.title !== "string") {
      return Response.json(
        { error: "title must be a string" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Get project
    const project = await configService.getProject(projectId);
    if (!project) {
      return Response.json(
        { error: "Project not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Get worktree
    const worktree = await worktreeService.getWorktree(project.path, issueNumber);
    if (!worktree) {
      return Response.json(
        { error: "Worktree not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Check bead exists first
    const existingBead = await beadsService.get(worktree.path, beadId);
    if (!existingBead) {
      return Response.json(
        { error: "Bead not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Update bead
    const updates: UpdateBeadOptions = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;

    const bead = await beadsService.update(worktree.path, beadId, updates);

    const response: BeadResponse = { bead };

    return Response.json(response);
  } catch (error) {
    console.error("Failed to update bead:", error);

    if (error instanceof BeadsError) {
      if (error.code === "NOT_FOUND") {
        return Response.json(
          { error: error.message, code: error.code } as ErrorResponse,
          { status: 404 }
        );
      }
      return Response.json(
        { error: error.message, code: error.code } as ErrorResponse,
        { status: 500 }
      );
    }

    return Response.json(
      { error: "Failed to update bead" } as ErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/{id}/planning/{issueNumber}/beads/{beadId}
 *
 * Closes/deletes a bead.
 *
 * Request body (optional):
 * - reason?: string
 */
export async function DELETE(
  request: Request,
  { params }: { params: RouteParams }
): Promise<Response> {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const issueNumber = parseInt(resolvedParams.issueNumber, 10);
    const beadId = resolvedParams.beadId;

    // Validate issue number
    if (isNaN(issueNumber) || issueNumber <= 0) {
      return Response.json(
        { error: "Invalid issue number" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate bead ID
    if (!beadId || typeof beadId !== "string") {
      return Response.json(
        { error: "Invalid bead ID" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Parse optional request body
    let reason: string | undefined;
    try {
      const body = await request.json();
      if (body.reason && typeof body.reason === "string") {
        reason = body.reason;
      }
    } catch {
      // Body is optional, ignore parse errors
    }

    // Get project
    const project = await configService.getProject(projectId);
    if (!project) {
      return Response.json(
        { error: "Project not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Get worktree
    const worktree = await worktreeService.getWorktree(project.path, issueNumber);
    if (!worktree) {
      return Response.json(
        { error: "Worktree not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Check bead exists first
    const existingBead = await beadsService.get(worktree.path, beadId);
    if (!existingBead) {
      return Response.json(
        { error: "Bead not found" } as ErrorResponse,
        { status: 404 }
      );
    }

    // Close bead
    await beadsService.close(worktree.path, beadId, reason);

    const response: DeleteResponse = { success: true };

    return Response.json(response);
  } catch (error) {
    console.error("Failed to delete bead:", error);

    if (error instanceof BeadsError) {
      if (error.code === "NOT_FOUND") {
        return Response.json(
          { error: error.message, code: error.code } as ErrorResponse,
          { status: 404 }
        );
      }
      return Response.json(
        { error: error.message, code: error.code } as ErrorResponse,
        { status: 500 }
      );
    }

    return Response.json(
      { error: "Failed to delete bead" } as ErrorResponse,
      { status: 500 }
    );
  }
}
