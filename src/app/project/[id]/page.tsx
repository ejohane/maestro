"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { mockProjects, mockEpics, mockSoloSessions } from "@/lib/data/mock";
import {
  ChevronRight,
  Zap,
  Lightbulb,
  CheckCircle,
  MessageSquare,
  GitBranch,
  AlertCircle,
  Circle,
  MoreHorizontal,
  Plus,
} from "lucide-react";

export default function ProjectOverviewPage() {
  const params = useParams();
  const project = mockProjects.find((p) => p.id === params.id) ?? mockProjects[0];

  // Categorize epics for kanban columns
  const activeSwarms = mockEpics.filter(
    (e) => e.state === "in_progress" && e.subtasks.some((t) => t.assignedAgent)
  );
  const readyToSwarm = mockEpics.filter((e) => e.state === "planned");
  const ideas = mockEpics.filter((e) => e.state === "ideating");
  const completed = mockEpics.filter((e) => e.state === "closed");

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card flex-shrink-0">
        <div className="flex h-12 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-lg">{project.name}</h1>
            <span className="text-xs text-muted-foreground font-mono">{project.path}</span>
          </div>
          <button className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-secondary">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Recent Chats - Horizontal Scroll */}
        <div className="flex-shrink-0 border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recent Chats</span>
              </div>
              <Link 
                href={`/project/${project.id}/solo`}
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-thin">
              {/* New Chat Card */}
              <Link
                href={`/project/${project.id}/solo`}
                className="flex-shrink-0 w-48 h-24 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs font-medium">New Chat</span>
              </Link>
              
              {/* Session Cards */}
              {mockSoloSessions.map((session) => (
                <SessionCard key={session.id} session={session} projectId={project.id} />
              ))}
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full flex gap-4 overflow-x-auto">
            {/* Ideas Column */}
            <KanbanColumn
              title="Ideas"
              icon={<Lightbulb className="h-3.5 w-3.5" />}
              iconColor="text-[hsl(var(--orange))]"
              count={ideas.length}
              accentColor="bg-[hsl(var(--orange))]"
              addAction={`/project/${project.id}/ideate`}
            >
              {ideas.map((epic) => (
                <IdeaCard key={epic.id} epic={epic} projectId={project.id} />
              ))}
            </KanbanColumn>

            {/* Ready Column */}
            <KanbanColumn
              title="Ready"
              icon={<Circle className="h-3.5 w-3.5" />}
              iconColor="text-[hsl(var(--info))]"
              count={readyToSwarm.length}
              accentColor="bg-[hsl(var(--info))]"
            >
              {readyToSwarm.map((epic) => (
                <EpicCard key={epic.id} epic={epic} projectId={project.id} />
              ))}
            </KanbanColumn>

            {/* Active / Running Column */}
            <KanbanColumn
              title="Active"
              icon={<Zap className="h-3.5 w-3.5" />}
              iconColor="text-[hsl(var(--success))]"
              count={activeSwarms.length}
              accentColor="bg-[hsl(var(--success))]"
            >
              {activeSwarms.map((epic) => (
                <SwarmCard key={epic.id} epic={epic} projectId={project.id} />
              ))}
            </KanbanColumn>

            {/* Completed Column */}
            <KanbanColumn
              title="Completed"
              icon={<CheckCircle className="h-3.5 w-3.5" />}
              iconColor="text-muted-foreground"
              count={completed.length}
              accentColor="bg-muted-foreground"
            >
              {completed.map((epic) => (
                <CompletedCard key={epic.id} epic={epic} projectId={project.id} />
              ))}
            </KanbanColumn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Session Card Component
function SessionCard({ 
  session, 
  projectId 
}: { 
  session: (typeof mockSoloSessions)[0]; 
  projectId: string;
}) {
  return (
    <Link
      href={`/project/${projectId}/solo/${session.id}`}
      className="flex-shrink-0 w-48 h-24 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors p-3 flex flex-col justify-between group"
    >
      <div>
        <h4 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {session.title}
        </h4>
        <p className="text-xs text-muted-foreground truncate mt-1">
          {session.lastMessage}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{session.updatedAt}</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// Kanban Column Component
function KanbanColumn({
  title,
  icon,
  iconColor,
  count,
  accentColor,
  addAction,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  count: number;
  accentColor: string;
  addAction?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-secondary/30 rounded-lg">
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={`${iconColor}`}>{icon}</div>
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
            {count}
          </span>
        </div>
        {addAction && (
          <Link
            href={addAction}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
          </Link>
        )}
      </div>
      
      {/* Column Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {children}
      </div>
      
      {/* Accent Line */}
      <div className={`h-1 ${accentColor} rounded-b-lg`} />
    </div>
  );
}

// Swarm Card (Active items with progress)
function SwarmCard({ epic, projectId }: { epic: (typeof mockEpics)[0]; projectId: string }) {
  const done = epic.subtasks.filter((t) => t.status === "done").length;
  const total = epic.subtasks.length;
  const blocked = epic.subtasks.filter((t) => t.status === "blocked").length;
  const running = epic.subtasks.filter((t) => t.status === "in_progress").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href={`/project/${projectId}/swarm/${epic.id}`}
      className="block p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors group"
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="relative flex h-2 w-2 mt-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--success))]"></span>
        </span>
        <span className="font-medium text-sm flex-1">{epic.title}</span>
      </div>
      
      {epic.githubIssue && (
        <div className="flex items-center gap-1.5 mb-2 ml-4">
          <GitBranch className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono">{epic.githubIssue}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs ml-4">
        {blocked > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-status-warning status-warning font-medium">
            <AlertCircle className="h-3 w-3" />
            {blocked}
          </span>
        )}
        <span className="text-muted-foreground">{running} running</span>
      </div>

      <div className="mt-3 ml-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-[hsl(var(--success))] rounded-full transition-all" 
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
        </div>
      </div>
    </Link>
  );
}

// Epic Card (Ready items)
function EpicCard({ epic, projectId }: { epic: (typeof mockEpics)[0]; projectId: string }) {
  const total = epic.subtasks.length;

  return (
    <Link
      href={`/project/${projectId}/epic/${epic.id}`}
      className="block p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors group"
    >
      <h4 className="font-medium text-sm mb-2">{epic.title}</h4>
      
      {epic.githubIssue && (
        <div className="flex items-center gap-1.5 mb-2">
          <GitBranch className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono">{epic.githubIssue}</span>
          <span className="text-xs text-primary font-mono">{epic.branch}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} tasks</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// Idea Card
function IdeaCard({ epic, projectId }: { epic: (typeof mockEpics)[0]; projectId: string }) {
  return (
    <Link
      href={`/project/${projectId}/ideate?epic=${epic.id}`}
      className="block p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors group"
    >
      <h4 className="font-medium text-sm mb-1">{epic.title}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">{epic.description}</p>
      <div className="flex justify-end mt-2">
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// Completed Card
function CompletedCard({ epic, projectId }: { epic: (typeof mockEpics)[0]; projectId: string }) {
  return (
    <Link
      href={`/project/${projectId}/epic/${epic.id}`}
      className="block p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors group opacity-75 hover:opacity-100"
    >
      <div className="flex items-start gap-2">
        <CheckCircle className="h-4 w-4 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-muted-foreground">{epic.title}</h4>
          {epic.githubIssue && (
            <span className="text-xs text-muted-foreground font-mono">{epic.githubIssue}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
