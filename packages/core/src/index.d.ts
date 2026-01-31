export type IdPrefix = "p" | "c" | "s";
export interface Project {
    id: string;
    name: string;
    icon?: string;
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
export declare const nowIso: () => string;
export declare const generateId: (prefix: IdPrefix) => string;
export declare const createProject: (input: Omit<Project, "id" | "createdAt" | "updatedAt">) => Project;
export declare const createConversation: (input: Omit<Conversation, "id" | "createdAt" | "updatedAt">) => Conversation;
export declare const createSession: (input: Omit<Session, "id" | "createdAt" | "updatedAt">) => Session;
