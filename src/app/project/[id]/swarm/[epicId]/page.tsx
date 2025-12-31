"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mockProjects, mockEpics, mockAgents } from "@/lib/data/mock";
import {
  ChevronLeft,
  Pause,
  CheckCircle,
  Circle,
  AlertCircle,
  Send,
  FileCode,
  RefreshCw,
  Activity,
  Play,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function SwarmPage() {
  const params = useParams();
  const project = mockProjects.find((p) => p.id === params.id) ?? mockProjects[0];
  const epic = mockEpics.find((e) => e.id === params.epicId) ?? mockEpics[0];
  const [expandedAgent, setExpandedAgent] = useState<string | null>("agent-3");
  const [intervention, setIntervention] = useState("");

  const done = epic.subtasks.filter((t) => t.status === "done").length;
  const total = epic.subtasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const blocked = mockAgents.filter((a) => a.status === "blocked").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-12 items-center gap-2 px-4">
          <SidebarTrigger className="lg:hidden" />
          <Link href={`/project/${project.id}`} className="h-7 w-7 rounded flex items-center justify-center hover:bg-secondary">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--success))]"></span>
            </span>
            <h1 className="font-semibold text-sm truncate">{epic.title}</h1>
          </div>
          <Button variant="outline" size="sm">
            <Pause className="h-3 w-3 mr-1.5" />
            Pause
          </Button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4 text-center mb-3">
            <Stat label="Progress" value={`${pct}%`} />
            <Stat label="Completed" value={done.toString()} color="success" />
            <Stat label="Running" value={mockAgents.filter(a => a.status === "working").length.toString()} color="info" />
            <Stat label="Blocked" value={blocked.toString()} color={blocked > 0 ? "warning" : undefined} />
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-[hsl(var(--success))] rounded-full transition-all duration-500" 
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          {/* Blocked Alert */}
          {blocked > 0 && (
            <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-md border border-[hsl(var(--warning))]/30 bg-status-warning">
              <AlertCircle className="h-4 w-4 status-warning" />
              <span className="text-sm font-medium status-warning">
                {blocked} agent{blocked > 1 ? "s" : ""} blocked — intervention required
              </span>
            </div>
          )}

          {/* Agents */}
          <div className="mb-6">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Agents
            </h2>
            <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
              {mockAgents.map((agent) => {
                const isExpanded = expandedAgent === agent.id;
                const isBlocked = agent.status === "blocked";
                const isWorking = agent.status === "working";
                
                return (
                  <div key={agent.id}>
                    <button
                      onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                    >
                      {/* Status indicator */}
                      <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                        isBlocked ? "bg-status-warning" : isWorking ? "bg-status-success" : "bg-secondary"
                      }`}>
                        {isBlocked ? (
                          <AlertCircle className="h-3.5 w-3.5 status-warning" />
                        ) : isWorking ? (
                          <Activity className="h-3.5 w-3.5 status-success animate-subtle-pulse" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      
                      {/* Agent info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{agent.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            isBlocked 
                              ? "bg-status-warning status-warning" 
                              : isWorking 
                              ? "bg-status-success status-success"
                              : "bg-secondary text-muted-foreground"
                          }`}>
                            {agent.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{agent.currentTask}</p>
                      </div>

                      {/* Progress */}
                      <div className="flex items-center gap-2 w-20">
                        <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isBlocked ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]"}`}
                            style={{ width: `${agent.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono w-7">{agent.progress}%</span>
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-3 py-3 bg-secondary/30 border-t border-border">
                        {/* Terminal output */}
                        <div className="rounded border border-border bg-[hsl(220,13%,6%)] p-3 font-mono text-xs mb-3">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <span className="text-[10px] uppercase tracking-wider">Output</span>
                          </div>
                          <div className="text-[hsl(var(--success))]">
                            <span className="text-muted-foreground">$ </span>
                            {agent.lastMessage}
                            {isWorking && <span className="inline-block w-1.5 h-3.5 bg-[hsl(var(--success))] ml-0.5 animate-pulse" />}
                          </div>
                        </div>

                        {/* Intervention for blocked */}
                        {isBlocked && (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={intervention}
                                onChange={(e) => setIntervention(e.target.value)}
                                placeholder="Send intervention message..."
                                className="flex-1 h-8 px-3 rounded-md border border-border bg-background text-sm focus-ring"
                              />
                              <Button size="sm" disabled={!intervention.trim()}>
                                <Send className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1">
                                <RefreshCw className="h-3 w-3 mr-1.5" />
                                Retry
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive">
                                Skip
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* File Reservations */}
          <div className="mb-6">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
              File Locks
            </h2>
            <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
              {mockAgents.filter(a => a.currentTask).map((agent) => {
                const task = epic.subtasks.find(t => t.title === agent.currentTask);
                return task?.files.map((file) => (
                  <div key={file} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono text-xs flex-1 truncate">{file}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      agent.status === "blocked" 
                        ? "bg-status-warning status-warning" 
                        : "bg-status-success status-success"
                    }`}>
                      {agent.name}
                    </span>
                  </div>
                ));
              })}
            </div>
          </div>

          {/* Tasks */}
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Tasks
            </h2>
            <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
              {epic.subtasks.map((task) => {
                const agent = mockAgents.find(a => a.id === task.assignedAgent);
                const isDone = task.status === "done";
                const isInProgress = task.status === "in_progress";
                const isBlocked = task.status === "blocked";
                
                return (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2">
                    {isDone && <CheckCircle className="h-4 w-4 status-success flex-shrink-0" />}
                    {isInProgress && <Play className="h-4 w-4 status-info flex-shrink-0" />}
                    {isBlocked && <AlertCircle className="h-4 w-4 status-warning flex-shrink-0" />}
                    {task.status === "pending" && <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    
                    <span className={`text-sm flex-1 ${isDone ? "text-muted-foreground line-through" : ""}`}>
                      {task.title}
                    </span>
                    
                    {agent && (
                      <span className="text-xs text-muted-foreground">{agent.name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: string; 
  color?: "success" | "warning" | "info";
}) {
  const colorClass = color === "success" 
    ? "status-success" 
    : color === "warning" 
    ? "status-warning" 
    : color === "info"
    ? "status-info"
    : "";
    
  return (
    <div>
      <div className={`text-xl font-semibold font-mono ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
