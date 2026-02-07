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
    metadata?: Record<string, unknown>;
    time?: {
        start: number;
        end?: number;
    };
};
export type ToolCallPart = {
    type: "tool";
    callId: string;
    name: string;
    input: unknown;
    status?: "pending" | "running" | "completed" | "error";
    approval?: ToolApproval;
};
export type ToolStatePending = {
    status: "pending";
    input?: Record<string, unknown>;
    raw?: string;
};
export type ToolStateRunning = {
    status: "running";
    input?: Record<string, unknown>;
    title?: string;
    metadata?: Record<string, unknown>;
    time?: {
        start: number;
    };
};
export type ToolStateCompleted = {
    status: "completed";
    input?: Record<string, unknown>;
    output?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    time?: {
        start: number;
        end?: number;
        compacted?: number;
    };
};
export type ToolStateError = {
    status: "error";
    input?: Record<string, unknown>;
    error?: string;
    metadata?: Record<string, unknown>;
    time?: {
        start: number;
        end?: number;
    };
};
export type OpencodeToolState = ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError;
export type OpencodeToolPart = {
    type: "tool";
    callID: string;
    tool: string;
    state: OpencodeToolState;
    metadata?: Record<string, unknown>;
};
export type ToolResultPart = {
    type: "tool_result";
    callId: string;
    name: string;
    output: unknown;
    isError?: boolean;
};
export type StepStartPart = {
    type: "step-start";
    snapshot?: string;
};
export type StepFinishPart = {
    type: "step-finish";
    reason: string;
    snapshot?: string;
    cost?: number;
    tokens?: {
        input?: number;
        output?: number;
        reasoning?: number;
        cache?: {
            read?: number;
            write?: number;
        };
    };
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
export type MessagePart = TextPart | ReasoningPart | ToolCallPart | OpencodeToolPart | ToolResultPart | StepStartPart | StepFinishPart | SourcesPart | FilePart | DataPart;
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
export declare const getTextFromParts: (parts: MessagePart[]) => string;
export declare const nowIso: () => string;
export declare const generateId: (prefix: IdPrefix) => string;
export declare const createProject: (input: Omit<Project, "id" | "createdAt" | "updatedAt">) => Project;
export declare const createConversation: (input: Omit<Conversation, "id" | "createdAt" | "updatedAt">) => Conversation;
export declare const createSession: (input: Omit<Session, "id" | "createdAt" | "updatedAt">) => Session;
