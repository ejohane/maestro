import { createOpencodeClient } from "@opencode-ai/sdk";
export class DirectSDKClient {
    client;
    constructor(baseUrl = process.env.MAESTRO_OPENCODE_URL ?? "http://localhost:4096") {
        this.client = createOpencodeClient({
            baseUrl,
            fetch: withBasicAuthFetch(),
            responseStyle: "data",
            throwOnError: true
        });
    }
    async ensureSession(params) {
        if (params.sessionId) {
            return params.sessionId;
        }
        const session = await this.client.session.create({
            body: params.title ? { title: params.title } : {}
        });
        if (!session?.id) {
            throw new Error("Failed to create OpenCode session.");
        }
        return session.id;
    }
    async *sendMessage(params) {
        const sessionId = await this.ensureSession({
            sessionId: params.sessionId,
            title: params.sessionTitle
        });
        yield { type: "sdk_event", data: { sessionId } };
        const model = parseModel(params.model);
        const system = buildSystemMessage(params.workspacePath, params.history);
        const response = await this.client.session.prompt({
            path: { id: sessionId },
            body: {
                model: model ?? undefined,
                system: system ?? undefined,
                parts: [{ type: "text", text: params.message }]
            }
        });
        yield { type: "sdk_event", data: response };
        const { content } = extractAssistantResponse(response);
        if (content) {
            yield { type: "assistant_message", data: { content, sessionId } };
        }
    }
}
export class ToolAdapterClient {
    async ensureSession(params) {
        if (params.sessionId) {
            return params.sessionId;
        }
        throw new Error("ToolAdapterClient is not configured for this SDK.");
    }
    async *sendMessage(_params) {
        throw new Error("ToolAdapterClient is not configured for this SDK.");
    }
}
const parseModel = (model) => {
    if (!model)
        return undefined;
    const [providerID, modelID] = model.split("/");
    if (!providerID || !modelID) {
        return undefined;
    }
    return { providerID, modelID };
};
const extractAssistantResponse = (response) => {
    const data = response?.data ?? response;
    const parts = data?.parts;
    if (!parts || parts.length === 0) {
        return { content: "" };
    }
    const text = parts
        .map((part) => (part.type === "text" ? part.text : ""))
        .filter(Boolean)
        .join("");
    return { content: text };
};
const withBasicAuthFetch = () => {
    const username = process.env.OPENCODE_SERVER_USERNAME ?? "opencode";
    const password = process.env.OPENCODE_SERVER_PASSWORD;
    if (!password) {
        return undefined;
    }
    return async (input, init) => {
        const headers = new Headers(init?.headers ?? {});
        const token = Buffer.from(`${username}:${password}`).toString("base64");
        headers.set("authorization", `Basic ${token}`);
        return fetch(input, { ...init, headers });
    };
};
const buildSystemMessage = (workspacePath, history) => {
    const sections = [];
    if (workspacePath) {
        sections.push(`Workspace root: ${workspacePath}`);
    }
    if (history.length > 0) {
        const historyText = history
            .map((entry) => `${entry.role}: ${entry.content}`)
            .join("\n");
        sections.push(`Conversation so far:\n${historyText}`);
    }
    if (sections.length === 0) {
        return undefined;
    }
    return sections.join("\n\n");
};
