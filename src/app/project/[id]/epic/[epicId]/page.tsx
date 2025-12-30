"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mockProjects, mockEpics } from "@/lib/data/mock";
import {
  ChevronLeft,
  GitBranch,
  ExternalLink,
  Zap,
  Plus,
  GripVertical,
  FileCode,
  CheckCircle,
  Circle,
  AlertCircle,
  Play,
  Send,
  MoreHorizontal,
} from "lucide-react";

export default function PlanningPage() {
  const params = useParams();
  const project = mockProjects.find((p) => p.id === params.id) ?? mockProjects[0];
  const epic = mockEpics.find((e) => e.id === params.epicId) ?? mockEpics[0];
  const [message, setMessage] = useState("");

  const done = epic.subtasks.filter((t) => t.status === "done").length;
  const total = epic.subtasks.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done": return <CheckCircle className="h-4 w-4 status-success" />;
      case "in_progress": return <Play className="h-4 w-4 status-info" />;
      case "blocked": return <AlertCircle className="h-4 w-4 status-warning" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
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
            <h1 className="font-semibold text-sm truncate">{epic.title}</h1>
            {epic.githubIssue && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                <span className="font-mono">{epic.githubIssue}</span>
                <span className="text-primary font-mono">{epic.branch}</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          {/* Description */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">{epic.description}</p>
            <div className="flex items-center gap-3 mt-3">
              <Button variant="ghost" size="sm" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1.5" />
                View Issue
              </Button>
              <span className="text-xs text-muted-foreground">
                {done} / {total} complete
              </span>
            </div>
          </div>

          {/* Tasks */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Subtasks
              </h2>
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

            <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
              {epic.subtasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-secondary/30 transition-colors">
                  <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 cursor-grab flex-shrink-0" />
                  {getStatusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                      {task.title}
                    </p>
                    {task.files.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <FileCode className="h-3 w-3 text-muted-foreground" />
                        {task.files.map((file, i) => (
                          <span key={i} className="text-xs text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                            {file.split("/").pop()}
                          </span>
                        ))}
                      </div>
                    )}
                    {task.status === "blocked" && (
                      <p className="text-xs status-warning mt-1">Blocked — requires attention</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Refine with chat */}
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Refine Plan
            </h2>
            <div className="border border-border rounded-md p-3 bg-secondary/30">
              <p className="text-sm text-muted-foreground">
                Chat with an agent to refine this plan, add tasks, or adjust scope.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-border bg-card px-4 py-3 space-y-3">
        <div className="max-w-3xl mx-auto">
          {/* Chat Input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about the plan..."
              className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm focus-ring"
            />
            <Button variant="ghost" size="icon-sm" disabled={!message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Launch Swarm */}
          {epic.state === "planned" && (
            <Link href={`/project/${project.id}/swarm/${epic.id}`}>
              <Button className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Launch Swarm
              </Button>
            </Link>
          )}

          {epic.state === "in_progress" && (
            <Link href={`/project/${project.id}/swarm/${epic.id}`}>
              <Button variant="outline" className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                View Swarm
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
