"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Send,
  MoreHorizontal,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "chat">("chat");

  // Fetch issue details
  const fetchIssue = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueNumber}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch issue");
      }
      const data = await response.json();
      setIssue(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch issue");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssue();
  }, [projectId, issueNumber]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsSending(true);

    // TODO: Integrate with OpenCode SDK for real agent responses
    // For now, simulate a response
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: "I understand you're working on this issue. Let me help you explore the codebase and understand the context better. What specific aspect would you like me to investigate?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsSending(false);
    }, 1000);
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
              <div className="h-4 w-48 bg-secondary rounded animate-pulse" />
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
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
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive text-center">{error}</p>
          <Button onClick={fetchIssue} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
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
            onClick={() => setActiveTab("details")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === "details"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === "chat"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Chat
          </button>
        </div>
      </header>

      {/* Main Content - Split view on desktop, tabbed on mobile */}
      <div className="flex-1 overflow-hidden flex">
        {/* Issue Details Panel */}
        <div
          className={`${
            activeTab === "details" ? "flex" : "hidden"
          } md:flex flex-col w-full md:w-[400px] md:min-w-[300px] md:max-w-[500px] border-r border-border overflow-hidden`}
        >
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
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {issue?.body ? (
                  <p className="whitespace-pre-wrap">{issue.body}</p>
                ) : (
                  <p className="text-muted-foreground italic">No description provided.</p>
                )}
              </div>
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
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-sm">
                    Ask the agent about this issue to start the conversation.
                  </p>
                </div>
              ) : (
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
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-md px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="max-w-3xl mx-auto flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask the agent about this issue..."
                className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm focus-ring"
                disabled={isSending}
              />
              <Button onClick={handleSend} disabled={!message.trim() || isSending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
