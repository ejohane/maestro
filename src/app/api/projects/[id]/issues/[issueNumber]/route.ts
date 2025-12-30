import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { configService } from "@/lib/services/config";

const execAsync = promisify(exec);

// GET /api/projects/[id]/issues/[issueNumber] - Get a single GitHub issue
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  try {
    const { id, issueNumber } = await params;

    // Validate issue number
    const issueNum = parseInt(issueNumber, 10);
    if (isNaN(issueNum) || issueNum <= 0) {
      return NextResponse.json({ error: "Invalid issue number" }, { status: 400 });
    }

    // Get project to find path
    const project = await configService.getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Use gh CLI to get issue details
    const { stdout, stderr } = await execAsync(
      `gh issue view ${issueNum} --json number,title,body,state,url,createdAt,author,labels,comments`,
      { cwd: project.path }
    );

    if (stderr) {
      console.error("gh issue view stderr:", stderr);
    }

    const issue = JSON.parse(stdout);

    return NextResponse.json(issue);
  } catch (error) {
    console.error("Failed to fetch issue:", error);

    // Check for common gh CLI errors
    if (error instanceof Error) {
      if (error.message.includes("gh: command not found")) {
        return NextResponse.json(
          { error: "GitHub CLI not installed. Please install gh: https://cli.github.com" },
          { status: 500 }
        );
      }
      if (error.message.includes("not logged in")) {
        return NextResponse.json(
          { error: "GitHub CLI not authenticated. Run `gh auth login` in terminal." },
          { status: 401 }
        );
      }
      if (error.message.includes("not a git repository")) {
        return NextResponse.json(
          { error: "Not a git repository" },
          { status: 400 }
        );
      }
      if (error.message.includes("Could not resolve") || error.message.includes("not found")) {
        return NextResponse.json(
          { error: "Issue not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch issue" },
      { status: 500 }
    );
  }
}
