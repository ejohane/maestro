// useMessagesWatch - React hook for real-time message updates via SSE
//
// This hook connects to the messages watch SSE endpoint and provides
// real-time updates when messages are created or modified.

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage, MessagePart, TextPart } from "./useChatSession";

// Constants
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BACKOFF_MULTIPLIER = 1.5;

// OpenCode SDK message types (from API response)
interface OpenCodeTextPart {
  id: string;
  type: "text";
  text: string;
  synthetic?: boolean;
}

interface OpenCodeReasoningPart {
  id: string;
  type: "reasoning";
  text: string;
  time?: { start: number; end?: number };
}

interface OpenCodeToolState {
  status: "pending" | "running" | "completed" | "error";
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  title?: string;
}

interface OpenCodeToolPart {
  id: string;
  type: "tool";
  tool: string;
  callID: string;
  state: OpenCodeToolState;
}

type OpenCodePart =
  | OpenCodeTextPart
  | OpenCodeReasoningPart
  | OpenCodeToolPart
  | { type: string; id: string };

interface OpenCodeMessage {
  info: {
    id: string;
    role: "user" | "assistant";
    time: { created: number };
  };
  parts: OpenCodePart[];
}

export interface UseMessagesWatchOptions {
  /** Whether to automatically connect on mount (default: true) */
  autoConnect?: boolean;
  /** Whether session is ready (has sessionId and worktreePath) */
  enabled?: boolean;
  /** Called when messages are updated */
  onUpdate?: (messages: ChatMessage[]) => void;
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when connection is lost */
  onDisconnect?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface UseMessagesWatchReturn {
  /** Current list of messages */
  messages: ChatMessage[];
  /** Whether connected to the SSE stream */
  isConnected: boolean;
  /** Whether currently attempting to reconnect */
  isReconnecting: boolean;
  /** Current error, if any */
  error: Error | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Manually trigger a refetch */
  refetch: () => void;
  /** Manually connect to the SSE stream */
  connect: () => void;
  /** Manually disconnect from the SSE stream */
  disconnect: () => void;
  /** Update messages locally (for optimistic updates during send) */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

/**
 * Convert OpenCode SDK messages to our ChatMessage format
 */
function convertOpenCodeMessages(
  openCodeMessages: OpenCodeMessage[]
): ChatMessage[] {
  return openCodeMessages.map((msg) => {
    const parts: MessagePart[] = [];

    for (const part of msg.parts) {
      if (part.type === "text") {
        const textPart = part as OpenCodeTextPart;
        // Skip synthetic messages (injected context)
        if (textPart.synthetic) continue;
        parts.push({
          type: "text",
          partId: textPart.id,
          text: textPart.text,
        });
      } else if (part.type === "reasoning") {
        const reasoningPart = part as OpenCodeReasoningPart;
        parts.push({
          type: "reasoning",
          partId: reasoningPart.id,
          text: reasoningPart.text,
          isStreaming: false,
          time: reasoningPart.time,
        });
      } else if (part.type === "tool") {
        const toolPart = part as OpenCodeToolPart;
        parts.push({
          type: "tool",
          partId: toolPart.id,
          tool: toolPart.tool,
          callID: toolPart.callID,
          state: toolPart.state,
        });
      }
    }

    // Build content string from text parts
    const content = parts
      .filter((p): p is TextPart => p.type === "text")
      .map((p) => p.text)
      .join("");

    // Format timestamp
    const timestamp = new Date(msg.info.time.created).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      id: msg.info.id,
      role: msg.info.role,
      content,
      parts,
      timestamp,
    };
  });
}

/**
 * Hook for watching messages in real-time via Server-Sent Events
 *
 * @param projectId - The project ID
 * @param issueNumber - The issue number
 * @param options - Configuration options
 * @returns Messages state and control functions
 */
export function useMessagesWatch(
  projectId: string,
  issueNumber: number,
  options: UseMessagesWatchOptions = {}
): UseMessagesWatchReturn {
  const {
    autoConnect = true,
    enabled = true,
    onUpdate,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs for cleanup and callbacks
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);
  const mountedRef = useRef(true);

  // Store callbacks in refs to avoid stale closures
  const onUpdateRef = useRef(onUpdate);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  // Ref to store connect function for self-reference
  const connectRef = useRef<() => void>(() => {});

  // Update callback refs
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onUpdate, onConnect, onDisconnect, onError]);

  /**
   * Clean up any pending reconnect timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Close the EventSource connection
   */
  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  /**
   * Disconnect from the SSE stream
   */
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearReconnectTimeout();
    closeEventSource();
    setIsConnected(false);
    setIsReconnecting(false);
  }, [clearReconnectTimeout, closeEventSource]);

  /**
   * Connect to the SSE stream
   */
  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;

    // Clean up existing connection
    closeEventSource();
    clearReconnectTimeout();

    shouldReconnectRef.current = true;
    setError(null);

    const url = `/api/projects/${projectId}/planning/${issueNumber}/messages/watch`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;

      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);
      setError(null);
      onConnectRef.current?.();
    };

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data);

        if (data.type === "update" && Array.isArray(data.messages)) {
          const convertedMessages = convertOpenCodeMessages(data.messages);
          setMessages(convertedMessages);
          onUpdateRef.current?.(convertedMessages);
        } else if (data.type === "connected") {
          // Connection confirmation - state already handled in onopen
        } else if (data.type === "heartbeat") {
          // Keep-alive, no action needed
        } else if (data.type === "error") {
          const err = new Error(data.error || "Unknown error");
          setError(err);
          onErrorRef.current?.(err);
        }
      } catch (parseError) {
        console.error("[useMessagesWatch] Failed to parse event:", parseError);
      }
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;

      setIsConnected((wasConnected) => {
        if (wasConnected) {
          onDisconnectRef.current?.();
        }
        return false;
      });

      // Close the errored connection
      eventSource.close();
      eventSourceRef.current = null;

      // Attempt reconnection if we should
      if (shouldReconnectRef.current && mountedRef.current && enabled) {
        setReconnectAttempts((prev) => {
          const attempts = prev + 1;

          if (attempts <= MAX_RECONNECT_ATTEMPTS) {
            setIsReconnecting(true);

            // Calculate delay with exponential backoff
            const delay = Math.min(
              RECONNECT_DELAY_MS *
                Math.pow(RECONNECT_BACKOFF_MULTIPLIER, prev),
              30000 // Max 30 seconds
            );

            console.log(
              `[useMessagesWatch] Reconnecting in ${delay}ms (attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS})`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && shouldReconnectRef.current && enabled) {
                connectRef.current();
              }
            }, delay);
          } else {
            setIsReconnecting(false);
            const err = new Error(
              `Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts`
            );
            setError(err);
            onErrorRef.current?.(err);
          }

          return attempts;
        });
      }
    };
  }, [
    projectId,
    issueNumber,
    enabled,
    closeEventSource,
    clearReconnectTimeout,
  ]);

  // Update connect ref whenever connect function changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  /**
   * Manually trigger a refetch by reconnecting
   */
  const refetch = useCallback(() => {
    if (eventSourceRef.current) {
      disconnect();
    }
    setReconnectAttempts(0);
    connect();
  }, [connect, disconnect]);

  // Auto-connect on mount when enabled
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect && enabled) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      clearReconnectTimeout();
      closeEventSource();
    };
  }, [autoConnect, enabled, connect, clearReconnectTimeout, closeEventSource]);

  // Reconnect when projectId or issueNumber changes (if enabled)
  useEffect(() => {
    if (autoConnect && enabled && mountedRef.current) {
      // Reset state and reconnect
      setMessages([]);
      setReconnectAttempts(0);
      connect();
    }
  }, [projectId, issueNumber, autoConnect, enabled, connect]);

  // Handle enabled state changes
  useEffect(() => {
    if (!enabled) {
      disconnect();
    } else if (autoConnect && mountedRef.current) {
      connect();
    }
  }, [enabled, autoConnect, connect, disconnect]);

  return {
    messages,
    isConnected,
    isReconnecting,
    error,
    reconnectAttempts,
    refetch,
    connect,
    disconnect,
    setMessages,
  };
}

export default useMessagesWatch;
