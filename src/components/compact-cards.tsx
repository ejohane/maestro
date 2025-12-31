"use client";

import Link from "next/link";
import { CircleDot, Circle, ChevronRight, MessageSquare } from "lucide-react";

// Import types from codebase
import { GitHubIssue } from "@/lib/types/api";
import { Epic, Session } from "@/lib/data/mock";

// CompactIssueCard - for issues in accordion
interface CompactIssueCardProps {
  issue: GitHubIssue;
  projectId: string;
}

export function CompactIssueCard({ issue, projectId }: CompactIssueCardProps) {
  return (
    <Link
      href={`/project/${projectId}/issue/${issue.number}`}
      className="flex items-center gap-3 p-3 rounded-md bg-card border border-border hover:bg-secondary/50 active:bg-secondary min-h-[44px]"
    >
      <CircleDot className="h-4 w-4 text-[hsl(var(--success))] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{issue.title}</p>
        <p className="text-xs text-muted-foreground">#{issue.number}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </Link>
  );
}

// CompactEpicCard - for ready/completed epics
interface CompactEpicCardProps {
  epic: Epic;
  projectId: string;
}

export function CompactEpicCard({ epic, projectId }: CompactEpicCardProps) {
  const taskCount = epic.subtasks.length;

  return (
    <Link
      href={`/project/${projectId}/epic/${epic.id}`}
      className="flex items-center gap-3 p-3 rounded-md bg-card border border-border hover:bg-secondary/50 active:bg-secondary min-h-[44px]"
    >
      <Circle className="h-4 w-4 text-[hsl(var(--info))] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{epic.title}</p>
        <p className="text-xs text-muted-foreground">{taskCount} tasks</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </Link>
  );
}

// CompactSwarmCard - for active swarms with progress
export function CompactSwarmCard({ epic, projectId }: CompactEpicCardProps) {
  const done = epic.subtasks.filter((t) => t.status === "done").length;
  const total = epic.subtasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href={`/project/${projectId}/swarm/${epic.id}`}
      className="flex items-center gap-3 p-3 rounded-md bg-card border border-border hover:bg-secondary/50 active:bg-secondary min-h-[44px]"
    >
      <div className="relative flex-shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute h-full w-full rounded-full bg-[hsl(var(--success))] opacity-75" />
          <span className="relative rounded-full h-2 w-2 bg-[hsl(var(--success))]" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{epic.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-secondary rounded-full">
            <div
              className="h-full bg-[hsl(var(--success))] rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </Link>
  );
}

// CompactSessionCard - for solo chat sessions
interface CompactSessionCardProps {
  session: Session;
  projectId: string;
}

export function CompactSessionCard({
  session,
  projectId,
}: CompactSessionCardProps) {
  return (
    <Link
      href={`/project/${projectId}/solo/${session.id}`}
      className="flex items-center gap-3 p-3 rounded-md bg-card border border-border hover:bg-secondary/50 active:bg-secondary min-h-[44px]"
    >
      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{session.title}</p>
        {session.lastMessage && (
          <p className="text-xs text-muted-foreground truncate">
            {session.lastMessage}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </Link>
  );
}
