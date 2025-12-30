import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { configService } from "@/lib/services/config";

const execAsync = promisify(exec);

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  created_at: string;
  user: {
    login: string;
  };
  labels: { name: string }[];
}

// GET /api/projects/[id]/issues - List open GitHub issues
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get project to find path
    const project = await configService.getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Use gh CLI to list issues
    const { stdout, stderr } = await execAsync(
      `gh issue list --state open --json number,title,body,state,url,createdAt,author,labels`,
      { cwd: project.path }
    );

    if (stderr) {
      console.error("gh issue list stderr:", stderr);
    }

    const issues = JSON.parse(stdout || "[]");
    
    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Failed to list issues:", error);
    
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
    }
    
    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/issues - Create a new GitHub issue
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Get project to find path
    const project = await configService.getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Use the project path from config, not from request body
    const cwd = project.path;

    // Create issue using gh CLI
    // gh issue create doesn't support --json, so we create first then fetch
    const escapedTitle = title.replace(/"/g, '\\"');
    const { stdout: createStdout, stderr: createStderr } = await execAsync(
      `gh issue create --title "${escapedTitle}" --body ""`,
      { cwd }
    );

    // gh issue create outputs the URL to stdout on success
    // Format: https://github.com/owner/repo/issues/123
    const output = createStdout || createStderr;
    const urlMatch = output.match(/issues\/(\d+)/);
    
    if (!urlMatch) {
      console.error("Failed to extract issue number from output:", output);
      throw new Error("Failed to parse created issue URL");
    }

    const issueNumber = urlMatch[1];

    // Fetch the created issue details
    const { stdout: issueStdout } = await execAsync(
      `gh issue view ${issueNumber} --json number,title,body,state,url,createdAt,author,labels`,
      { cwd }
    );
    
    const issue: GitHubIssue = JSON.parse(issueStdout);

    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    console.error("Failed to create issue:", error);

    // Check for common gh CLI errors
    if (error instanceof Error) {
      if (error.message.includes("gh: command not found")) {
        return NextResponse.json(
          { error: "GitHub CLI not installed. Please install gh: https://cli.github.com" },
          { status: 500 }
        );
      }
      if (error.message.includes("not logged in") || error.message.includes("authentication")) {
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
      if (error.message.includes("no git remotes")) {
        return NextResponse.json(
          { error: "No GitHub remote found. Add a remote with `git remote add origin <url>`" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create issue" },
      { status: 500 }
    );
  }
}
