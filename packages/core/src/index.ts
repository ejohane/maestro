export type IdPrefix = "p" | "c" | "s";

export type GitProvider = "github" | "gitlab";

export interface Project {
  id: string;
  name: string;
  icon?: string;
  repoPath: string;
  defaultBranch: string;
  gitProvider?: GitProvider;
  repoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  projectId: string;
  title?: string;
  branch: string;
  workspacePath: string;
  baseRef: string;
  baseSha: string;
  stashRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  conversationId: string;
  title?: string;
  model?: string;
  opencodeSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentContext {
  projectId?: string;
  conversationId?: string;
  sessionId?: string;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type ToolApprovalStatus = "pending" | "approved" | "rejected";

export type ToolApproval = {
  status: ToolApprovalStatus;
  by?: "user" | "system" | "policy";
  reason?: string;
  ts?: string;
};

export type TextPart = {
  type: "text";
  text: string;
};

export type ReasoningPart = {
  type: "reasoning";
  text: string;
};

export type ToolCallPart = {
  type: "tool";
  callId: string;
  name: string;
  input: unknown;
  status?: "pending" | "running" | "completed" | "error";
  approval?: ToolApproval;
};

export type ToolResultPart = {
  type: "tool_result";
  callId: string;
  name: string;
  output: unknown;
  isError?: boolean;
};

export type SourceCitation = {
  id?: string;
  title?: string;
  url?: string;
  snippet?: string;
  locator?: string;
};

export type SourcesPart = {
  type: "sources";
  sources: SourceCitation[];
};

export type FileReference = {
  id: string;
  name?: string;
  path?: string;
  mimeType?: string;
  size?: number;
  source?: "upload" | "workspace" | "tool" | "generated";
};

export type FilePart = {
  type: "file";
  file: FileReference;
};

export type DataPart = {
  type: `data-${string}`;
  data: unknown;
  label?: string;
};

export type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolCallPart
  | ToolResultPart
  | SourcesPart
  | FilePart
  | DataPart;

export type Message = {
  id?: string;
  role: MessageRole;
  content?: string;
  parts?: MessagePart[];
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type TranscriptEntry = Message & {
  ts: string;
  sessionId: string;
  conversationId: string;
};

export const getTextFromParts = (parts: MessagePart[]): string => {
  return parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter((text) => text.length > 0)
    .join("");
};

export const nowIso = (): string => new Date().toISOString();

const prefixLabel: Record<IdPrefix, string> = {
  p: "p",
  c: "c",
  s: "s"
};

export const generateId = (prefix: IdPrefix): string => {
  const base = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const compact = base.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  return `${prefixLabel[prefix]}_${compact}`;
};

export const createProject = (input: Omit<Project, "id" | "createdAt" | "updatedAt">): Project => {
  const ts = nowIso();
  return {
    id: generateId("p"),
    createdAt: ts,
    updatedAt: ts,
    ...input
  };
};

export const createConversation = (
  input: Omit<Conversation, "id" | "createdAt" | "updatedAt">
): Conversation => {
  const ts = nowIso();
  return {
    id: generateId("c"),
    createdAt: ts,
    updatedAt: ts,
    ...input
  };
};

export const createSession = (
  input: Omit<Session, "id" | "createdAt" | "updatedAt">
): Session => {
  const ts = nowIso();
  return {
    id: generateId("s"),
    createdAt: ts,
    updatedAt: ts,
    ...input
  };
};
