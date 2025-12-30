import { useState, useCallback, useRef, useEffect } from "react";

// Part types for assistant messages
export interface TextPart {
  type: "text";
  partId: string;
  text: string;
}

export interface ReasoningPart {
  type: "reasoning";
  partId: string;
  text: string;
  isStreaming: boolean;
  time?: { start?: number; end?: number };
}

export interface ToolState {
  status: "pending" | "running" | "completed" | "error";
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  title?: string;
}

export interface ToolPart {
  type: "tool";
  partId: string;
  tool: string;
  callID: string;
  state: ToolState;
}

export type MessagePart = TextPart | ReasoningPart | ToolPart;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string; // For backwards compatibility - concatenated text content
  parts: MessagePart[]; // Structured parts for rich rendering
  timestamp: string;
}

export interface UseChatSessionOptions {
  projectId: string;
  issueNumber: string;
  /** Called when streaming content arrives (useful for unread indicators) */
  onStreamChunk?: () => void;
  /** Called when the agent modifies the GitHub issue (e.g., via gh issue edit) */
  onIssueUpdated?: () => void;
}

export interface UseChatSessionReturn {
  // State
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;

  // Status
  isLoading: boolean; // Initial session creation
  isSending: boolean; // Message being sent
  isStreaming: boolean; // Response streaming
  isReconnecting: boolean; // Session recovery
  error: string | null;

  // Session
  sessionId: string | null;

  // Actions
  sendMessage: () => Promise<void>;
  retrySession: () => Promise<void>;
  clearError: () => void;
  startNewSession: () => Promise<void>;
}

