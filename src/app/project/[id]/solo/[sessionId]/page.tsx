"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mockProjects, mockSoloSessions } from "@/lib/data/mock";
import {
  ChevronLeft,
  Send,
  MoreHorizontal,
} from "lucide-react";

export default function SoloSessionPage() {
  const params = useParams();
  const project = mockProjects.find((p) => p.id === params.id) ?? mockProjects[0];
  const session = mockSoloSessions.find((s) => s.id === params.sessionId) ?? mockSoloSessions[0];
  const [message, setMessage] = useState("");

  const [messages] = useState([
    {
      id: "msg-1",
      role: "user" as const,
      content: "The pagination seems off. Users are seeing duplicate items when scrolling.",
      timestamp: "Yesterday 2:30 PM",
    },
    {
      id: "msg-2",
      role: "assistant" as const,
      content: "I'll look into the pagination logic. Let me check the API endpoint and the frontend component...\n\n```\nReading src/api/items.ts...\nReading src/components/ItemList.tsx...\n```\n\nI found the issue! The offset calculation is off by one. When fetching page 2, it's using offset 0 instead of offset equal to page size.",
      timestamp: "Yesterday 2:31 PM",
    },
    {
      id: "msg-3",
      role: "user" as const,
      content: "Can you fix it?",
      timestamp: "Yesterday 2:32 PM",
    },
    {
      id: "msg-4",
      role: "assistant" as const,
      content: "Done! I've updated the offset calculation in `src/api/items.ts`. The fix:\n\n```diff\n- const offset = (page - 1) * 0;\n+ const offset = (page - 1) * pageSize;\n```\n\nThe offset was off by one, fixed it.",
      timestamp: "Yesterday 2:33 PM",
    },
  ]);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessage("");
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
            <h1 className="font-semibold text-sm truncate">{session.title}</h1>
            <p className="text-xs text-muted-foreground">{session.updatedAt}</p>
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
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Continue the conversation..."
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
