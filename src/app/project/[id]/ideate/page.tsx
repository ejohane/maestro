"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mockProjects, mockIdeationChat, mockEpics } from "@/lib/data/mock";
import {
  ChevronLeft,
  Send,
  GitBranch,
  MoreHorizontal,
} from "lucide-react";

export default function IdeationPage() {
  const params = useParams();
  const project = mockProjects.find((p) => p.id === params.id) ?? mockProjects[0];
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(mockIdeationChat);
  const ideaEpic = mockEpics.find((e) => e.state === "ideating");

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
        content: "That's a great point! I think we should definitely consider that approach. Shall I help you formalize this into a GitHub issue and start planning the implementation?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
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
            <h1 className="font-semibold text-sm truncate">{ideaEpic?.title ?? "New Idea"}</h1>
            <p className="text-xs text-muted-foreground">Ideation</p>
          </div>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
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
      </div>

      {/* Formalize CTA */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Ready to formalize?</p>
            <p className="text-xs text-muted-foreground">Create a GitHub issue and start planning</p>
          </div>
          <Link href={`/project/${project.id}/epic/epic-4`}>
            <Button variant="outline" size="sm">
              <GitBranch className="h-3 w-3 mr-1.5" />
              Create Issue
            </Button>
          </Link>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Continue exploring this idea..."
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
