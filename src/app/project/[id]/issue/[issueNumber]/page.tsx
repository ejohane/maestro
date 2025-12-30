"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Send,
  MoreHorizontal,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
  MessageSquare,
} from "lucide-react";
import { SaveSummaryModal } from "@/components/save-summary-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  createdAt: string;
  author: {
    login: string;
  };
  labels: { name: string }[];
  comments?: {
    author: { login: string };
    body: string;
    createdAt: string;
  }[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return "today";
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function IssueViewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const issueNumber = params.issueNumber as string;
  
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "chat">("chat");
  const [reconnecting, setReconnecting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Panel resizing state
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("issue-panel-width") || "400")
    }
    return 400
  })
  const [isDragging, setIsDragging] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  
  // Use ref to access activeTab in streaming callback without stale closure
  const activeTabRef = useRef(activeTab)
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])
  
  // Handle tab change with unread clearing
  const handleTabChange = (tab: "details" | "chat") => {
    setActiveTab(tab)
    if (tab === "chat") {
      setHasUnread(false)
    }
  }

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Panel resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(e.clientX, window.innerWidth * 0.5))
      setPanelWidth(newWidth)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      localStorage.setItem("issue-panel-width", panelWidth.toString())
    }
    
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, panelWidth])

  // Fetch issue details
  const fetchIssue = useCallback(async () => {
    setIsLoading(true);
    setIssueError(null);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueNumber}`);
      if (!response.ok) {
        if (response.status === 404) {
          setIssueError("Issue not found. It may have been deleted.");
        } else {
          setIssueError("Failed to load issue. Please try again.");
        }
        return;
      }
      const data = await response.json();
      setIssue(data);
    } catch {
      setIssueError("Failed to load issue. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, issueNumber]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  // Get or create OpenCode session
  const getOrCreateSession = async (): Promise<string> => {
    setSessionError(null);
    
    try {
      // Try to get existing session
      const getRes = await fetch(`/api/projects/${projectId}/issues/${issueNumber}/session`);
      if (getRes.ok) {
        const { sessionId: existingSessionId } = await getRes.json();
        if (existingSessionId) {
          setSessionId(existingSessionId);
          return existingSessionId;
        }
      }
      
      // Create new session
      const postRes = await fetch(`/api/projects/${projectId}/issues/${issueNumber}/session`, {
        method: "POST",
      });
      
      if (!postRes.ok) {
        const data = await postRes.json();
        throw new Error(data.error || "Failed to create session");
      }
      
      const { sessionId: newSessionId } = await postRes.json();
      setSessionId(newSessionId);
      return newSessionId;
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Could not connect to AI. Please try again.";
      setSessionError(errorMessage);
      throw error;
    }
  };
  
  // Retry session creation
  const retrySession = async () => {
    setSessionError(null);
    try {
      await getOrCreateSession();
    } catch {
      // Error already set by getOrCreateSession
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isSending || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: message.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    const userInput = message.trim();
    // Store the message in case we need to restore it on error
    const savedMessage = message.trim();
    setMessage("");
    setIsSending(true);
    setIsStreaming(true);

    let currentSessionId = sessionId;
    let retried = false;

    const attemptSend = async (sid: string): Promise<Response> => {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueNumber}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput, sessionId: sid }),
      });
      
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
          setReconnecting(true);
          
          try {
            // Create new session (which auto-injects context)
            const postRes = await fetch(`/api/projects/${projectId}/issues/${issueNumber}/session`, {
              method: "POST",
            });
            
            if (!postRes.ok) {
              const sessionError = await postRes.json().catch(() => ({}));
              throw new Error(sessionError.error || "Failed to create new session");
            }
            
            const { sessionId: newSessionId } = await postRes.json();
            setSessionId(newSessionId);
            currentSessionId = newSessionId;
            
            setReconnecting(false);
            
            // Retry with new session
            return attemptSend(newSessionId);
          } catch (reconnectError) {
            setReconnecting(false);
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
      setMessages((prev) => [...prev, {
        id: assistantMessageId,
        role: "assistant" as const,
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
      
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
                // Set unread indicator if user is on details tab (mobile)
                if (activeTabRef.current === "details") {
                  setHasUnread(true);
                }
              }
              if (streamError) {
                console.error("Stream error:", streamError);
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg && lastMsg.role === "assistant" && !lastMsg.content) {
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
      setMessage(savedMessage);
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
          content: "Sorry, I encountered an error. Your message has been restored - please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        return newMessages;
      });
    } finally {
      setIsSending(false);
      setIsStreaming(false);
      setReconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-card">
          <div className="flex h-12 items-center gap-2 px-4">
            <Link href={`/project/${projectId}`} className="h-7 w-7 rounded flex items-center justify-center hover:bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24 mt-1" />
            </div>
          </div>
        </header>
        <div className="flex-1 flex">
          {/* Skeleton for details panel */}
          <div className="hidden md:flex flex-col w-[400px] border-r border-border p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
          {/* Skeleton for chat panel */}
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (issueError && !issue) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-card">
          <div className="flex h-12 items-center gap-2 px-4">
            <Link href={`/project/${projectId}`} className="h-7 w-7 rounded flex items-center justify-center hover:bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-sm">Issue #{issueNumber}</h1>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="rounded-lg bg-destructive/10 p-4 max-w-md w-full">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Failed to load issue</p>
                <p className="text-sm text-muted-foreground mt-1">{issueError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={fetchIssue}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try again
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-12 items-center gap-2 px-4">
          <Link href={`/project/${projectId}`} className="h-7 w-7 rounded flex items-center justify-center hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">
              #{issue?.number}: {issue?.title}
            </h1>
            <p className="text-xs text-muted-foreground">Issue Discussion</p>
          </div>
          <div className="flex items-center gap-1">
            {issue?.url && (
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 w-7 rounded flex items-center justify-center hover:bg-secondary"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
            <Button variant="ghost" size="icon-sm" onClick={fetchIssue}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="flex border-t border-border md:hidden">
          <button
            onClick={() => handleTabChange("details")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors",
              activeTab === "details"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            Details
          </button>
          <button
            onClick={() => handleTabChange("chat")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors relative",
              activeTab === "chat"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            Chat
            {hasUnread && (
              <span className="absolute top-1 right-1/4 h-2 w-2 bg-destructive rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content - Split view on desktop, tabbed on mobile */}
      <div className="flex-1 overflow-hidden flex">
        {/* Issue Details Panel */}
        <div
          className={`${
            activeTab === "details" ? "flex" : "hidden"
          } md:flex flex-col w-full border-r border-border overflow-hidden relative flex-shrink-0`}
          style={{ width: typeof window !== "undefined" && window.innerWidth >= 768 ? panelWidth : undefined }}
        >
          {/* Drag handle - desktop only */}
          <div 
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors z-10 hidden md:block",
              isDragging ? "bg-primary" : "hover:bg-primary/30"
            )}
            onMouseDown={handleMouseDown}
          />
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Issue metadata */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded-full ${
                  issue?.state === "open" ? "bg-green-500/20 text-green-500" : "bg-purple-500/20 text-purple-500"
                }`}>
                  {issue?.state}
                </span>
                <span>by @{issue?.author?.login}</span>
                <span>·</span>
                <span>{issue?.createdAt && new Date(issue.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Labels */}
              {issue?.labels && issue.labels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {issue.labels.map((label) => (
                    <span
                      key={label.name}
                      className="px-2 py-0.5 text-xs rounded-full bg-secondary"
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Issue body */}
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-pre:bg-secondary prose-pre:text-foreground prose-code:text-foreground prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-secondary prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2">
                {issue?.body ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.body}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground italic">No description provided.</p>
                )}
              </div>

              {/* Comments section */}
              {issue?.comments && issue.comments.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Comments ({issue.comments.length})
                  </h3>
                  <div className="space-y-4">
                    {issue.comments.map((comment, i) => (
                      <div key={i} className="border-l-2 border-muted pl-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium">@{comment.author.login}</span>
                          <span>•</span>
                          <span>{formatDate(comment.createdAt)}</span>
                        </div>
                        <div className="mt-1 prose prose-sm dark:prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:bg-secondary prose-pre:text-foreground prose-code:text-foreground prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1 prose-th:bg-secondary prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div
          className={`${
            activeTab === "chat" ? "flex" : "hidden"
          } md:flex flex-col flex-1 overflow-hidden`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto p-4 space-y-4">
              {/* Session Error Display */}
              {sessionError && (
                <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
                  <h3 className="font-medium">Could not start conversation</h3>
                  <p className="text-sm text-muted-foreground mt-1">{sessionError}</p>
                  <Button className="mt-4" onClick={() => {
                    setSessionError(null);
                    retrySession();
                  }}>
                    Try again
                  </Button>
                </div>
              )}
              {messages.length === 0 && !isStreaming && !sessionError ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-foreground">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Ask the agent about this issue to start exploring the codebase.
                  </p>
                </div>
              ) : messages.length === 0 || sessionError ? null : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                      <div
                        className={`rounded-md px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <p
                        className={`text-[10px] text-muted-foreground mt-1 ${
                          msg.role === "user" ? "text-right" : ""
                        }`}
                      >
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {/* Typing indicator - show when streaming and last assistant message is empty */}
              {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-md px-3 py-2">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              {/* Initial loading indicator - show when sending but no assistant message yet */}
              {isSending && !messages.some(m => m.role === "assistant") && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-md px-3 py-2">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Session Error Banner */}
          {sessionError && (
            <div className="border-t border-destructive/50 bg-destructive/10 px-4 py-2">
              <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{sessionError}</span>
                </div>
                <Button variant="outline" size="sm" onClick={retrySession}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="max-w-3xl mx-auto flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={isStreaming ? "Waiting for response..." : "Ask the agent about this issue..."}
                className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm focus-ring disabled:opacity-50"
                disabled={isSending || isStreaming}
              />
              <Button
                variant="outline"
                onClick={() => setShowSaveModal(true)}
                disabled={!sessionId || messages.length < 2}
                title="Save Summary"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button onClick={handleSend} disabled={!message.trim() || isSending || isStreaming}>
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Summary Modal */}
      <SaveSummaryModal
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
        projectId={projectId}
        issueNumber={parseInt(issueNumber)}
        sessionId={sessionId}
        onSuccess={() => {
          // Refresh issue to show new comment
          fetchIssue()
        }}
      />

      {/* Reconnecting toast */}
      {reconnecting && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Reconnecting to AI...</span>
        </div>
      )}
    </div>
  );
}
