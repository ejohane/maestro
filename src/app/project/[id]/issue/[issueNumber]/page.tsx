"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import { toAIElementsMessages } from "@/lib/utils/message-adapter";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  MoreHorizontal,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
  MessageSquare,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import { SaveSummaryModal } from "@/components/save-summary-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader } from "@/components/ai-elements/loader";
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
  PromptInputButton,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { useChatSession } from "@/lib/hooks/useChatSession";

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

export default function IssueViewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const issueNumber = params.issueNumber as string;
  
  // Issue state
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [isLoadingIssue, setIsLoadingIssue] = useState(true);
  const [issueError, setIssueError] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<"details" | "chat">("chat");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
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
  
  // Chat session hook
  const {
    messages,
    input,
    setInput,
    isSending,
    isStreaming,
    isReconnecting,
    error: sessionError,
    sessionId,
    sendMessage,
    retrySession,
    clearError,
  } = useChatSession({
    projectId,
    issueNumber,
    onStreamChunk: () => {
      // Set unread indicator if user is on details tab (mobile)
      if (activeTabRef.current === "details") {
        setHasUnread(true);
      }
    },
  });
  
  // Handle tab change with unread clearing
  const handleTabChange = (tab: "details" | "chat") => {
    setActiveTab(tab)
    if (tab === "chat") {
      setHasUnread(false)
    }
  }

  // Handle copy message to clipboard
  const handleCopyMessage = useCallback((messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  // Handle PromptInput submission
  const handlePromptSubmit = async (msg: PromptInputMessage) => {
    if (!msg.text?.trim()) return;
    // The sendMessage from useChatSession expects input to be set
    // We need to set it then call sendMessage
    setInput(msg.text);
    // Use setTimeout to ensure state is updated before sending
    setTimeout(() => sendMessage(), 0);
  };

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
    setIsLoadingIssue(true);
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
      setIsLoadingIssue(false);
    }
  }, [projectId, issueNumber]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  if (isLoadingIssue) {
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
          <Conversation className="flex-1">
            <ConversationContent className="max-w-3xl mx-auto gap-4">
              {/* Session Error Display */}
              {sessionError && (
                <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
                  <h3 className="font-medium">Could not start conversation</h3>
                  <p className="text-sm text-muted-foreground mt-1">{sessionError}</p>
                  <Button className="mt-4" onClick={() => {
                    clearError();
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
                toAIElementsMessages(messages).map((message, index) => (
                  <Message key={message.id} from={message.role}>
                    <MessageContent className={message.role === "user" ? "!bg-primary !text-primary-foreground" : ""}>
                      {message.parts.map((part, partIndex) => {
                        if (part.type === "text") {
                          return (
                            <MessageResponse key={partIndex}>
                              {part.text}
                            </MessageResponse>
                          );
                        }
                        return null;
                      })}
                    </MessageContent>
                    {/* Copy action for assistant messages only */}
                    {message.role === "assistant" && messages[index].content && (
                      <MessageActions>
                        <MessageAction
                          tooltip={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                          onClick={() => handleCopyMessage(message.id, messages[index].content)}
                        >
                          {copiedMessageId === message.id ? (
                            <CheckIcon className="size-3" />
                          ) : (
                            <CopyIcon className="size-3" />
                          )}
                        </MessageAction>
                      </MessageActions>
                    )}
                    <p
                      className={`text-[10px] text-muted-foreground mt-1 ${
                        message.role === "user" ? "text-right" : ""
                      }`}
                    >
                      {messages[index].timestamp}
                    </p>
                  </Message>
                ))
              )}
              {/* Typing indicator - show when streaming and last assistant message is empty */}
              {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content === "" && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-md px-3 py-2">
                    <Loader size={20} className="text-muted-foreground" />
                  </div>
                </div>
              )}
              {/* Initial loading indicator - show when sending but no assistant message yet */}
              {isSending && !messages.some(m => m.role === "assistant") && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-md px-3 py-2">
                    <Loader size={20} className="text-muted-foreground" />
                  </div>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

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
          <div className="border-t border-border bg-card">
            <div className="max-w-3xl mx-auto">
              <PromptInput onSubmit={handlePromptSubmit}>
                <PromptInputBody>
                  <PromptInputTextarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isStreaming ? "Waiting for response..." : "Ask the agent about this issue..."}
                    disabled={isSending || isStreaming}
                  />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    <PromptInputButton
                      onClick={() => setShowSaveModal(true)}
                      disabled={!sessionId || messages.length < 2}
                      title="Save Summary"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="sr-only">Save Summary</span>
                    </PromptInputButton>
                  </PromptInputTools>
                  <PromptInputSubmit 
                    disabled={!input.trim() || isSending || isStreaming}
                    status={isStreaming ? "streaming" : isSending ? "submitted" : undefined}
                  />
                </PromptInputFooter>
              </PromptInput>
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
      {isReconnecting && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Reconnecting to AI...</span>
        </div>
      )}
    </div>
  );
}
