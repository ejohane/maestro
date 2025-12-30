import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { configService } from "@/lib/services/config";
import { openCodeService } from "@/lib/services/opencode";
import { sessionStorage } from "@/lib/services/sessions";

const execAsync = promisify(exec);

// Types for GitHub issue from gh CLI
interface GitHubAuthor {
  login: string;
}

interface GitHubLabel {
  name: string;
}

interface GitHubComment {
  author: GitHubAuthor;
  body: string;
  createdAt: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  url: string;
  createdAt: string;
  author: GitHubAuthor | null;
  labels: GitHubLabel[];
  comments: GitHubComment[];
}

/**
 * Build context string from GitHub issue for injection into OpenCode session
 */
function buildIssueContext(issue: GitHubIssue): string {
  const comments = issue.comments?.length
    ? issue.comments
        .map(
          (c) =>
            `**@${c.author.login}** (${new Date(c.createdAt).toLocaleDateString()}):\n${c.body}`
        )
        .join("\n\n")
    : "No comments yet.";

  return `## GitHub Issue #${issue.number}

**Title:** ${issue.title}
**State:** ${issue.state}
**Author:** @${issue.author?.login || "unknown"}
**Labels:** ${issue.labels?.map((l) => l.name).join(", ") || "None"}
**Created:** ${new Date(issue.createdAt).toLocaleDateString()}

### Description
${issue.body || "No description provided."}

### Comments
${comments}

---
You are helping discuss this GitHub issue. You can read the codebase to answer questions and suggest approaches, but you cannot modify any files. Focus on exploration and understanding.`;
}

/**
 * Fetch issue details using gh CLI
 */
async function fetchIssue(
  projectPath: string,
  issueNumber: number
): Promise<GitHubIssue> {
  const { stdout } = await execAsync(
    `gh issue view ${issueNumber} --json number,title,body,state,url,createdAt,author,labels,comments`,
    { cwd: projectPath }
  );
  return JSON.parse(stdout);
}

// GET /api/projects/[id]/issues/[issueNumber]/session - Get existing session ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  try {
    const { id, issueNumber } = await params;

    // Validate issue number
    const issueNum = parseInt(issueNumber, 10);
    if (isNaN(issueNum) || issueNum <= 0) {
      return NextResponse.json(
        { error: "Invalid issue number" },
        { status: 400 }
      );
    }

    // Get project to find path
    const project = await configService.getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check sessionStorage for existing mapping
    const mapping = await sessionStorage.getSession(id, issueNum);
    if (!mapping) {
      return NextResponse.json({ sessionId: null });
    }

    // Verify session is alive via OpenCode
    const isAlive = await openCodeService.isSessionAlive(
      project.path,
      mapping.sessionId
    );

    if (isAlive) {
      // Touch session timestamp
      await sessionStorage.touchSession(id, issueNum);
      
      // Fetch message history from OpenCode
      const rawMessages = await openCodeService.getSessionMessages(
        project.path,
        mapping.sessionId
      );
      
      // Transform OpenCode messages to our format
      const messages = rawMessages
        .filter((msg) => {
          // Skip synthetic context injection messages
          const hasSyntheticPart = msg.parts.some(
            (p) => p.type === "text" && "synthetic" in p && p.synthetic
          );
          return !hasSyntheticPart;
        })
        .map((msg) => ({
          id: msg.info.id,
          role: msg.info.role,
          timestamp: new Date(msg.info.time.created).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          parts: msg.parts.map((p) => {
            if (p.type === "text") {
              return {
                type: "text" as const,
                partId: p.id,
                text: p.text,
              };
            }
            if (p.type === "reasoning") {
              return {
                type: "reasoning" as const,
                partId: p.id,
                text: "text" in p ? (p as { text: string }).text : "",
                isStreaming: false,
              };
            }
            if (p.type === "tool") {
              return {
                type: "tool" as const,
                partId: p.id,
                tool: "tool" in p ? (p as { tool: string }).tool : "",
                callID: "callID" in p ? (p as { callID: string }).callID : "",
                state: "state" in p ? (p as { state: unknown }).state : { status: "completed" },
              };
            }
            // Default fallback for unknown types
            return {
              type: "text" as const,
              partId: "id" in p ? (p as { id: string }).id : "unknown",
              text: "",
            };
          }),
          // Compute content from text parts for backwards compatibility
          content: msg.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join(""),
        }));
      
      return NextResponse.json({ sessionId: mapping.sessionId, messages });
    }

    // Session is dead, remove stale mapping
    await sessionStorage.removeSession(id, issueNum);
    return NextResponse.json({ sessionId: null });
  } catch (error) {
    console.error("Failed to get session:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/issues/[issueNumber]/session - Create/resume session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  try {
    const { id, issueNumber } = await params;

    // Validate issue number
    const issueNum = parseInt(issueNumber, 10);
    if (isNaN(issueNum) || issueNum <= 0) {
      return NextResponse.json(
        { error: "Invalid issue number" },
        { status: 400 }
      );
    }

    // Get project to find path
    const project = await configService.getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch issue details via gh CLI
    let issue: GitHubIssue;
    try {
      issue = await fetchIssue(project.path, issueNum);
    } catch (error) {
      console.error("Failed to fetch issue:", error);

      // Check for common gh CLI errors
      if (error instanceof Error) {
        if (error.message.includes("gh: command not found")) {
          return NextResponse.json(
            {
              error:
                "GitHub CLI not installed. Please install gh: https://cli.github.com",
            },
            { status: 500 }
          );
        }
        if (error.message.includes("not logged in")) {
          return NextResponse.json(
            {
              error:
                "GitHub CLI not authenticated. Run `gh auth login` in terminal.",
            },
            { status: 401 }
          );
        }
        if (error.message.includes("not a git repository")) {
          return NextResponse.json(
            { error: "Not a git repository" },
            { status: 400 }
          );
        }
        if (
          error.message.includes("Could not resolve") ||
          error.message.includes("not found")
        ) {
          return NextResponse.json({ error: "Issue not found" }, { status: 404 });
        }
      }

      return NextResponse.json(
        { error: "Failed to fetch issue" },
        { status: 500 }
      );
    }

    // Create new OpenCode session
    const sessionTitle = `Issue #${issueNum}: ${issue.title}`;
    const { id: sessionId } = await openCodeService.createSession(
      project.path,
      sessionTitle
    );

    // Inject issue context
    const context = buildIssueContext(issue);
    await openCodeService.injectContext(project.path, sessionId, context);

    // Save session mapping to sessionStorage
    await sessionStorage.saveSession(id, project.path, issueNum, sessionId);

    return NextResponse.json({ sessionId }, { status: 201 });
  } catch (error) {
    console.error("Failed to create session:", error);

    // Check for OpenCode service errors
    if (error instanceof Error) {
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("fetch failed")
      ) {
        return NextResponse.json(
          { error: "OpenCode service not available" },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/issues/[issueNumber]/session - Delete existing session
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  try {
    const { id, issueNumber } = await params;

    // Validate issue number
    const issueNum = parseInt(issueNumber, 10);
    if (isNaN(issueNum) || issueNum <= 0) {
      return NextResponse.json(
        { error: "Invalid issue number" },
        { status: 400 }
      );
    }

    // Get project to find path
    const project = await configService.getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check for existing session
    const mapping = await sessionStorage.getSession(id, issueNum);
    if (mapping) {
      // Delete the OpenCode session
      await openCodeService.deleteSession(project.path, mapping.sessionId);
      // Remove from session storage
      await sessionStorage.removeSession(id, issueNum);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
