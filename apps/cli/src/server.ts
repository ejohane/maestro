import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  Conversation,
  GitProvider,
  MessagePart,
  Project,
  Session,
  TranscriptEntry,
  createProject,
  getTextFromParts,
  generateId,
  nowIso
} from "@maestro/core";
import {
  deleteConversation,
  deleteSession,
  getMaestroPaths,
  ModelProvider,
  listConversations,
  listProjects,
  listSessions,
  appendEventEntry,
  appendTranscriptEntry,
  readConversation,
  readCurrentContext,
  readSettings,
  readProjectById,
  readSession,
  readTranscriptEntries,
  readTranscriptHistory,
  setCurrentContext,
  updateConversationTimestamp,
  updateSessionTimestamp,
  writeConversation,
  writeProject,
  writeSettings,
  writeSession
} from "@maestro/storage";
import {
  deleteBranch,
  getRepoDisplayName,
  prepareWorkspace,
  removeWorktree,
  resolveRepoRoot
} from "@maestro/git";
import {
  DirectSDKClient,
  buildSystemMessage,
  createAuthedOpencodeClient,
  extractAssistantResponse,
  parseModel
} from "@maestro/opencode";
import {
  STATIC_DEFAULT_MODEL,
  STATIC_DEFAULT_PROVIDER,
  STATIC_MODEL_PROVIDERS
} from "./static-model-providers";

type ServerOptions = {
  port: number;
  host: string;
};

type PullRequestInfo = {
  id: string;
  number: string;
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

const isMessagePart = (part: unknown): part is MessagePart => {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    typeof (part as { type?: unknown }).type === "string"
  );
};

const normalizeMessageParts = (
  content: string,
  parts: MessagePart[]
): MessagePart[] | undefined => {
  if (parts.length > 0) {
    return parts;
  }
  if (content) {
    return [{ type: "text", text: content }];
  }
  return undefined;
};

const logLegacyMigrationWarning = (context: {
  conversationId: string;
  sessionId: string;
  reason: string;
  entry?: Pick<TranscriptEntry, "ts" | "role">;
}): void => {
  const prefix = "[legacy-migration]";
  const details = {
    conversationId: context.conversationId,
    sessionId: context.sessionId,
    ts: context.entry?.ts,
    role: context.entry?.role
  };
  console.warn(`${prefix} ${context.reason}`, details);
};

const getPartIndex = (parts: MessagePart[], part: MessagePart): number => {
  const partIndex = (part as { index?: unknown }).index;
  if (typeof partIndex === "number" && partIndex >= 0) {
    return partIndex;
  }
  const partId = (part as { id?: unknown }).id;
  if (typeof partId === "string") {
    return parts.findIndex((existing) => (existing as { id?: unknown }).id === partId);
  }
  return -1;
};

const mergeMessagePart = (
  existing: MessagePart | undefined,
  incoming: MessagePart,
  delta: unknown
): MessagePart => {
  const merged = { ...(existing ?? {}), ...incoming } as MessagePart & { text?: string };
  const existingText = typeof (existing as { text?: unknown } | undefined)?.text === "string"
    ? ((existing as { text?: unknown }).text as string)
    : "";
  const incomingText = typeof (incoming as { text?: unknown }).text === "string"
    ? ((incoming as { text?: unknown }).text as string)
    : "";
  if (incoming.type === "text" || incoming.type === "reasoning") {
    let nextText = existingText;
    if (incomingText && incomingText.startsWith(existingText)) {
      nextText = incomingText;
    } else if (typeof delta === "string") {
      nextText = existingText + delta;
    } else if (incomingText) {
      nextText = incomingText;
    }
    merged.text = nextText;
  }
  return merged;
};

const upsertMessagePart = (
  parts: MessagePart[],
  incoming: MessagePart,
  delta: unknown
): MessagePart[] => {
  const index = getPartIndex(parts, incoming);
  if (index >= 0) {
    const nextParts = parts.slice();
    nextParts[index] = mergeMessagePart(parts[index], incoming, delta);
    return nextParts;
  }
  return [...parts, mergeMessagePart(undefined, incoming, delta)];
};

