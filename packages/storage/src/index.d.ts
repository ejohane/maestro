import { Conversation, CurrentContext, Project, Session } from "@maestro/core";
export interface MaestroPaths {
    root: string;
    projectsDir: string;
    conversationsDir: string;
    workspacesDir: string;
    currentFile: string;
}
export declare const getMaestroPaths: (repoRoot: string) => MaestroPaths;
export declare const ensureMaestroRoot: (repoRoot: string) => Promise<MaestroPaths>;
export declare const writeProject: (repoRoot: string, project: Project) => Promise<void>;
export declare const readProjectById: (repoRoot: string, projectId: string) => Promise<Project>;
export declare const listProjects: (repoRoot: string) => Promise<Project[]>;
export declare const findProject: (repoRoot: string, nameOrId: string) => Promise<Project | undefined>;
export declare const writeConversation: (repoRoot: string, conversation: Conversation) => Promise<void>;
export declare const readConversation: (repoRoot: string, conversationId: string) => Promise<Conversation>;
export declare const listConversations: (repoRoot: string) => Promise<Conversation[]>;
export declare const writeSession: (repoRoot: string, conversationId: string, session: Session) => Promise<void>;
export declare const readSession: (repoRoot: string, conversationId: string, sessionId: string) => Promise<Session>;
export declare const listSessions: (repoRoot: string, conversationId: string) => Promise<Session[]>;
export declare const updateConversationTimestamp: (repoRoot: string, conversation: Conversation) => Promise<void>;
export declare const updateSessionTimestamp: (repoRoot: string, conversationId: string, session: Session) => Promise<void>;
export declare const setCurrentContext: (repoRoot: string, context: CurrentContext) => Promise<void>;
export declare const readCurrentContext: (repoRoot: string) => Promise<CurrentContext>;
export declare const appendTranscriptEntry: (repoRoot: string, conversationId: string, sessionId: string, entry: unknown) => Promise<void>;
export declare const appendEventEntry: (repoRoot: string, conversationId: string, sessionId: string, entry: unknown) => Promise<void>;
export declare const readTranscriptHistory: (repoRoot: string, conversationId: string, sessionId: string) => Promise<Array<{
    role: string;
    content: string;
}>>;