export function useChatSession(
  options: UseChatSessionOptions
): UseChatSessionReturn {
  const { projectId, issueNumber, onStreamChunk, onIssueUpdated } = options;

  // State
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref for callbacks to avoid stale closures
  const onStreamChunkRef = useRef(onStreamChunk);
  onStreamChunkRef.current = onStreamChunk;
  const onIssueUpdatedRef = useRef(onIssueUpdated);
  onIssueUpdatedRef.current = onIssueUpdated;

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get or create OpenCode session
  const getOrCreateSession = useCallback(async (): Promise<string> => {
    setError(null);
    setIsLoading(true);

    try {
      // Try to get existing session
      const getRes = await fetch(
        `/api/projects/${projectId}/issues/${issueNumber}/session`
      );
      if (getRes.ok) {
        const data = await getRes.json();
        const { sessionId: existingSessionId, messages: existingMessages } = data;
        if (existingSessionId) {
          setSessionId(existingSessionId);
          
          // Hydrate messages if we have history
          if (existingMessages && Array.isArray(existingMessages) && existingMessages.length > 0) {
            setMessages(existingMessages as ChatMessage[]);
          }
          
          return existingSessionId;
        }
      }

      // Create new session
      const postRes = await fetch(
        `/api/projects/${projectId}/issues/${issueNumber}/session`,
        {
          method: "POST",
        }
      );

      if (!postRes.ok) {
        const data = await postRes.json();
        throw new Error(data.error || "Failed to create session");
      }

      const { sessionId: newSessionId } = await postRes.json();
      setSessionId(newSessionId);
      return newSessionId;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Could not connect to AI. Please try again.";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, issueNumber]);

  // Load existing session and messages on mount
  useEffect(() => {
    getOrCreateSession().catch(() => {
      // Error is already set by getOrCreateSession
    });
  }, [getOrCreateSession]);

  // Retry session creation
  const retrySession = useCallback(async () => {
    setError(null);
    try {
      await getOrCreateSession();
    } catch {
      // Error already set by getOrCreateSession
    }
  }, [getOrCreateSession]);

  // Start a new session (delete existing and create fresh)
  const startNewSession = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      // Delete existing session
      await fetch(
        `/api/projects/${projectId}/issues/${issueNumber}/session`,
        { method: "DELETE" }
      );
      
      // Clear local state
      setSessionId(null);
      setMessages([]);
      
      // Create new session
      const postRes = await fetch(
        `/api/projects/${projectId}/issues/${issueNumber}/session`,
        { method: "POST" }
      );
      
      if (!postRes.ok) {
        const data = await postRes.json();
        throw new Error(data.error || "Failed to create session");
      }
      
      const { sessionId: newSessionId } = await postRes.json();
      setSessionId(newSessionId);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Could not start new session. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, issueNumber]);

  // Send a message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      parts: [{ type: "text", partId: `user-${Date.now()}`, text: input.trim() }],
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    // Store the message in case we need to restore it on error
    const savedMessage = input.trim();
    setInput("");
    setIsSending(true);
    setIsStreaming(true);

    let currentSessionId = sessionId;
    let retried = false;

    const attemptSend = async (sid: string): Promise<Response> => {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueNumber}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userInput, sessionId: sid }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Check if this is a session error (dead session) and we haven't retried yet
        const isSessionError =
          response.status === 404 ||
          errorData.code === "SESSION_NOT_FOUND" ||
          errorData.error?.toLowerCase().includes("session") ||
          errorData.error?.toLowerCase().includes("not found");

        if (isSessionError && !retried) {
          retried = true;
          setIsReconnecting(true);

          try {
            // Create new session (which auto-injects context)
            const postRes = await fetch(
              `/api/projects/${projectId}/issues/${issueNumber}/session`,
              {
                method: "POST",
              }
            );

            if (!postRes.ok) {
              const sessionError = await postRes.json().catch(() => ({}));
              throw new Error(
                sessionError.error || "Failed to create new session"
              );
            }

            const { sessionId: newSessionId } = await postRes.json();
            setSessionId(newSessionId);
            currentSessionId = newSessionId;

            setIsReconnecting(false);

            // Retry with new session
            return attemptSend(newSessionId);
          } catch (reconnectError) {
            setIsReconnecting(false);
            throw reconnectError;
          }
        }

        throw new Error(errorData.error || "Chat request failed");
      }

      return response;
    };

    try {
      // Get or create session if we don't have one
      if (!currentSessionId) {
        currentSessionId = await getOrCreateSession();
      }

      // Add placeholder for assistant response
      const assistantMessageId = `msg-${Date.now() + 1}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant" as const,
          content: "",
          parts: [],
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      // Attempt to send with automatic reconnection on session errors
      const response = await attemptSend(currentSessionId);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");

        // Keep the last potentially incomplete chunk in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              // Response complete
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const { type, partId, delta, tool, callID, state, time, error: streamError } = parsed;
              
              if (type === "text" && delta) {
                // Append text delta to the last message
                setMessages((prev) => {
                  if (prev.length === 0) return prev;
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    // Find or create text part
                    const existingPartIndex = lastMsg.parts.findIndex(
                      (p) => p.type === "text" && p.partId === partId
                    );
                    
                    let newParts: MessagePart[];
                    if (existingPartIndex >= 0) {
                      // Update existing part
                      newParts = [...lastMsg.parts];
                      const existingPart = newParts[existingPartIndex] as TextPart;
                      newParts[existingPartIndex] = {
                        ...existingPart,
                        text: existingPart.text + delta
                      };
                    } else {
                      // Add new text part
                      newParts = [...lastMsg.parts, { type: "text", partId, text: delta }];
                    }
                    
                    // Update content for backwards compatibility
                    const newContent = newParts
                      .filter((p): p is TextPart => p.type === "text")
                      .map(p => p.text)
                      .join("");
                    
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMsg, content: newContent, parts: newParts }
                    ];
                  }
                  return prev;
                });
                onStreamChunkRef.current?.();
              }
              
              if (type === "reasoning" && delta) {
                // Append reasoning delta
                setMessages((prev) => {
                  if (prev.length === 0) return prev;
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    const existingPartIndex = lastMsg.parts.findIndex(
                      (p) => p.type === "reasoning" && p.partId === partId
                    );
                    
                    let newParts: MessagePart[];
                    if (existingPartIndex >= 0) {
                      newParts = [...lastMsg.parts];
                      const existingPart = newParts[existingPartIndex] as ReasoningPart;
                      newParts[existingPartIndex] = {
                        ...existingPart,
                        text: existingPart.text + delta,
                        isStreaming: true,
                        time
                      };
                    } else {
                      newParts = [...lastMsg.parts, { 
                        type: "reasoning", 
                        partId, 
                        text: delta, 
                        isStreaming: true,
                        time 
                      }];
                    }
                    
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMsg, parts: newParts }
                    ];
                  }
                  return prev;
                });
                onStreamChunkRef.current?.();
              }
              
              if (type === "tool" && state) {
                // Update tool state
                setMessages((prev) => {
                  if (prev.length === 0) return prev;
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    const existingPartIndex = lastMsg.parts.findIndex(
                      (p) => p.type === "tool" && p.partId === partId
                    );
                    
                    const toolPart: ToolPart = {
                      type: "tool",
                      partId,
                      tool,
                      callID,
                      state
                    };
                    
                    let newParts: MessagePart[];
                    if (existingPartIndex >= 0) {
                      newParts = [...lastMsg.parts];
                      newParts[existingPartIndex] = toolPart;
                    } else {
                      newParts = [...lastMsg.parts, toolPart];
                    }
                    
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMsg, parts: newParts }
                    ];
                  }
                  return prev;
                });
                onStreamChunkRef.current?.();
                
                // Detect GitHub issue modifications and trigger refresh
                if (tool === "bash" && state.status === "completed") {
                  const command = state.input?.command as string | undefined;
                  if (command && (
                    command.includes("gh issue edit") ||
                    command.includes("gh issue close") ||
                    command.includes("gh issue reopen")
                  )) {
                    onIssueUpdatedRef.current?.();
                  }
                }
              }
              
              if (streamError) {
                console.error("Stream error:", streamError);
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (
                    lastMsg &&
                    lastMsg.role === "assistant" &&
                    !lastMsg.content
                  ) {
                    lastMsg.content = `Error: ${streamError}`;
                    lastMsg.parts = [{ type: "text", partId: "error", text: `Error: ${streamError}` }];
                  }
                  return newMessages;
                });
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Restore the user's message so they can retry
      setInput(savedMessage);
      // Remove the empty assistant placeholder and add error message
      setMessages((prev) => {
        const newMessages = [...prev];
        // Remove empty assistant message if it exists
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && !lastMsg.content) {
          newMessages.pop();
        }
        // Add error message as assistant response
        const errorContent = "Sorry, I encountered an error. Your message has been restored - please try again.";
        newMessages.push({
          id: `msg-error-${Date.now()}`,
          role: "assistant" as const,
          content: errorContent,
          parts: [{ type: "text", partId: `error-${Date.now()}`, text: errorContent }],
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
        return newMessages;
      });
    } finally {
      setIsSending(false);
      setIsStreaming(false);
      setIsReconnecting(false);
      
      // Mark all reasoning parts as done streaming
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          const hasStreamingReasoning = lastMsg.parts.some(
            (p) => p.type === "reasoning" && (p as ReasoningPart).isStreaming
          );
          if (hasStreamingReasoning) {
            const newParts = lastMsg.parts.map((p) => {
              if (p.type === "reasoning") {
                return { ...p, isStreaming: false };
              }
              return p;
            });
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, parts: newParts }
            ];
          }
        }
        return prev;
      });
    }
  }, [
    input,
    isSending,
    isStreaming,
    sessionId,
    projectId,
    issueNumber,
    getOrCreateSession,
  ]);

  return {
    // State
    messages,
    input,
    setInput,

    // Status
    isLoading,
    isSending,
    isStreaming,
    isReconnecting,
    error,

    // Session
    sessionId,

    // Actions
    sendMessage,
    retrySession,
    clearError,
    startNewSession,
  };
}
