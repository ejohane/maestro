// Beads API - List and Create
// GET /api/projects/{id}/planning/{issueNumber}/beads - List all beads
// POST /api/projects/{id}/planning/{issueNumber}/beads - Create a new bead

import { configService } from "@/lib/services/config";
import { worktreeService } from "@/lib/services/worktree";
import {
  beadsService,
  Bead,
  BeadTree,
  BeadsError,
  CreateBeadOptions,
} from "@/lib/services/beads";
import { findEpicBead, filterBeadsByEpic } from "@/lib/services/beads-utils";

interface BeadsListResponse {
  tree: BeadTree | null;
  flat: Bead[];
}

interface BeadCreateResponse {
  bead: Bead;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

/**
 * Build a tree from a flat list of beads, starting from the given root
 */
function buildTree(beads: Bead[], root: Bead): BeadTree {
  const buildSubtree = (bead: Bead): BeadTree => {
    const children = beads.filter((b) => b.parent === bead.id).map(buildSubtree);
    return { root: bead, children };
  };

  return buildSubtree(root);
}

/**
 * GET /api/projects/{id}/planning/{issueNumber}/beads
 *
 * Returns all beads as both a tree structure and flat list.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
): Promise<Response> {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const issueNumber = parseInt(resolvedParams.issueNumber, 10);

    // Validate issue number
    if (isNaN(issueNumber) || issueNumber <= 0) {
      return Response.json(
        { error: "Invalid issue number" } as ErrorResponse,
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

    // Fetch all beads from the shared database
    const allBeads = await beadsService.list(worktree.path);

    // Find the epic for this specific issue
    const epic = findEpicBead(allBeads, issueNumber);
    
    // If no epic found for this issue, return empty - don't show other issues' beads
    if (!epic) {
      const response: BeadsListResponse = {
        tree: null,
        flat: [],
      };
      return Response.json(response);
    }

    // Filter to only beads that belong to this issue's epic tree
    const issueBeads = filterBeadsByEpic(allBeads, epic);
    
    // Build the tree structure
    const tree = buildTree(issueBeads, epic);

    const response: BeadsListResponse = {
      tree,
      flat: issueBeads,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Failed to list beads:", error);

    if (error instanceof BeadsError) {
      return Response.json(
        { error: error.message, code: error.code } as ErrorResponse,
        { status: 500 }
      );
    }

    return Response.json(
      { error: "Failed to list beads" } as ErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/{id}/planning/{issueNumber}/beads
 *
 * Creates a new bead.
 *
 * Request body:
 * - title: string (required)
 * - type: 'epic' | 'task' | 'bug' | 'feature' | 'question' | 'docs' (required)
 * - parent?: string
 * - priority?: 0 | 1 | 2 | 3 | 4
 * - description?: string
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
): Promise<Response> {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const issueNumber = parseInt(resolvedParams.issueNumber, 10);

    // Validate issue number
    if (isNaN(issueNumber) || issueNumber <= 0) {
      return Response.json(
        { error: "Invalid issue number" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Parse request body
    let body: CreateBeadOptions;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid request body" } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.title || typeof body.title !== "string") {
      return Response.json(
        { error: "title is required" } as ErrorResponse,
        { status: 400 }
      );
    }

    const validTypes = ["epic", "task", "bug", "feature", "question", "docs"];
    if (!body.type || !validTypes.includes(body.type)) {
      return Response.json(
        { error: "type is required and must be one of: " + validTypes.join(", ") } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate optional priority
    if (body.priority !== undefined) {
      if (typeof body.priority !== "number" || body.priority < 0 || body.priority > 4) {
        return Response.json(
          { error: "priority must be a number between 0 and 4" } as ErrorResponse,
          { status: 400 }
        );
      }
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

    // Create bead
    const options: CreateBeadOptions = {
      title: body.title,
      type: body.type,
      priority: body.priority,
      parent: body.parent,
      description: body.description,
    };

    const bead = await beadsService.create(worktree.path, options);

    const response: BeadCreateResponse = { bead };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create bead:", error);

    if (error instanceof BeadsError) {
      return Response.json(
        { error: error.message, code: error.code } as ErrorResponse,
        { status: 500 }
      );
    }

    return Response.json(
      { error: "Failed to create bead" } as ErrorResponse,
      { status: 500 }
    );
  }
}
