import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import { configService } from "@/lib/services/config";
import { ConfigError } from "@/lib/types/config";

interface ProjectResponse {
  id: string;
  path: string;
  displayPath: string;
  name: string | null;
  displayName: string;
  addedAt: string;
  status: "active" | "missing";
}

async function toProjectResponse(project: {
  id: string;
  path: string;
  name: string | null;
  addedAt: string;
}): Promise<ProjectResponse> {
  let status: "active" | "missing" = "active";
  try {
    await fs.access(project.path);
  } catch {
    status = "missing";
  }

  return {
    id: project.id,
    path: project.path,
    displayPath: configService.toDisplayPath(project.path),
    name: project.name,
    displayName: project.name || configService.deriveDisplayName(project.path),
    addedAt: project.addedAt,
    status,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, path } = body;

    // At least one field required
    if (name === undefined && path === undefined) {
      return NextResponse.json(
        { error: "At least one of name or path is required" },
        { status: 400 }
      );
    }

    // Check project exists
    const existingProject = await configService.getProject(id);
    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If path provided and different from current, validate it
    if (path !== undefined && path !== existingProject.path) {
      try {
        await fs.access(path);
      } catch {
        return NextResponse.json(
          { error: "Path does not exist" },
          { status: 404 }
        );
      }

      const stat = await fs.stat(path);
      if (!stat.isDirectory()) {
        return NextResponse.json(
          { error: "Path must be a directory" },
          { status: 400 }
        );
      }
    }

    const updates: { name?: string | null; path?: string } = {};
    if (name !== undefined) {
      updates.name = name?.trim() || null;
    }
    if (path !== undefined && path !== existingProject.path) {
      updates.path = path;
    }

    // If no actual changes, just return current state
    if (Object.keys(updates).length === 0) {
      const response = await toProjectResponse(existingProject);
      return NextResponse.json(response);
    }

    try {
      const updated = await configService.updateProject(id, updates);
      const response = await toProjectResponse(updated);
      return NextResponse.json(response);
    } catch (err) {
      if (err instanceof ConfigError) {
        if (err.code === "VALIDATION") {
          if (err.message.includes("home directory")) {
            return NextResponse.json({ error: err.message }, { status: 403 });
          }
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
      }
      throw err;
    }
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await configService.deleteProject(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete project:", error);
    // Still return 204 for idempotency
    return new NextResponse(null, { status: 204 });
  }
}