const isWorktreeDirty = async (worktreePath: string): Promise<boolean> => {
  const { stdout } = await execFileAsync("git", [
    "-C",
    worktreePath,
    "status",
    "--porcelain"
  ]);
  return stdout.trim().length > 0;
};

const getDefaultModel = (): string => {
  return process.env.MAESTRO_MODEL ?? "openai/gpt-5.2-codex";
};

const sendSseEvent = (res: ServerResponse, event: string, payload: unknown): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
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

const normalizeText = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeModelProviders = (value: unknown): ModelProvider[] | undefined => {
  if (value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((provider) => {
      if (!provider || typeof provider !== "object") {
        return undefined;
      }
      const id = normalizeText((provider as { id?: string }).id);
      if (!id) {
        return undefined;
      }
      const name = normalizeText((provider as { name?: string }).name);
      const modelsRaw = (provider as { models?: unknown }).models;
      const models = Array.isArray(modelsRaw)
        ? modelsRaw
            .map((model) => {
              if (!model || typeof model !== "object") {
                return undefined;
              }
              const modelId = normalizeText((model as { id?: string }).id);
              if (!modelId) {
                return undefined;
              }
              const modelName = normalizeText((model as { name?: string }).name);
              return { id: modelId, name: modelName };
            })
            .filter(Boolean)
        : [];
      return { id, name, models } as ModelProvider;
    })
    .filter(Boolean) as ModelProvider[];
};

const resolveDefaultModelSelection = (
  providers: ModelProvider[],
  defaultProvider?: string,
  defaultModel?: string
): { defaultProvider?: string; defaultModel?: string } => {
  if (!providers.length) {
    return { defaultProvider: undefined, defaultModel: undefined };
  }
  const provider = providers.find((item) => item.id === defaultProvider) ?? providers[0];
  const model = provider.models.find((item) => item.id === defaultModel) ?? provider.models[0];
  return { defaultProvider: provider?.id, defaultModel: model?.id };
};

const resolveSettingsModel = async (repoRoot: string): Promise<string | undefined> => {
  const settings = await readSettings(repoRoot);
  let modelProviders = settings.modelProviders;
  let defaultProvider = settings.defaultProvider;
  let defaultModel = settings.defaultModel;
  if (modelProviders === undefined) {
    modelProviders = STATIC_MODEL_PROVIDERS;
    defaultProvider = defaultProvider ?? STATIC_DEFAULT_PROVIDER;
    defaultModel = defaultModel ?? STATIC_DEFAULT_MODEL;
  }
  const resolved = resolveDefaultModelSelection(
    modelProviders ?? [],
    defaultProvider,
    defaultModel
  );
  if (!resolved.defaultProvider || !resolved.defaultModel) {
    return undefined;
  }
  return `${resolved.defaultProvider}/${resolved.defaultModel}`;
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

const resolveGitHubToken = async (repoRoot: string): Promise<string | undefined> => {
  const envToken = process.env.GITHUB_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }
  const settings = await readSettings(repoRoot);
  const stored = settings.githubToken?.trim();
  return stored || undefined;
};

const buildGitLabApiBase = (host: string): string => {
  return `https://${host}/api/v4`;
};

const fetchGitHubPullRequests = async (
  repoRoot: string,
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
  const token = await resolveGitHubToken(repoRoot);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status}).`);
  }
  const payload = (await response.json()) as Array<{
    id: number;
    number: number;
    title: string;
    html_url: string;
    updated_at?: string;
    user?: { login?: string };
    head?: { ref?: string };
    base?: { ref?: string };
  }>;
  return payload.map((item) => ({
    id: String(item.id),
    number: String(item.number),
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
    number: String(item.iid ?? item.id),
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

const mergeGitHubPullRequest = async (
  repoRoot: string,
  repoUrl: string,
  pullNumber: string
): Promise<void> => {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error("Invalid GitHub repository URL.");
  }
  const [owner, repo] = parsed.path.split("/");
  if (!owner || !repo) {
    throw new Error("GitHub repository URL must include owner and repo.");
  }
  const token = await resolveGitHubToken(repoRoot);
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to merge GitHub pull requests.");
  }
  const apiBase = buildGitHubApiBase(parsed.host);
  const url = new URL(`${apiBase}/repos/${owner}/${repo}/pulls/${pullNumber}/merge`);
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "Maestro",
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    let message = `GitHub merge failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = `GitHub merge failed: ${payload.message}`;
      }
    } catch {
      // Ignore parsing errors
    }
    throw new Error(message);
  }
};

