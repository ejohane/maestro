export type IdPrefix = "p" | "c" | "s";

export interface Project {
  id: string;
  name: string;
  repoPath: string;
  defaultBranch: string;
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
