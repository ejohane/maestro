"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Loader } from "@/components/ai-elements/loader";
import { ToolExecution } from "./ToolExecution";
import { SlashCommandSuggestions } from "./SlashCommandSuggestions";
import {
  Lightbulb,
  X,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ChatMessage,
  MessagePart,
  TextPart,
  ReasoningPart,
  ToolPart,
} from "@/lib/hooks/useChatSession";

interface BeadContext {
  id: string;
  title: string;
}

interface PlanningChatProps {
  projectId: string;
  issueNumber: number;
  sessionId: string | null;
  worktreePath: string | null;
  selectedBead: BeadContext | null;
  onClearContext: () => void;
}

interface StreamState {
  isStreaming: boolean;
  error: string | null;
}

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

type OpenCodePart = OpenCodeTextPart | OpenCodeReasoningPart | OpenCodeToolPart | { type: string; id: string };

interface OpenCodeMessage {
  info: {
    id: string;
    role: "user" | "assistant";
    time: { created: number };
  };
  parts: OpenCodePart[];
}

/**
 * Convert OpenCode SDK messages to our ChatMessage format
 */
function convertOpenCodeMessages(openCodeMessages: OpenCodeMessage[]): ChatMessage[] {
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

export function PlanningChat({
  projectId,
  issueNumber,
  sessionId,
  worktreePath,
  selectedBead,
  onClearContext,
}: PlanningChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streamState, setStreamState] = useState<StreamState>({
    isStreaming: false,
    error: null,
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyLoadedRef = useRef(false);

  // Auto-scroll to bottom when messages change
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Whether the session is ready for interaction
  const isSessionReady = Boolean(sessionId && worktreePath);
  const isDisabled = !isSessionReady || streamState.isStreaming;

  // Load message history when session becomes ready
  useEffect(() => {
    if (!sessionId || !worktreePath || historyLoadedRef.current) return;

    const loadMessageHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/planning/${issueNumber}/messages`
        );

        if (!response.ok) {
          // Session might be new with no messages yet - that's OK
          if (response.status === 404) {
            historyLoadedRef.current = true;
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.messages && Array.isArray(data.messages)) {
          const convertedMessages = convertOpenCodeMessages(data.messages);
          setMessages(convertedMessages);
        }
        historyLoadedRef.current = true;
      } catch (err) {
        console.error("Error loading message history:", err);
        // Don't set error state - just proceed with empty messages
        historyLoadedRef.current = true;
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadMessageHistory();
  }, [sessionId, worktreePath, projectId, issueNumber]);

  // Handle sending a message
  const sendMessage = useCallback(
    async (text: string, beadContext: BeadContext | null) => {
      if (!text.trim() || !sessionId || !worktreePath) return;

      // Add user message
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text.trim(),
        parts: [
          { type: "text", partId: `user-${Date.now()}`, text: text.trim() },
        ],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setStreamState({ isStreaming: true, error: null });

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

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(
          `/api/projects/${projectId}/planning/${issueNumber}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text.trim(),
              beadContext,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const {
                  type,
                  partId,
                  delta,
                  tool,
                  callID,
                  state,
                  time,
                  error: streamError,
                } = parsed;

                if (type === "text" && delta) {
                  setMessages((prev) => {
                    if (prev.length === 0) return prev;
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === "assistant") {
                      const existingPartIndex = lastMsg.parts.findIndex(
                        (p) => p.type === "text" && p.partId === partId
                      );

                      let newParts: MessagePart[];
                      if (existingPartIndex >= 0) {
                        newParts = [...lastMsg.parts];
                        const existingPart = newParts[
                          existingPartIndex
                        ] as TextPart;
                        newParts[existingPartIndex] = {
                          ...existingPart,
                          text: existingPart.text + delta,
                        };
                      } else {
                        newParts = [
                          ...lastMsg.parts,
                          { type: "text", partId, text: delta },
                        ];
                      }

                      const newContent = newParts
                        .filter((p): p is TextPart => p.type === "text")
                        .map((p) => p.text)
                        .join("");

                      return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, content: newContent, parts: newParts },
                      ];
                    }
                    return prev;
                  });
                }

                if (type === "reasoning" && delta) {
                  setMessages((prev) => {
                    if (prev.length === 0) return prev;
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === "assistant") {
                      const existingPartIndex = lastMsg.parts.findIndex(
                        (p) => p.type === "reasoning" && p.partId === partId
                      );

                      let newParts: MessagePart[];
                      if (existingPartIndex >= 0) {
                        newParts = [...lastMsg.parts];
                        const existingPart = newParts[
                          existingPartIndex
                        ] as ReasoningPart;
                        newParts[existingPartIndex] = {
                          ...existingPart,
                          text: existingPart.text + delta,
                          isStreaming: true,
                          time,
                        };
                      } else {
                        newParts = [
                          ...lastMsg.parts,
                          {
                            type: "reasoning",
                            partId,
                            text: delta,
                            isStreaming: true,
                            time,
                          },
                        ];
                      }

                      return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, parts: newParts },
                      ];
                    }
                    return prev;
                  });
                }

                if (type === "tool" && state) {
                  setMessages((prev) => {
                    if (prev.length === 0) return prev;
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === "assistant") {
                      const existingPartIndex = lastMsg.parts.findIndex(
                        (p) => p.type === "tool" && p.partId === partId
                      );

                      const toolPart: ToolPart = {
                        type: "tool",
                        partId,
                        tool,
                        callID,
                        state,
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
                        { ...lastMsg, parts: newParts },
                      ];
                    }
                    return prev;
                  });
                }

                if (streamError) {
                  console.error("Stream error:", streamError);
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg?.role === "assistant" && !lastMsg.content) {
                      lastMsg.content = `Error: ${streamError}`;
                      lastMsg.parts = [
                        {
                          type: "text",
                          partId: "error",
                          text: `Error: ${streamError}`,
                        },
                      ];
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
        if ((err as Error).name === "AbortError") {
          // Request was cancelled, don't show error
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setStreamState((prev) => ({ ...prev, error: errorMessage }));

        // Update assistant message with error
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg?.role === "assistant" && !lastMsg.content) {
            lastMsg.content = `Error: ${errorMessage}`;
            lastMsg.parts = [
              {
                type: "text",
                partId: "error",
                text: `Error: ${errorMessage}`,
              },
            ];
          }
          return newMessages;
        });
      } finally {
        setStreamState((prev) => ({ ...prev, isStreaming: false }));

        // Mark all reasoning parts as done streaming
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === "assistant") {
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
              return [...prev.slice(0, -1), { ...lastMsg, parts: newParts }];
            }
          }
          return prev;
        });

        abortControllerRef.current = null;
      }
    },
    [projectId, issueNumber, sessionId, worktreePath]
  );

  // Handle prompt input submission
  const handleSubmit = useCallback(
    async (msg: PromptInputMessage) => {
      if (!msg.text?.trim()) return;
      await sendMessage(msg.text.trim(), selectedBead);

      // Clear context after sending
      if (selectedBead) {
        onClearContext();
      }
    },
    [sendMessage, selectedBead, onClearContext]
  );

  // Handle slash command selection
  const handleSlashCommand = useCallback((cmd: string) => {
    setInput(cmd + " ");
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setStreamState((prev) => ({ ...prev, error: null }));
  }, []);

  // Loading history state
  if (isLoadingHistory) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <Loader size={24} className="text-muted-foreground mb-3" />
          <p className="text-xs text-muted-foreground">Loading chat history...</p>
        </div>
      </div>
    );
  }

  // Empty state (only show if not loading history)
  if (messages.length === 0 && !streamState.isStreaming && !isLoadingHistory) {
    return (
      <div className="flex flex-col h-full">
        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="font-medium text-sm text-foreground">
            Planning Chat
          </h3>
          <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
            {isSessionReady
              ? "Use this chat to refine the plan, ask questions, or request changes."
              : "Waiting for planning session to be ready..."}
          </p>
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-card p-3">
          {/* Context indicator */}
          {selectedBead && (
            <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-t-md mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0" />
              <span className="text-sm flex-1 truncate">
                Re: {selectedBead.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onClearContext}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isSessionReady
                    ? "Type your message..."
                    : "Waiting for session..."
                }
                disabled={isDisabled}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <SlashCommandSuggestions
                  onSelect={handleSlashCommand}
                  disabled={isDisabled}
                />
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!input.trim() || isDisabled}
                status={streamState.isStreaming ? "streaming" : undefined}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <Conversation className="flex-1">
        <ConversationContent className="gap-4">
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              {message.role === "assistant" ? (
                <>
                  {/* Reasoning parts */}
                  {message.parts
                    .filter((p): p is ReasoningPart => p.type === "reasoning")
                    .map((part) => (
                      <Reasoning
                        key={part.partId}
                        isStreaming={part.isStreaming}
                        duration={
                          part.time?.start && part.time?.end
                            ? Math.ceil(
                                (part.time.end - part.time.start) / 1000
                              )
                            : undefined
                        }
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    ))}

                  {/* Tool parts */}
                  {message.parts
                    .filter((p): p is ToolPart => p.type === "tool")
                    .map((part) => (
                      <ToolExecution
                        key={part.partId}
                        toolName={part.tool}
                        state={part.state}
                      />
                    ))}

                  {/* Text parts */}
                  {message.parts
                    .filter((p): p is TextPart => p.type === "text")
                    .map((part) => (
                      <MessageContent key={part.partId}>
                        <MessageResponse>{part.text}</MessageResponse>
                      </MessageContent>
                    ))}
                </>
              ) : (
                <MessageContent className="!bg-primary !text-primary-foreground">
                  {message.parts
                    .filter((p): p is TextPart => p.type === "text")
                    .map((part) => (
                      <MessageResponse key={part.partId}>
                        {part.text}
                      </MessageResponse>
                    ))}
                </MessageContent>
              )}
              <p
                className={cn(
                  "text-[10px] text-muted-foreground mt-1",
                  message.role === "user" && "text-right"
                )}
              >
                {message.timestamp}
              </p>
            </Message>
          ))}

          {/* Loading indicator when streaming with no parts yet */}
          {streamState.isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.parts.length === 0 && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-md px-3 py-2">
                  <Loader size={20} className="text-muted-foreground" />
                </div>
              </div>
            )}

          <div ref={messagesEndRef} />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Error banner */}
      {streamState.error && (
        <div className="border-t border-destructive/50 bg-destructive/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{streamState.error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={clearError}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border bg-card p-3">
        {/* Context indicator */}
        {selectedBead && (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-t-md mb-2">
            <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span className="text-sm flex-1 truncate">
              Re: {selectedBead.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onClearContext}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                streamState.isStreaming
                  ? "Waiting for response..."
                  : "Type your message..."
              }
              disabled={isDisabled}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <SlashCommandSuggestions
                onSelect={handleSlashCommand}
                disabled={isDisabled}
              />
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!input.trim() || isDisabled}
              status={streamState.isStreaming ? "streaming" : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
