import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  Conversation,
  GitProvider,
  Project,
  Session,
  createProject,
  generateId,
  nowIso
} from "@maestro/core";
import {
  deleteConversation,
  getMaestroPaths,
  listConversations,
  listProjects,
  listSessions,
  readConversation,
  readCurrentContext,
  readProjectById,
  readSession,
  readTranscriptHistory,
  setCurrentContext,
  writeConversation,
  writeProject,
  writeSession
} from "@maestro/storage";
import {
  deleteBranch,
  getRepoDisplayName,
  prepareWorkspace,
  removeWorktree,
  resolveRepoRoot
} from "@maestro/git";

type ServerOptions = {
  port: number;
  host: string;
};

type PullRequestInfo = {
  id: string;
  title: string;
  url: string;
  author?: string;
  sourceBranch?: string;
  targetBranch?: string;
  updatedAt?: string;
  provider: GitProvider;
  repo: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "../../web/dist");
const execFileAsync = promisify(execFile);

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
};

const sendBadRequest = (res: ServerResponse, message: string): void => {
  sendJson(res, 400, { error: message });
};

const sendNotFound = (res: ServerResponse): void => {
  sendJson(res, 404, { error: "Not Found" });
};

const sendError = (res: ServerResponse, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  sendJson(res, 500, { error: message });
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const buildConversationTitle = (options: {
  repoLabel: string;
  createdAt: string;
  defaultBranch: string;
  fromRef?: string;
  title?: string;
}): string | undefined => {
  const provided = options.title?.trim();
  if (provided) {
    return provided;
  }
  const timestamp = formatTimestamp(options.createdAt);
  const suffix =
    options.fromRef && options.fromRef !== options.defaultBranch
      ? ` (${options.fromRef})`
      : "";
  return `${options.repoLabel} - ${timestamp}${suffix}`;
};

const buildSessionTitle = (options: {
  createdAt: string;
  model?: string;
  title?: string;
}): string | undefined => {
  const provided = options.title?.trim();
  if (provided) {
    return provided;
  }
  const timestamp = formatTimestamp(options.createdAt);
  return `${timestamp} - ${options.model ?? "default"}`;
};

const normalizeGitProvider = (value?: string | null): GitProvider | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "github" || normalized === "gitlab") {
    return normalized as GitProvider;
  }
  return undefined;
};

const normalizeRepoUrl = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  let candidate = trimmed;
  if (candidate.startsWith("git+")) {
    candidate = candidate.slice(4);
  }
  if (candidate.startsWith("github:")) {
    return `https://github.com/${candidate.slice("github:".length)}`.replace(/\.git$/, "");
  }
  if (candidate.startsWith("gitlab:")) {
    return `https://gitlab.com/${candidate.slice("gitlab:".length)}`.replace(/\.git$/, "");
  }
  const sshMatch = candidate.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    const host = sshMatch[1];
    const repoPath = sshMatch[2].replace(/\.git$/, "");
    return `https://${host}/${repoPath}`;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "ssh:") {
      const repoPath = parsed.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
      return `https://${parsed.hostname}/${repoPath}`;
    }
    return candidate.replace(/\.git$/, "");
  } catch {
    return candidate.replace(/\.git$/, "");
  }
};

const inferGitProvider = (repoUrl?: string): GitProvider | undefined => {
  if (!repoUrl) {
    return undefined;
  }
  const lower = repoUrl.toLowerCase();
  try {
    const parsed = new URL(repoUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("github")) {
      return "github";
    }
    if (host.includes("gitlab")) {
      return "gitlab";
    }
  } catch {
    if (lower.includes("github.com")) {
      return "github";
    }
    if (lower.includes("gitlab.com")) {
      return "gitlab";
    }
  }
  return undefined;
};

const parseRepoUrl = (repoUrl: string): { host: string; path: string } | null => {
  try {
    const parsed = new URL(repoUrl);
    const host = parsed.hostname;
    const pathName = parsed.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
    if (!host || !pathName) {
      return null;
    }
    return { host, path: pathName.replace(/\/+$/, "") };
  } catch {
    return null;
  }
};