const mergeGitLabMergeRequest = async (
  repoUrl: string,
  mergeRequestIid: string
): Promise<void> => {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error("Invalid GitLab repository URL.");
  }
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error("GITLAB_TOKEN is required to merge GitLab merge requests.");
  }
  const apiBase = buildGitLabApiBase(parsed.host);
  const url = new URL(
    `${apiBase}/projects/${encodeURIComponent(parsed.path)}/merge_requests/${mergeRequestIid}/merge`
  );
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "User-Agent": "Maestro",
      "PRIVATE-TOKEN": token
    }
  });
  if (!response.ok) {
    let message = `GitLab merge failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      const detail = payload.message ?? payload.error;
      if (detail) {
        message = `GitLab merge failed: ${detail}`;
      }
    } catch {
      // Ignore parsing errors
    }
    throw new Error(message);
  }
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

const createAssistantMessageId = (): string => {
  return `m_${Math.random().toString(36).slice(2, 10)}`;
};

const handleApi = async (req: IncomingMessage, res: ServerResponse, repoRoot: string) => {
  if (!req.url) {
    sendNotFound(res);
    return;
  }
  const url = new URL(req.url, "http://localhost");
  const segments = parseSegments(url.pathname);

  if (
    req.method !== "GET" &&
    req.method !== "POST" &&
    req.method !== "DELETE" &&
    req.method !== "PUT"
  ) {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  if (req.method === "GET" && segments.length === 2 && segments[1] === "settings") {
    const settings = await readSettings(repoRoot);
    let modelProviders = settings.modelProviders;
    let defaultProvider = settings.defaultProvider;
    let defaultModel = settings.defaultModel;
    if (modelProviders === undefined) {
      modelProviders = STATIC_MODEL_PROVIDERS;
      defaultProvider = defaultProvider ?? STATIC_DEFAULT_PROVIDER;
      defaultModel = defaultModel ?? STATIC_DEFAULT_MODEL;
      await writeSettings(repoRoot, {
        ...settings,
        modelProviders,
        defaultProvider,
        defaultModel
      });
    }
    const resolved = resolveDefaultModelSelection(
      modelProviders ?? [],
      defaultProvider,
      defaultModel
    );
    sendJson(res, 200, {
      ...settings,
      modelProviders: modelProviders ?? [],
      defaultProvider: resolved.defaultProvider,
      defaultModel: resolved.defaultModel
    });
    return;
  }

  if (req.method === "PUT" && segments.length === 2 && segments[1] === "settings") {
    try {
      const body = await readJsonBody<{
        githubToken?: string | null;
        gotlandToken?: string | null;
        modelProviders?: unknown;
        defaultProvider?: string | null;
        defaultModel?: string | null;
      }>(req);
      const currentSettings = await readSettings(repoRoot);
      const normalizeToken = (value?: string | null): string | undefined => {
        if (typeof value !== "string") {
          return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      };
      const normalizedProviders = normalizeModelProviders(body.modelProviders);
      const modelProviders =
        body.modelProviders === null
          ? []
          : normalizedProviders ?? currentSettings.modelProviders ?? [];
      const hasDefaultProvider = Object.prototype.hasOwnProperty.call(body, "defaultProvider");
      const hasDefaultModel = Object.prototype.hasOwnProperty.call(body, "defaultModel");
      const requestedDefaultProvider = hasDefaultProvider
        ? normalizeText(body.defaultProvider ?? null)
        : currentSettings.defaultProvider;
      const requestedDefaultModel = hasDefaultModel
        ? normalizeText(body.defaultModel ?? null)
        : currentSettings.defaultModel;
      const resolved = resolveDefaultModelSelection(
        modelProviders,
        requestedDefaultProvider,
        requestedDefaultModel
      );
      const nextSettings = {
        githubToken: normalizeToken(body.githubToken),
        gotlandToken: normalizeToken(body.gotlandToken),
        modelProviders,
        defaultProvider: resolved.defaultProvider,
        defaultModel: resolved.defaultModel
      };
      await writeSettings(repoRoot, nextSettings);
      sendJson(res, 200, nextSettings);
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
          ? await fetchGitHubPullRequests(requestRepoRoot, repoUrl, limit)
          : await fetchGitLabMergeRequests(repoUrl, limit);
      sendJson(res, 200, pullRequests);
      return;
    } catch (error) {
      sendError(res, error);
      return;
    }
  }

  if (
    req.method === "POST" &&
    segments.length === 6 &&
    segments[1] === "projects" &&
    segments[3] === "pull-requests" &&
    segments[5] === "merge"
  ) {
    try {
      const pullRequestId = segments[4]?.trim();
      if (!pullRequestId) {
        sendBadRequest(res, "Pull request id is required.");
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
      if (provider === "github") {
        await mergeGitHubPullRequest(requestRepoRoot, repoUrl, pullRequestId);
      } else {
        await mergeGitLabMergeRequest(repoUrl, pullRequestId);
      }
      sendJson(res, 200, { merged: true, id: pullRequestId });
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
      const sessionTitle = undefined;
      const session: Session = {
        id: sessionId,
        conversationId: conversation.id,
        title: sessionTitle,
        model,
        createdAt: ts,
        updatedAt: ts
      };
      await writeSession(project.repoPath, conversation.id, session);

      const client = new DirectSDKClient();
      const opencodeSessionId = await client.ensureSession({
        sessionId: session.opencodeSessionId,
        title: session.title?.trim() || undefined,
        workspacePath: conversation.workspacePath
      } as any);
      if (opencodeSessionId !== session.opencodeSessionId) {
        session.opencodeSessionId = opencodeSessionId;
        await writeSession(project.repoPath, conversation.id, session);
      }

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

  if (
    req.method === "GET" &&
    segments.length === 4 &&
    segments[1] === "conversations" &&
    segments[3] === "status"
  ) {
    try {
      const conversation = await readConversation(requestRepoRoot, segments[2]);
      const dirty = await isWorktreeDirty(conversation.workspacePath);
      sendJson(res, 200, { dirty });
      return;
    } catch (error) {
      sendError(res, error);
      return;
    }
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
    if (!sessions.length) {
      sendJson(res, 200, sessions);
      return;
    }
    const opencodeClient = createAuthedOpencodeClient();
    const hydrated = await Promise.all(
      sessions.map(async (session) => {
        if (!session.opencodeSessionId) {
          return session;
        }
        try {
          const response = await opencodeClient.session.get({
            path: { id: session.opencodeSessionId }
          });
          const payload = (response as any)?.data ?? response;
          const title = typeof payload?.title === "string" ? payload.title.trim() : "";
          if (!title) {
            return session;
          }
          return { ...session, title };
        } catch {
          return session;
        }
      })
    );
    sendJson(res, 200, hydrated);
    return;
  }

  if (
    req.method === "POST" &&
    segments.length === 4 &&
    segments[1] === "conversations" &&
    segments[3] === "sessions"
  ) {
    try {
      const body = await readJsonBody<{ title?: string; model?: string }>(req);
      let conversation: Conversation;
      try {
        conversation = await readConversation(requestRepoRoot, segments[2]);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          sendNotFound(res);
          return;
        }
        throw error;
      }
      const ts = nowIso();
      const requestedModel = body.model?.trim();
      const model =
        requestedModel ?? (await resolveSettingsModel(requestRepoRoot)) ?? getDefaultModel();
      const sessionTitle = body.title?.trim() || undefined;
      const session: Session = {
        id: generateId("s"),
        conversationId: conversation.id,
        title: sessionTitle,
        model,
        createdAt: ts,
        updatedAt: ts
      };
      await writeSession(requestRepoRoot, conversation.id, session);
      const client = new DirectSDKClient();
      const opencodeSessionId = await client.ensureSession({
        sessionId: session.opencodeSessionId,
        title: session.title?.trim() || undefined,
        workspacePath: conversation.workspacePath
      } as any);
      if (opencodeSessionId !== session.opencodeSessionId) {
        session.opencodeSessionId = opencodeSessionId;
        await writeSession(requestRepoRoot, conversation.id, session);
      }
      await updateConversationTimestamp(requestRepoRoot, conversation);
      await setCurrentContext(requestRepoRoot, {
        projectId: conversation.projectId,
        conversationId: conversation.id,
        sessionId: session.id
      });
      sendJson(res, 201, session);
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
    req.method === "DELETE" &&
    segments.length === 5 &&
    segments[1] === "conversations" &&
    segments[3] === "sessions"
  ) {
    const confirm = url.searchParams.get("confirm");
    if (confirm !== "true" && confirm !== "1") {
      sendBadRequest(res, "Deletion requires confirm=true.");
      return;
    }
    try {
      let conversation: Conversation;
      try {
        conversation = await readConversation(requestRepoRoot, segments[2]);
        await readSession(requestRepoRoot, segments[2], segments[4]);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          sendNotFound(res);
          return;
        }
        throw error;
      }
      await deleteSession(requestRepoRoot, segments[2], segments[4]);
      await updateConversationTimestamp(requestRepoRoot, conversation);
      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      sendError(res, error);
      return;
    }
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
    req.method === "POST" &&
    segments.length === 7 &&
    segments[1] === "conversations" &&
    segments[3] === "sessions" &&
    segments[5] === "chat" &&
    segments[6] === "stream"
  ) {
    try {
      const body = await readJsonBody<{
        message?: string;
        content?: string;
        parts?: MessagePart[];
        metadata?: Record<string, unknown>;
      }>(req);
      const contentInput = body.message?.trim() ?? body.content?.trim() ?? "";
      const incomingParts = Array.isArray(body.parts) ? body.parts.filter(isMessagePart) : [];
      const derivedContent =
        contentInput || (incomingParts.length > 0 ? getTextFromParts(incomingParts) : "");
      const metadata =
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? body.metadata
          : undefined;
      if (!derivedContent && incomingParts.length === 0) {
        sendBadRequest(res, "Message is required.");
        return;
      }
      let conversation: Conversation;
      let session: Session;
      try {
        conversation = await readConversation(requestRepoRoot, segments[2]);
        session = await readSession(requestRepoRoot, segments[2], segments[4]);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          sendNotFound(res);
          return;
        }
        throw error;
      }

      if (!session.model) {
        session.model =
          (await resolveSettingsModel(requestRepoRoot)) ?? getDefaultModel();
        await writeSession(requestRepoRoot, conversation.id, session);
      }

      const directClient = new DirectSDKClient();
      const opencodeSessionId = await directClient.ensureSession({
        sessionId: session.opencodeSessionId,
        title: session.title?.trim() || undefined,
        workspacePath: conversation.workspacePath
      } as any);
      if (opencodeSessionId !== session.opencodeSessionId) {
        session.opencodeSessionId = opencodeSessionId;
        await writeSession(requestRepoRoot, conversation.id, session);
      }

      const ts = nowIso();
      const userEntry: TranscriptEntry = {
        ts,
        role: "user",
        content: derivedContent,
        parts: normalizeMessageParts(derivedContent, incomingParts),
        metadata,
        sessionId: session.id,
        conversationId: conversation.id
      };
      await appendTranscriptEntry(requestRepoRoot, conversation.id, session.id, userEntry);

      const history = await readTranscriptHistory(requestRepoRoot, conversation.id, session.id);
      const system = buildSystemMessage(conversation.workspacePath, history);

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive"
      });

      const assistantMessageId = createAssistantMessageId();
      sendSseEvent(res, "message_start", { id: assistantMessageId, role: "assistant" });

      const streamController = new AbortController();
      const closeHandler = () => streamController.abort();
      req.on("close", closeHandler);

      const client = createAuthedOpencodeClient();
      const eventResponse = await client.event.subscribe({
        query: { directory: conversation.workspacePath },
        signal: streamController.signal
      });

      let assistantContent = "";
      let assistantParts: MessagePart[] = [];
      const eventTask = (async () => {
        for await (const event of eventResponse.stream) {
          await appendEventEntry(requestRepoRoot, conversation.id, session.id, {
            ts: nowIso(),
            type: "sdk_event",
            data: event,
            sessionId: session.id,
            conversationId: conversation.id
          });
          if (event?.type !== "message.part.updated") {
            continue;
          }
          const part = (event as any).properties?.part;
          const delta = (event as any).properties?.delta;
          const partSessionId = (part as { sessionID?: unknown })?.sessionID;
          if (!part || !isMessagePart(part) || partSessionId !== opencodeSessionId) {
            continue;
          }
          assistantParts = upsertMessagePart(assistantParts, part, delta);
          sendSseEvent(res, "message_part_updated", {
            id: assistantMessageId,
            partType: part.type,
            delta,
            part: assistantParts[getPartIndex(assistantParts, part)] ?? part
          });
          if (part.type === "text" && typeof delta === "string" && delta.length > 0) {
            assistantContent += delta;
            sendSseEvent(res, "message_delta", { delta });
          }
        }
      })();

      try {
        const resolvedModel =
          parseModel(session.model) ??
          parseModel(await resolveSettingsModel(requestRepoRoot)) ??
          parseModel(getDefaultModel());
        const response = await client.session.prompt({
          path: { id: opencodeSessionId },
          body: {
            model: resolvedModel ?? undefined,
            system: system ?? undefined,
            parts: [{ type: "text", text: derivedContent }]
          },
          query: { directory: conversation.workspacePath }
        });
        const responseData =
          ((response as { data?: unknown })?.data ?? response ?? {}) as { parts?: unknown[] };
        const responseParts = Array.isArray(responseData.parts)
          ? responseData.parts.filter(isMessagePart)
          : [];
        if (responseParts.length > 0 && assistantParts.length === 0) {
          assistantParts = responseParts;
        }
        if (!assistantContent) {
          const extracted = extractAssistantResponse(response);
          assistantContent = extracted.content;
        }
      } finally {
        streamController.abort();
        req.off("close", closeHandler);
        try {
          await eventTask;
        } catch {
          // ignore
        }
      }

      if (!assistantContent && assistantParts.length > 0) {
        assistantContent = getTextFromParts(assistantParts);
      }

      const normalizedAssistantParts = normalizeMessageParts(assistantContent, assistantParts);
      if (assistantContent.length > 0 || assistantParts.length > 0) {
        const assistantEntry: TranscriptEntry = {
          ts: nowIso(),
          role: "assistant",
          content: assistantContent,
          parts: normalizedAssistantParts,
          sessionId: session.id,
          conversationId: conversation.id
        };
        await appendTranscriptEntry(requestRepoRoot, conversation.id, session.id, assistantEntry);
      }

      await updateSessionTimestamp(requestRepoRoot, conversation.id, session);
      await updateConversationTimestamp(requestRepoRoot, conversation);

      sendSseEvent(res, "message_end", {
        id: assistantMessageId,
        content: assistantContent,
        parts: normalizedAssistantParts
      });
      res.end();
      return;
    } catch (error) {
      if (res.headersSent) {
        sendSseEvent(res, "error", {
          message: error instanceof Error ? error.message : String(error)
        });
        res.end();
        return;
      }
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
    segments.length === 6 &&
    segments[1] === "conversations" &&
    segments[3] === "sessions" &&
    segments[5] === "transcript"
  ) {
    const entries = await readTranscriptEntries(requestRepoRoot, segments[2], segments[4]);
      const transcript = entries.map((entry) => {
        const role: "user" | "assistant" | "system" =
          entry.role === "user" || entry.role === "assistant" || entry.role === "system"
            ? entry.role
            : entry.role === "tool"
              ? "assistant"
              : "user";
        const content = typeof entry.content === "string" ? entry.content : "";
        const parts = Array.isArray(entry.parts) ? entry.parts.filter(isMessagePart) : [];
        const partsText = parts.length > 0 ? getTextFromParts(parts) : "";
        const resolvedContent = content || partsText;
        if (!resolvedContent && parts.length === 0) {
          logLegacyMigrationWarning({
            conversationId: segments[2],
            sessionId: segments[4],
            reason: "Transcript entry missing content and parts.",
            entry
          });
        } else if (content && partsText && content !== partsText) {
          logLegacyMigrationWarning({
            conversationId: segments[2],
            sessionId: segments[4],
            reason: "Transcript entry content does not match text parts.",
            entry
          });
        }
        const normalizedParts = normalizeMessageParts(resolvedContent, parts);
        return {
          role,
          content: resolvedContent,
          parts: normalizedParts,
          metadata: entry.metadata
        };
      });
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
