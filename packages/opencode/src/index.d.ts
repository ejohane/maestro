export interface OpenCodeMessage {
    role: "user" | "assistant" | "system";
    content: string;
}
export interface OpenCodeEvent {
    type: "assistant_message" | "tool_call" | "tool_result" | "sdk_event" | "error";
    data: unknown;
}
export interface OpenCodeSendParams {
    workspacePath: string;
    history: OpenCodeMessage[];
    message: string;
    model?: string;
    sessionId?: string;
    sessionTitle?: string;
}
export interface OpenCodeClient {
    ensureSession(params: {
        sessionId?: string;
        title?: string;
        workspacePath?: string;
    }): Promise<string>;
    sendMessage(params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent>;
}
export declare class DirectSDKClient implements OpenCodeClient {
    private client;
    constructor(baseUrl?: string);
    ensureSession(params: {
        sessionId?: string;
        title?: string;
        workspacePath?: string;
    }): Promise<string>;
    sendMessage(params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent>;
}
export declare class ToolAdapterClient implements OpenCodeClient {
    ensureSession(params: {
        sessionId?: string;
        title?: string;
        workspacePath?: string;
    }): Promise<string>;
    sendMessage(_params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent>;
}

export declare const parseModel: (model?: string) => {
    providerID: string;
    modelID: string;
} | undefined;
export declare const extractAssistantResponse: (response: any) => {
    content: string;
};
export declare const withBasicAuthFetch: () =>
    | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
    | undefined;
export declare const buildSystemMessage: (
    workspacePath: string,
    history: OpenCodeMessage[]
) => string | undefined;
export declare const createAuthedOpencodeClient: (baseUrl?: string) => OpencodeClient;
import type { OpencodeClient } from "@opencode-ai/sdk";

export { createOpencodeClient } from "@opencode-ai/sdk";
export type { OpencodeClient };
