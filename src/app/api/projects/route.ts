import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import { configService } from "@/lib/services/config";

// Shared response type
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

export async function GET() {
  try {
    const projects = await configService.getProjects();
    const projectResponses = await Promise.all(projects.map(toProjectResponse));
    // Sort by addedAt descending (most recent first)
    projectResponses.sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );
    return NextResponse.json({ projects: projectResponses });
  } catch (error) {
    console.error("Failed to get projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { path, name } = body;

    // Validation 1: path required
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    // Validation 2: path within home (configService.addProject handles this)
    // Validation 3: resolve symlinks (configService.addProject handles this)

    // Validation 4: path must exist
    try {
      await fs.access(path);
    } catch {
      return NextResponse.json(
        { error: "Path does not exist" },
        { status: 404 }
      );
    }

    // Validation 5: path must be directory
    const stat = await fs.stat(path);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path must be a directory" },
        { status: 400 }
      );
    }

    // Validation 6: not already tracked (configService.addProject handles this)

    try {
      const project = await configService.addProject(path, name);
      const response = await toProjectResponse(project);
      return NextResponse.json(response, { status: 201 });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("home directory")) {
          return NextResponse.json({ error: err.message }, { status: 403 });
        }
        if (err.message.includes("already exists")) {
          return NextResponse.json({ error: err.message }, { status: 409 });
        }
      }
      throw err;
    }
  } catch (error) {
    console.error("Failed to add project:", error);
    return NextResponse.json(
      { error: "Failed to add project" },
      { status: 500 }
    );
  }
}