const buildGitHubApiBase = (host: string): string => {
  if (host === "github.com") {
    return "https://api.github.com";
  }
  return `https://${host}/api/v3`;
};

const buildGitLabApiBase = (host: string): string => {
  return `https://${host}/api/v4`;
};

const fetchGitHubPullRequests = async (
  repoUrl: string,
  limit: number
): Promise<PullRequestInfo[]> => {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error("Invalid GitHub repository URL.");
  }
  const [owner, repo] = parsed.path.split("/");
  if (!owner || !repo) {
    throw new Error("GitHub repository URL must include owner and repo.");
  }
  const apiBase = buildGitHubApiBase(parsed.host);
  const url = new URL(`${apiBase}/repos/${owner}/${repo}/pulls`);
  url.searchParams.set("state", "open");
  url.searchParams.set("per_page", String(limit));
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Maestro"
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status}).`);
  }
  const payload = (await response.json()) as Array<{
    id: number;
    title: string;
    html_url: string;
    updated_at?: string;
    user?: { login?: string };
    head?: { ref?: string };
    base?: { ref?: string };
  }>;
  return payload.map((item) => ({
    id: String(item.id),
    title: item.title,
    url: item.html_url,
    author: item.user?.login,
    sourceBranch: item.head?.ref,
    targetBranch: item.base?.ref,
    updatedAt: item.updated_at,
    provider: "github",
    repo: `${owner}/${repo}`
  }));
};

const fetchGitLabMergeRequests = async (
  repoUrl: string,
  limit: number
): Promise<PullRequestInfo[]> => {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error("Invalid GitLab repository URL.");
  }
  const apiBase = buildGitLabApiBase(parsed.host);
  const url = new URL(
    `${apiBase}/projects/${encodeURIComponent(parsed.path)}/merge_requests`
  );
  url.searchParams.set("state", "opened");
  url.searchParams.set("per_page", String(limit));
  const headers: Record<string, string> = {
    "User-Agent": "Maestro"
  };
  const token = process.env.GITLAB_TOKEN;
  if (token) {
    headers["PRIVATE-TOKEN"] = token;
  }
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`GitLab API error (${response.status}).`);
  }
  const payload = (await response.json()) as Array<{
    id: number;
    iid?: number;
    title: string;
    web_url: string;
    updated_at?: string;
    author?: { username?: string };
    source_branch?: string;
    target_branch?: string;
  }>;
  return payload.map((item) => ({
    id: String(item.iid ?? item.id),
    title: item.title,
    url: item.web_url,
    author: item.author?.username,
    sourceBranch: item.source_branch,
    targetBranch: item.target_branch,
    updatedAt: item.updated_at,
    provider: "gitlab",
    repo: parsed.path
  }));
};

const readPackageJson = async (repoRoot: string): Promise<Record<string, unknown> | null> => {
  try {
    const raw = await fs.readFile(path.join(repoRoot, "package.json"), "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const detectRepoInfoFromPackageJson = async (
  repoRoot: string
): Promise<{ repoUrl?: string; gitProvider?: GitProvider }> => {
  const pkg = await readPackageJson(repoRoot);
  if (!pkg) {
    return {};
  }
  const repository = pkg.repository;
  const bugs = pkg.bugs as { url?: string } | undefined;
  const homepage = typeof pkg.homepage === "string" ? pkg.homepage : undefined;
  let repoCandidate: string | undefined;
  if (typeof repository === "string") {
    repoCandidate = repository;
  } else if (repository && typeof repository === "object") {
    const repoObj = repository as { url?: string };
    repoCandidate = repoObj.url;
  }
  repoCandidate = repoCandidate ?? bugs?.url ?? homepage;
  const repoUrl = normalizeRepoUrl(repoCandidate ?? undefined);
  const gitProvider = inferGitProvider(repoUrl);
  return { repoUrl, gitProvider };
};

const parseSegments = (pathname: string): string[] => {
  return pathname.split("/").filter(Boolean);
};

const resolveRepoRootFromQuery = async (
  url: URL,
  fallbackRoot: string
): Promise<string> => {
  const repoParam = url.searchParams.get("repoPath");
  if (!repoParam) {
    return fallbackRoot;
  }
  return resolveRepoRoot(path.resolve(repoParam));
};

const escapeAppleScriptString = (value: string): string => {
  return value.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
};

const selectDirectory = async (prompt: string, startPath?: string): Promise<string> => {
  if (process.platform !== "darwin") {
    throw new Error("Folder picker only supported on macOS.");
  }
  const escapedPrompt = escapeAppleScriptString(prompt);
  const lines: string[] = [];
  if (startPath) {
    const resolvedPath = path.resolve(startPath);
    const escapedPath = escapeAppleScriptString(resolvedPath);
    lines.push(
      `set chosenFolder to (choose folder with prompt "${escapedPrompt}" default location (POSIX file "${escapedPath}"))`
    );
  } else {
    lines.push(`set chosenFolder to (choose folder with prompt "${escapedPrompt}")`);
  }
  lines.push("POSIX path of chosenFolder");
  const args = lines.flatMap((line) => ["-e", line]);
  const { stdout } = await execFileAsync("osascript", args);
  const selected = stdout.trim();
  if (!selected) {
    throw new Error("No folder selected.");
  }
  return path.resolve(selected);
};

const readJsonBody = async <T>(req: IncomingMessage): Promise<T> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
};

const readEventsFile = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string
): Promise<unknown[]> => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  const filePath = path.join(
    conversationsDir,
    conversationId,
    "sessions",
    sessionId,
    "events.ndjson"
  );
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    if (!raw.trim()) {
      return [];
    }
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const handleApi = async (req: IncomingMessage, res: ServerResponse, repoRoot: string) => {
  if (!req.url) {
    sendNotFound(res);
    return;
  }
  const url = new URL(req.url, "http://localhost");
  const segments = parseSegments(url.pathname);

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  if (req.method === "GET" && segments.length === 3 && segments[1] === "fs" && segments[2] === "root") {
    sendJson(res, 200, { path: repoRoot });
    return;
  }

  if (
    req.method === "POST" &&
    segments.length === 3 &&
    segments[1] === "fs" &&
    segments[2] === "select-directory"
  ) {
    try {
      const body = await readJsonBody<{ startPath?: string }>(req);
      const selectedPath = await selectDirectory("Select project folder", body.startPath);
      sendJson(res, 200, { path: selectedPath });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("cancel")) {
        sendBadRequest(res, "Selection cancelled.");
        return;
      }
      if (message.toLowerCase().includes("macos")) {
        sendJson(res, 501, { error: message });
        return;
      }
      sendError(res, error);
      return;
    }
  }

  let requestRepoRoot = repoRoot;
  try {
    requestRepoRoot = await resolveRepoRootFromQuery(url, repoRoot);
  } catch (error) {
    sendBadRequest(res, "Invalid repo path.");
    return;
  }

  if (req.method === "POST" && segments.length === 2 && segments[1] === "projects") {
    try {
      const body = await readJsonBody<{
        name?: string;
        defaultBranch?: string;
        repoPath?: string;
        gitProvider?: string | null;
        repoUrl?: string | null;
      }>(req);
      const name = body.name?.trim();
      if (!name) {
        sendBadRequest(res, "Project name is required.");
        return;
      }
      const defaultBranch = body.defaultBranch?.trim() || "main";
      const repoUrl = normalizeRepoUrl(body.repoUrl);
      const providedProvider = normalizeGitProvider(body.gitProvider ?? undefined);
      if (body.gitProvider && !providedProvider) {
        sendBadRequest(res, "Git provider must be github or gitlab.");
        return;
      }
      let targetRoot = requestRepoRoot;
      if (body.repoPath) {
        try {
          targetRoot = await resolveRepoRoot(path.resolve(body.repoPath));
        } catch {
          sendBadRequest(res, "Selected folder is not a git repository.");
          return;
        }
      }
      const detected = repoUrl ? {} : await detectRepoInfoFromPackageJson(targetRoot);
      const resolvedRepoUrl = repoUrl ?? detected.repoUrl;
      const gitProvider = providedProvider ?? inferGitProvider(resolvedRepoUrl) ?? detected.gitProvider;
      const project = createProject({
        name,
        repoPath: targetRoot,
        defaultBranch,
        gitProvider,
        repoUrl: resolvedRepoUrl
      });
      await writeProject(targetRoot, project);
      sendJson(res, 201, project);
      return;
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendBadRequest(res, "Invalid JSON body.");
        return;
      }
      sendError(res, error);
      return;
    }
  }

  if (req.method === "POST" && segments.length === 3 && segments[1] === "projects") {
    try {
      const body = await readJsonBody<{
        icon?: string | null;
        repoUrl?: string | null;
        gitProvider?: string | null;
      }>(req);
      const hasIcon = Object.prototype.hasOwnProperty.call(body, "icon");
      const hasRepoUrl = Object.prototype.hasOwnProperty.call(body, "repoUrl");
      const hasGitProvider = Object.prototype.hasOwnProperty.call(body, "gitProvider");
      if (!hasIcon && !hasRepoUrl && !hasGitProvider) {
        sendBadRequest(res, "Project update requires icon, repoUrl, or gitProvider.");
        return;
      }
      let project: Project;
      try {
        project = await readProjectById(requestRepoRoot, segments[2]);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          sendNotFound(res);
          return;
        }
        throw error;
      }
      let updated = false;

      if (hasIcon) {
        const trimmedIcon = typeof body.icon === "string" ? body.icon.trim() : "";
        project.icon = trimmedIcon || undefined;
        updated = true;
      }

      if (hasRepoUrl) {
        const repoUrl = normalizeRepoUrl(body.repoUrl ?? null);
        project.repoUrl = repoUrl;
        if (!repoUrl && !hasGitProvider) {
          project.gitProvider = undefined;
        }
        updated = true;
      }

      if (hasGitProvider) {
        const provider = normalizeGitProvider(body.gitProvider ?? undefined);
        if (body.gitProvider && !provider) {
          sendBadRequest(res, "Git provider must be github or gitlab.");
          return;
        }
        project.gitProvider = provider;
        updated = true;
      } else if (hasRepoUrl) {
        const inferred = inferGitProvider(project.repoUrl);
        if (inferred) {
          project.gitProvider = inferred;
          updated = true;
        }
      }

      if (updated) {
        project.updatedAt = nowIso();
        await writeProject(requestRepoRoot, project);
      }
      sendJson(res, 200, project);
      return;
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendBadRequest(res, "Invalid JSON body.");
        return;
      }
      sendError(res, error);
      return;
    }
  }

  if (
    req.method === "POST" &&
    segments.length === 4 &&
    segments[1] === "projects" &&
    segments[3] === "detect-repo"
  ) {
    try {
      let project: Project;
      try {
        project = await readProjectById(requestRepoRoot, segments[2]);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          sendNotFound(res);
          return;
        }
        throw error;
      }
      const detected = await detectRepoInfoFromPackageJson(project.repoPath);
      if (!detected.repoUrl && !detected.gitProvider) {
        sendBadRequest(res, "No repository metadata found in package.json.");
        return;
      }
      if (detected.repoUrl) {
        project.repoUrl = detected.repoUrl;
      }
      if (detected.gitProvider) {
        project.gitProvider = detected.gitProvider;
      } else if (detected.repoUrl) {
        project.gitProvider = inferGitProvider(detected.repoUrl) ?? project.gitProvider;
      }
      project.updatedAt = nowIso();
      await writeProject(requestRepoRoot, project);
      sendJson(res, 200, { project, detected: true });
      return;
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendBadRequest(res, "Invalid JSON body.");
        return;
      }
      sendError(res, error);
      return;
    }
  }

  if (
    req.method === "GET" &&
    segments.length === 4 &&
    segments[1] === "projects" &&
    segments[3] === "pull-requests"
  ) {
    try {
      let project: Project;
      try {
        project = await readProjectById(requestRepoRoot, segments[2]);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          sendNotFound(res);
          return;
        }
        throw error;
      }
      const repoUrl = project.repoUrl?.trim();
      if (!repoUrl) {
        sendBadRequest(res, "Project repo URL is required.");
        return;
      }
      const provider = project.gitProvider ?? inferGitProvider(repoUrl);
      if (!provider) {
        sendBadRequest(res, "Git provider could not be determined.");
        return;
      }
      const limitParam = Number(url.searchParams.get("limit") ?? 10);
      const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(Math.trunc(limitParam), 1), 50)
        : 10;
      const pullRequests =
        provider === "github"
          ? await fetchGitHubPullRequests(repoUrl, limit)
          : await fetchGitLabMergeRequests(repoUrl, limit);
      sendJson(res, 200, pullRequests);
      return;
    } catch (error) {
      sendError(res, error);
      return;
    }
  }

  if (req.method === "POST" && segments.length === 2 && segments[1] === "conversations") {
    try {
      const body = await readJsonBody<{
        projectId?: string;
        projectName?: string;
        repoPath?: string;
        title?: string;
        fromRef?: string;
        stash?: boolean;
      }>(req);
      const projectId = body.projectId?.trim();
      const projectName = body.projectName?.trim();
      const repoPath = body.repoPath?.trim();

      let project: Project | undefined;
      if (projectId || projectName) {
        const projects = await listProjects(requestRepoRoot, { includeAll: true });
        project = projects.find(
          (candidate) => candidate.id === projectId || candidate.name === projectName
        );
      } else if (repoPath) {
        const targetRoot = await resolveRepoRoot(path.resolve(repoPath));
        const projects = await listProjects(targetRoot, { includeAll: true });
        project = projects.find((candidate) => candidate.repoPath === targetRoot);
      } else {
        const projects = await listProjects(requestRepoRoot);
        project = projects.length === 1 ? projects[0] : undefined;
      }

      if (!project) {
        sendBadRequest(res, "Project is required to start a conversation.");
        return;
      }

      const conversationId = generateId("c");
      const workspace = await prepareWorkspace({
        repoRoot: project.repoPath,
        conversationId,
        projectName: project.name,
        conversationTitle: body.title?.trim() || undefined,
        defaultBranch: project.defaultBranch,
        fromRef: body.fromRef?.trim() || undefined,
        stash: body.stash ?? false
      });

      const ts = nowIso();
      const repoLabel = await getRepoDisplayName(project.repoPath);
      const conversationTitle = buildConversationTitle({
        repoLabel,
        createdAt: ts,
        defaultBranch: project.defaultBranch,
        fromRef: body.fromRef?.trim() || undefined,
        title: body.title
      });
      const conversation: Conversation = {
        id: conversationId,
        projectId: project.id,
        title: conversationTitle,
        branch: workspace.branch,
        workspacePath: workspace.worktreePath,
        baseRef: workspace.baseRef,
        baseSha: workspace.baseSha,
        stashRef: workspace.stashRef,
        createdAt: ts,
        updatedAt: ts
      };
      await writeConversation(project.repoPath, conversation);

      const sessionId = generateId("s");
      const model = process.env.MAESTRO_MODEL;
      const sessionTitle = buildSessionTitle({ createdAt: ts, model });
      const session: Session = {
        id: sessionId,
        conversationId: conversation.id,
        title: sessionTitle,
        model,
        createdAt: ts,
        updatedAt: ts
      };
      await writeSession(project.repoPath, conversation.id, session);
      await setCurrentContext(project.repoPath, {
        projectId: project.id,
        conversationId: conversation.id,
        sessionId: session.id
      });

      sendJson(res, 201, { project, conversation, session });
      return;
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendBadRequest(res, "Invalid JSON body.");
        return;
      }
      sendError(res, error);
      return;
    }
  }

  if (req.method === "GET" && segments.length === 2 && segments[1] === "health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && segments.length === 2 && segments[1] === "current") {
    const current = await readCurrentContext(requestRepoRoot);
    sendJson(res, 200, current);
    return;
  }

  if (req.method === "GET" && segments.length === 2 && segments[1] === "projects") {
    const includeAll = url.searchParams.get("all") === "1" || url.searchParams.get("all") === "true";
    const projects = await listProjects(requestRepoRoot, { includeAll });
    sendJson(res, 200, projects);
    return;
  }

  if (req.method === "GET" && segments.length === 2 && segments[1] === "conversations") {
    const conversations = await listConversations(requestRepoRoot);
    sendJson(res, 200, conversations);
    return;
  }

  if (req.method === "GET" && segments.length === 3 && segments[1] === "conversations") {
    const conversation = await readConversation(requestRepoRoot, segments[2]);
    sendJson(res, 200, conversation);
    return;
  }

  if (req.method === "DELETE" && segments.length === 3 && segments[1] === "conversations") {
    const confirm = url.searchParams.get("confirm");
    if (confirm !== "true" && confirm !== "1") {
      sendBadRequest(res, "Deletion requires confirm=true.");
      return;
    }
    try {
      const conversation = await readConversation(requestRepoRoot, segments[2]);
      const project = await readProjectById(requestRepoRoot, conversation.projectId);
      await removeWorktree(project.repoPath, conversation.workspacePath);
      await deleteBranch(project.repoPath, conversation.branch);
      await deleteConversation(project.repoPath, conversation.id);
      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      sendError(res, error);
      return;
    }
  }

  if (
    req.method === "GET" &&
    segments.length === 4 &&
    segments[1] === "conversations" &&
    segments[3] === "sessions"
  ) {
    const sessions = await listSessions(requestRepoRoot, segments[2]);
    sendJson(res, 200, sessions);
    return;
  }

  if (
    req.method === "GET" &&
    segments.length === 5 &&
    segments[1] === "conversations" &&
    segments[3] === "sessions"
  ) {
    const session = await readSession(requestRepoRoot, segments[2], segments[4]);
    sendJson(res, 200, session);
    return;
  }

  if (
    req.method === "GET" &&
    segments.length === 6 &&
    segments[1] === "conversations" &&
    segments[3] === "sessions" &&
    segments[5] === "transcript"
  ) {
    const transcript = await readTranscriptHistory(requestRepoRoot, segments[2], segments[4]);
    sendJson(res, 200, transcript);
    return;
  }

  if (
    req.method === "GET" &&
    segments.length === 6 &&
    segments[1] === "conversations" &&
    segments[3] === "sessions" &&
    segments[5] === "events"
  ) {
    const events = await readEventsFile(requestRepoRoot, segments[2], segments[4]);
    sendJson(res, 200, events);
    return;
  }

  sendNotFound(res);
};

const serveIndex = async (res: ServerResponse) => {
  const indexPath = path.join(webRoot, "index.html");
  try {
    const data = await fs.readFile(indexPath);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch (error) {
    sendError(res, new Error("Web UI not built. Run `bun run --cwd apps/web build` first."));
  }
};

const serveStatic = async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    sendNotFound(res);
    return;
  }
  const url = new URL(req.url, "http://localhost");
  let pathname = url.pathname;
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const normalizedPath = path.normalize(pathname);
  const filePath = path.resolve(webRoot, `.${normalizedPath}`);
  if (!filePath.startsWith(webRoot)) {
    sendNotFound(res);
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await serveIndex(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] ?? "application/octet-stream";
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await serveIndex(res);
      return;
    }
    sendError(res, error);
  }
};

export const startWebServer = async ({ port, host }: ServerOptions): Promise<void> => {
  const repoRoot = await resolveRepoRoot(process.cwd());
  const server = createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/api/")) {
        await handleApi(req, res, repoRoot);
        return;
      }
      await serveStatic(req, res);
    } catch (error) {
      sendError(res, error);
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });

  console.log(`Maestro web UI: http://${host}:${port}`);
};
