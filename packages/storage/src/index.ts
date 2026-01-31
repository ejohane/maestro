import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  Conversation,
  CurrentContext,
  Project,
  Session,
  nowIso
} from "@maestro/core";

export interface MaestroPaths {
  root: string;
  projectsDir: string;
  conversationsDir: string;
  workspacesDir: string;
  currentFile: string;
}

export const getMaestroPaths = (_repoRoot: string): MaestroPaths => {
  const root = path.join(os.homedir(), ".maestro");
  return {
    root,
    projectsDir: path.join(root, "projects"),
    conversationsDir: path.join(root, "conversations"),
    workspacesDir: path.join(root, "workspaces"),
    currentFile: path.join(root, "current.json")
  };
};

export const ensureMaestroRoot = async (repoRoot: string): Promise<MaestroPaths> => {
  const paths = getMaestroPaths(repoRoot);
  await fs.mkdir(paths.projectsDir, { recursive: true });
  await fs.mkdir(paths.conversationsDir, { recursive: true });
  await fs.mkdir(paths.workspacesDir, { recursive: true });
  return paths;
};

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const writeJson = async (filePath: string, data: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
};

const appendNdjson = async (filePath: string, data: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(data)}\n`, "utf-8");
};

export const writeProject = async (repoRoot: string, project: Project): Promise<void> => {
  const { projectsDir } = await ensureMaestroRoot(repoRoot);
  await writeJson(path.join(projectsDir, `${project.id}.json`), project);
};

export const readProjectById = async (repoRoot: string, projectId: string): Promise<Project> => {
  const { projectsDir } = getMaestroPaths(repoRoot);
  return readJson<Project>(path.join(projectsDir, `${projectId}.json`));
};

export const listProjects = async (
  repoRoot: string,
  options?: { includeAll?: boolean }
): Promise<Project[]> => {
  const { projectsDir } = getMaestroPaths(repoRoot);
  try {
    const entries = await fs.readdir(projectsDir);
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => readJson<Project>(path.join(projectsDir, entry)))
    );
    if (options?.includeAll) {
      return projects;
    }
    return projects.filter((project) => project.repoPath === repoRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

export const findProject = async (
  repoRoot: string,
  nameOrId: string
): Promise<Project | undefined> => {
  const projects = await listProjects(repoRoot);
  return projects.find((project) => project.id === nameOrId || project.name === nameOrId);
};

export const writeConversation = async (
  repoRoot: string,
  conversation: Conversation
): Promise<void> => {
  const { conversationsDir } = await ensureMaestroRoot(repoRoot);
  const baseDir = path.join(conversationsDir, conversation.id);
  await writeJson(path.join(baseDir, "conversation.json"), conversation);
  await writeJson(path.join(baseDir, "workspace.json"), {
    workspacePath: conversation.workspacePath,
    branch: conversation.branch,
    baseRef: conversation.baseRef,
    baseSha: conversation.baseSha,
    stashRef: conversation.stashRef ?? null
  });
  await writeJson(path.join(baseDir, "pointers.json"), {
    conversationId: conversation.id,
    projectId: conversation.projectId
  });
};

export const readConversation = async (
  repoRoot: string,
  conversationId: string
): Promise<Conversation> => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  return readJson<Conversation>(path.join(conversationsDir, conversationId, "conversation.json"));
};

export const listConversations = async (repoRoot: string): Promise<Conversation[]> => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  try {
    const entries = await fs.readdir(conversationsDir);
    const conversations = await Promise.all(
      entries.map((entry) =>
        readJson<Conversation>(path.join(conversationsDir, entry, "conversation.json"))
      )
    );
    return conversations.sort((a: Conversation, b: Conversation) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

export const deleteConversation = async (repoRoot: string, conversationId: string): Promise<void> => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  const conversationDir = path.join(conversationsDir, conversationId);
  await fs.rm(conversationDir, { recursive: true, force: true });
  const current = await readCurrentContext(repoRoot);
  if (current.conversationId === conversationId) {
    await setCurrentContext(repoRoot, { projectId: current.projectId });
  }
};

export const writeSession = async (
  repoRoot: string,
  conversationId: string,
  session: Session
): Promise<void> => {
  const { conversationsDir } = await ensureMaestroRoot(repoRoot);
  const baseDir = path.join(conversationsDir, conversationId, "sessions", session.id);
  await writeJson(path.join(baseDir, "session.json"), session);
  await writeJson(path.join(baseDir, "pointers.json"), {
    sessionId: session.id,
    conversationId
  });
  await ensureTranscript(repoRoot, conversationId, session.id);
  await ensureEvents(repoRoot, conversationId, session.id);
};

export const readSession = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string
): Promise<Session> => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  return readJson<Session>(
    path.join(conversationsDir, conversationId, "sessions", sessionId, "session.json")
  );
};

export const listSessions = async (
  repoRoot: string,
  conversationId: string
): Promise<Session[]> => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  try {
    const sessionsDir = path.join(conversationsDir, conversationId, "sessions");
    const entries = await fs.readdir(sessionsDir);
    const sessions = await Promise.all(
      entries.map((entry) => readJson<Session>(path.join(sessionsDir, entry, "session.json")))
    );
    return sessions.sort((a: Session, b: Session) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

export const deleteSession = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string
): Promise<void> => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  const sessionDir = path.join(conversationsDir, conversationId, "sessions", sessionId);
  await fs.rm(sessionDir, { recursive: true, force: true });
  const current = await readCurrentContext(repoRoot);
  if (current.conversationId === conversationId && current.sessionId === sessionId) {
    await setCurrentContext(repoRoot, {
      projectId: current.projectId,
      conversationId
    });
  }
};

export const updateConversationTimestamp = async (
  repoRoot: string,
  conversation: Conversation
): Promise<void> => {
  conversation.updatedAt = nowIso();
  await writeConversation(repoRoot, conversation);
};

export const updateSessionTimestamp = async (
  repoRoot: string,
  conversationId: string,
  session: Session
): Promise<void> => {
  session.updatedAt = nowIso();
  await writeSession(repoRoot, conversationId, session);
};

export const setCurrentContext = async (
  repoRoot: string,
  context: CurrentContext
): Promise<void> => {
  const { currentFile } = await ensureMaestroRoot(repoRoot);
  await writeJson(currentFile, context);
};

export const readCurrentContext = async (repoRoot: string): Promise<CurrentContext> => {
  const { currentFile } = getMaestroPaths(repoRoot);
  try {
    return await readJson<CurrentContext>(currentFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
};

export const appendTranscriptEntry = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string,
  entry: unknown
): Promise<void> => {
  const filePath = getTranscriptPath(repoRoot, conversationId, sessionId);
  await appendNdjson(filePath, entry);
};

export const appendEventEntry = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string,
  entry: unknown
): Promise<void> => {
  const filePath = getEventsPath(repoRoot, conversationId, sessionId);
  await appendNdjson(filePath, entry);
};

export type TranscriptMessage = { role: "user" | "assistant" | "system"; content: string };

export const readTranscriptHistory = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string
): Promise<TranscriptMessage[]> => {
  const filePath = getTranscriptPath(repoRoot, conversationId, sessionId);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parsed = JSON.parse(line) as { role?: string; content?: string };
        if (
          parsed.role === "user" ||
          parsed.role === "assistant" ||
          parsed.role === "system"
        ) {
          return { role: parsed.role, content: parsed.content ?? "" };
        }
        return { role: "user", content: parsed.content ?? "" };
      });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

export const readTranscriptEntries = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string
): Promise<unknown[]> => {
  const filePath = getTranscriptPath(repoRoot, conversationId, sessionId);
  return readNdjsonFile(filePath);
};

export const readEventEntries = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string
): Promise<unknown[]> => {
  const filePath = getEventsPath(repoRoot, conversationId, sessionId);
  return readNdjsonFile(filePath);
};

const getTranscriptPath = (repoRoot: string, conversationId: string, sessionId: string): string => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  return path.join(conversationsDir, conversationId, "sessions", sessionId, "transcript.ndjson");
};

const getEventsPath = (repoRoot: string, conversationId: string, sessionId: string): string => {
  const { conversationsDir } = getMaestroPaths(repoRoot);
  return path.join(conversationsDir, conversationId, "sessions", sessionId, "events.ndjson");
};

const ensureTranscript = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string
): Promise<void> => {
  const filePath = getTranscriptPath(repoRoot, conversationId, sessionId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "", "utf-8");
  }
};

const ensureEvents = async (
  repoRoot: string,
  conversationId: string,
  sessionId: string
): Promise<void> => {
  const filePath = getEventsPath(repoRoot, conversationId, sessionId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "", "utf-8");
  }
};

const readNdjsonFile = async (filePath: string): Promise<unknown[]> => {
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
