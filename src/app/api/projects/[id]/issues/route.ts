import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { configService } from "@/lib/services/config";
import { openCodeService } from "@/lib/services/opencode";
import { sessionStorage } from "@/lib/services/sessions";

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

/**
 * Generate a clean title from the user's prompt.
 * - Replaces newlines with spaces (prompts can be multi-line)
 * - Truncates to ~80 chars, breaking at word boundary
 * - Adds ellipsis if truncated
 */
const generateInitialTitle = (text: string): string => {
  // Clean up: replace newlines and collapse whitespace
  const cleaned = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  const maxLength = 80;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Try to break at a word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.5) {
    // Break at word boundary if we're not losing too much
    return truncated.substring(0, lastSpace) + '...';
  }
  
  // Otherwise just truncate
  return truncated.substring(0, maxLength - 3) + '...';
};

// POST /api/projects/[id]/issues - Create a new GitHub issue
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const initialTitle = generateInitialTitle(prompt);

    // Get project to find path
    const project = await configService.getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Use the project path from config, not from request body
    const cwd = project.path;

    // Create issue using gh CLI
    // gh issue create doesn't support --json, so we create first then fetch
    // Escape shell special characters in the title
    const escapedTitle = initialTitle
      .replace(/\\/g, '\\\\')   // Escape backslashes first
      .replace(/"/g, '\\"')     // Escape double quotes
      .replace(/\$/g, '\\$')    // Escape dollar signs (prevent shell expansion)
      .replace(/`/g, '\\`');    // Escape backticks

    const placeholderBody = 'Generating description...';

    const { stdout: createStdout, stderr: createStderr } = await execAsync(
      `gh issue create --title "${escapedTitle}" --body "${placeholderBody}"`,
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

    // Create OpenCode session for this issue
    let sessionId: string | undefined;
    try {
      // Note: issueNumber is available from line 159 (from URL regex match)
      // initialTitle is the truncated prompt from generateInitialTitle()
      const session = await openCodeService.createSession(
        cwd,
        `Issue #${issueNumber}: ${initialTitle}`
      );
      sessionId = session.id;
      
      // Save session mapping for later retrieval
      // Note: issueNumber is a string, but saveSession expects number
      await sessionStorage.saveSession(id, cwd, parseInt(issueNumber), sessionId);

      // Inject context instructing agent to update the issue
      const contextText = `
You are helping with GitHub issue #${issueNumber} in this repository.

The user has provided a prompt describing what they want to build or explore. Your job is to:

1. **Explore the codebase** to understand the relevant context, existing patterns, and potential impact areas.

2. **Update the GitHub issue** with a clear title and comprehensive description. 
   
   IMPORTANT: Use a heredoc or --body-file for the body to handle special characters safely:
   
   \`\`\`bash
   gh issue edit ${issueNumber} --title "<improved title>" --body-file /dev/stdin << 'ISSUEBODY'
   ## Summary
   ...your markdown content...
   ISSUEBODY
   \`\`\`
   
   Alternatively, for simpler content:
   gh issue edit ${issueNumber} --title "<improved title>" --body "<markdown description>"

3. **Format the description** with these sections as appropriate:
   - **Summary**: 1-2 sentences explaining the goal
   - **Background**: Why this is needed, what problem it solves
   - **Requirements**: Specific things that need to be implemented
   - **Technical Approach**: How to implement it, what files/components are involved
   - **Acceptance Criteria**: How to verify the work is complete
   - **Open Questions**: Any decisions that need to be made

**Important:**
- The title should be clear, concise, and in imperative mood (e.g., "Add dark mode toggle to settings")
- The description should be comprehensive enough that another developer could implement it
- Include file paths, function names, and other specific references discovered during exploration
- If the prompt is vague, make reasonable assumptions and note them as open questions
- Escape any special shell characters in your commands, or use heredocs for safety

After you update the issue, briefly confirm what you did and ask if the user wants to refine anything.
`;

      await openCodeService.injectContext(cwd, sessionId, contextText);

      // Send the user's prompt to the agent
      // This is fire-and-forget - agent will work asynchronously
      await openCodeService.sendMessageWithBashAsync(cwd, sessionId, prompt.trim());
    } catch (sessionError) {
      // Log but don't fail - issue was created successfully
      // User can still interact with the issue, just won't have the AI session
      console.error("Failed to create OpenCode session:", sessionError);
    }

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
