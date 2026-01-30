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
    }): Promise<string>;
    sendMessage(params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent>;
}
export declare class DirectSDKClient implements OpenCodeClient {
    private client;
    constructor(baseUrl?: string);
    ensureSession(params: {
        sessionId?: string;
        title?: string;
    }): Promise<string>;
    sendMessage(params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent>;
}
export declare class ToolAdapterClient implements OpenCodeClient {
    ensureSession(params: {
        sessionId?: string;
        title?: string;
    }): Promise<string>;
    sendMessage(_params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent>;
}
