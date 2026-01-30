import { promises as fs } from "node:fs";
import path from "node:path";
import { nowIso } from "@maestro/core";
export const getMaestroPaths = (repoRoot) => {
    const root = path.join(repoRoot, ".maestro");
    return {
        root,
        projectsDir: path.join(root, "projects"),
        conversationsDir: path.join(root, "conversations"),
        workspacesDir: path.join(root, "workspaces"),
        currentFile: path.join(root, "current.json")
    };
};
export const ensureMaestroRoot = async (repoRoot) => {
    const paths = getMaestroPaths(repoRoot);
    await fs.mkdir(paths.projectsDir, { recursive: true });
    await fs.mkdir(paths.conversationsDir, { recursive: true });
    await fs.mkdir(paths.workspacesDir, { recursive: true });
    return paths;
};
const readJson = async (filePath) => {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
};
const writeJson = async (filePath, data) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
};
const appendNdjson = async (filePath, data) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(data)}\n`, "utf-8");
};
export const writeProject = async (repoRoot, project) => {
    const { projectsDir } = await ensureMaestroRoot(repoRoot);
    await writeJson(path.join(projectsDir, `${project.id}.json`), project);
};
export const readProjectById = async (repoRoot, projectId) => {
    const { projectsDir } = getMaestroPaths(repoRoot);
    return readJson(path.join(projectsDir, `${projectId}.json`));
};
export const listProjects = async (repoRoot) => {
    const { projectsDir } = getMaestroPaths(repoRoot);
    try {
        const entries = await fs.readdir(projectsDir);
        const projects = await Promise.all(entries
            .filter((entry) => entry.endsWith(".json"))
            .map((entry) => readJson(path.join(projectsDir, entry))));
        return projects;
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
};
export const findProject = async (repoRoot, nameOrId) => {
    const projects = await listProjects(repoRoot);
    return projects.find((project) => project.id === nameOrId || project.name === nameOrId);
};
export const writeConversation = async (repoRoot, conversation) => {
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
export const readConversation = async (repoRoot, conversationId) => {
    const { conversationsDir } = getMaestroPaths(repoRoot);
    return readJson(path.join(conversationsDir, conversationId, "conversation.json"));
};
export const listConversations = async (repoRoot) => {
    const { conversationsDir } = getMaestroPaths(repoRoot);
    try {
        const entries = await fs.readdir(conversationsDir);
        const conversations = await Promise.all(entries.map((entry) => readJson(path.join(conversationsDir, entry, "conversation.json"))));
        return conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
};
export const writeSession = async (repoRoot, conversationId, session) => {
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
export const readSession = async (repoRoot, conversationId, sessionId) => {
    const { conversationsDir } = getMaestroPaths(repoRoot);
    return readJson(path.join(conversationsDir, conversationId, "sessions", sessionId, "session.json"));
};
export const listSessions = async (repoRoot, conversationId) => {
    const { conversationsDir } = getMaestroPaths(repoRoot);
    try {
        const sessionsDir = path.join(conversationsDir, conversationId, "sessions");
        const entries = await fs.readdir(sessionsDir);
        const sessions = await Promise.all(entries.map((entry) => readJson(path.join(sessionsDir, entry, "session.json"))));
        return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
};
export const updateConversationTimestamp = async (repoRoot, conversation) => {
    conversation.updatedAt = nowIso();
    await writeConversation(repoRoot, conversation);
};
export const updateSessionTimestamp = async (repoRoot, conversationId, session) => {
    session.updatedAt = nowIso();
    await writeSession(repoRoot, conversationId, session);
};
export const setCurrentContext = async (repoRoot, context) => {
    const { currentFile } = await ensureMaestroRoot(repoRoot);
    await writeJson(currentFile, context);
};
export const readCurrentContext = async (repoRoot) => {
    const { currentFile } = getMaestroPaths(repoRoot);
    try {
        return await readJson(currentFile);
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return {};
        }
        throw error;
    }
};
export const appendTranscriptEntry = async (repoRoot, conversationId, sessionId, entry) => {
    const filePath = getTranscriptPath(repoRoot, conversationId, sessionId);
    await appendNdjson(filePath, entry);
};
export const appendEventEntry = async (repoRoot, conversationId, sessionId, entry) => {
    const filePath = getEventsPath(repoRoot, conversationId, sessionId);
    await appendNdjson(filePath, entry);
};
export const readTranscriptHistory = async (repoRoot, conversationId, sessionId) => {
    const filePath = getTranscriptPath(repoRoot, conversationId, sessionId);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return raw
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
};
const getTranscriptPath = (repoRoot, conversationId, sessionId) => {
    const { conversationsDir } = getMaestroPaths(repoRoot);
    return path.join(conversationsDir, conversationId, "sessions", sessionId, "transcript.ndjson");
};
const getEventsPath = (repoRoot, conversationId, sessionId) => {
    const { conversationsDir } = getMaestroPaths(repoRoot);
    return path.join(conversationsDir, conversationId, "sessions", sessionId, "events.ndjson");
};
const ensureTranscript = async (repoRoot, conversationId, sessionId) => {
    const filePath = getTranscriptPath(repoRoot, conversationId, sessionId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
        await fs.access(filePath);
    }
    catch {
        await fs.writeFile(filePath, "", "utf-8");
    }
};
const ensureEvents = async (repoRoot, conversationId, sessionId) => {
    const filePath = getEventsPath(repoRoot, conversationId, sessionId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
        await fs.access(filePath);
    }
    catch {
        await fs.writeFile(filePath, "", "utf-8");
    }
};
