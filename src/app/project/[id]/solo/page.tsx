"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mockProjects } from "@/lib/data/mock";
import {
  ChevronLeft,
  Send,
  MoreHorizontal,
  MessageSquare,
} from "lucide-react";

export default function SoloPage() {
  const params = useParams();
  const project = mockProjects.find((p) => p.id === params.id) ?? mockProjects[0];
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string; timestamp: string }[]
  >([]);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: "user" as const,
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([...messages, userMessage]);
    setMessage("");

    setTimeout(() => {
      const assistantMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant" as const,
        content: "I understand. Let me help you with that. I'll start by examining the relevant files...\n\n```\nSearching: src/lib/utils.ts\nFound: formatDate function\n```\n\nI see the issue. Would you like me to make the fix?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-12 items-center gap-2 px-4">
          <Link href={`/project/${project.id}`} className="h-7 w-7 rounded flex items-center justify-center hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm">Solo Chat</h1>
            <p className="text-xs text-muted-foreground">{project.name}</p>
          </div>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="font-semibold mb-1">Start a conversation</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Work with an agent on quick tasks without formal planning.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%]`}>
                  <div className={`rounded-md px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-1 ${msg.role === "user" ? "text-right" : ""}`}>
                    {msg.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="What would you like to work on?"
            className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm focus-ring"
          />
          <Button onClick={handleSend} disabled={!message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
