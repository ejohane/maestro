import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";

export { createOpencodeClient, type OpencodeClient };

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
  ensureSession(params: { sessionId?: string; title?: string; workspacePath?: string }): Promise<string>;
  sendMessage(params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent>;
}

export class DirectSDKClient implements OpenCodeClient {
  private client;

  constructor(baseUrl = process.env.MAESTRO_OPENCODE_URL ?? "http://localhost:4096") {
    this.client = createOpencodeClient({
      baseUrl,
      fetch: withBasicAuthFetch(),
      responseStyle: "data",
      throwOnError: true
    });
  }

  async ensureSession(params: {
    sessionId?: string;
    title?: string;
    workspacePath?: string;
  }): Promise<string> {
    if (params.sessionId) {
      return params.sessionId;
    }
    const body = params.title
      ? {
          title: params.title
        }
      : undefined;
    const response = await this.client.session.create({
      body: body as any,
      query: params.workspacePath ? { directory: params.workspacePath } : undefined
    });
    const session = (response as any)?.data ?? response;
    if (!session?.id) {
      throw new Error("Failed to create OpenCode session.");
    }
    return session.id as string;
  }

  async *sendMessage(params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent> {
    const sessionId = await this.ensureSession({
      sessionId: params.sessionId,
      title: params.sessionTitle,
      workspacePath: params.workspacePath
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
      },
      query: params.workspacePath ? { directory: params.workspacePath } : undefined
    });

    yield { type: "sdk_event", data: response };
    const { content } = extractAssistantResponse(response);
    if (content) {
      yield { type: "assistant_message", data: { content, sessionId } };
    }
  }
}

export class ToolAdapterClient implements OpenCodeClient {
  async ensureSession(params: {
    sessionId?: string;
    title?: string;
    workspacePath?: string;
  }): Promise<string> {
    if (params.sessionId) {
      return params.sessionId;
    }
    throw new Error("ToolAdapterClient is not configured for this SDK.");
  }

  async *sendMessage(_params: OpenCodeSendParams): AsyncIterable<OpenCodeEvent> {
    throw new Error("ToolAdapterClient is not configured for this SDK.");
  }
}

export const parseModel = (model?: string): { providerID: string; modelID: string } | undefined => {
  if (!model) return undefined;
  const [providerID, modelID] = model.split("/");
  if (!modelID) {
    const fallbackProvider =
      process.env.MAESTRO_MODEL_PROVIDER ?? process.env.MAESTRO_PROVIDER ?? "openai";
    return { providerID: fallbackProvider, modelID: model };
  }
  if (!providerID) {
    return undefined;
  }
  return { providerID, modelID };
};

export const extractAssistantResponse = (response: any): { content: string } => {
  const data = response?.data ?? response;
  const parts = data?.parts as Array<{ type: string; text?: string }> | undefined;
  if (!parts || parts.length === 0) {
    return { content: "" };
  }
  const text = parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("");
  return { content: text };
};

export const withBasicAuthFetch = () => {
  const username = process.env.OPENCODE_SERVER_USERNAME ?? "opencode";
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (!password) {
    return undefined;
  }
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers ?? {});
    const token = Buffer.from(`${username}:${password}`).toString("base64");
    headers.set("authorization", `Basic ${token}`);
    return fetch(input, { ...init, headers });
  };
};

export const buildSystemMessage = (
  workspacePath: string,
  history: OpenCodeMessage[]
): string | undefined => {
  const sections: string[] = [];
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

export const createAuthedOpencodeClient = (
  baseUrl = process.env.MAESTRO_OPENCODE_URL ?? "http://localhost:4096"
): OpencodeClient => {
  return createOpencodeClient({
    baseUrl,
    fetch: withBasicAuthFetch(),
    responseStyle: "data",
    throwOnError: true
  });
};
