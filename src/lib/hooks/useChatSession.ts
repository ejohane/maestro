import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface UseChatSessionOptions {
  projectId: string;
  issueNumber: string;
  /** Called when streaming content arrives (useful for unread indicators) */
  onStreamChunk?: () => void;
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
}

export function useChatSession(
  options: UseChatSessionOptions
): UseChatSessionReturn {
  const { projectId, issueNumber, onStreamChunk } = options;

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

  // Use ref for onStreamChunk to avoid stale closures
  const onStreamChunkRef = useRef(onStreamChunk);
  onStreamChunkRef.current = onStreamChunk;

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
        const { sessionId: existingSessionId } = await getRes.json();
        if (existingSessionId) {
          setSessionId(existingSessionId);
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

  // Retry session creation
  const retrySession = useCallback(async () => {
    setError(null);
    try {
      await getOrCreateSession();
    } catch {
      // Error already set by getOrCreateSession
    }
  }, [getOrCreateSession]);

  // Send a message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
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
              const { delta, error: streamError } = JSON.parse(data);
              if (delta) {
                // Append delta to the last message
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.content += delta;
                  }
                  return newMessages;
                });
                // Notify parent of streaming activity
                onStreamChunkRef.current?.();
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
        newMessages.push({
          id: `msg-error-${Date.now()}`,
          role: "assistant" as const,
          content:
            "Sorry, I encountered an error. Your message has been restored - please try again.",
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
  };
}
