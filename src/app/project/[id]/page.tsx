"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { mockEpics, mockSoloSessions } from "@/lib/data/mock";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { useProject, useProjectIssues, usePlanningSessions } from "@/lib/hooks/useProjects";
import { CompactSessionCard, CompactIssueCard, CompactEpicCard, CompactSwarmCard, CompactPlanningCard } from "@/components/compact-cards";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { GitHubIssue, PlanningSessionInfo } from "@/lib/types/api";
import {
  ChevronRight,
  Zap,
  CheckCircle,
  MessageSquare,
  GitBranch,
  AlertCircle,
  ClipboardList,
  MoreHorizontal,
  Plus,
  CircleDot,
} from "lucide-react";

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const project = useProject(projectId);
  const { data: issues = [], isLoading: issuesLoading } = useProjectIssues(projectId);
  const { data: planningSessions = [], isLoading: planningLoading } = usePlanningSessions(projectId);
  const [isNewIssueDialogOpen, setIsNewIssueDialogOpen] = useState(false);

  // Loading state
  if (!project) {
    return (
      <div className="h-full bg-background flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-card flex-shrink-0">
          <div className="flex h-12 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  // Categorize epics for kanban columns
  const activeSwarms = mockEpics.filter(
    (e) => e.state === "in_progress" && e.subtasks.some((t) => t.assignedAgent)
  );
  const completed = mockEpics.filter((e) => e.state === "closed");

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card flex-shrink-0">
        <div className="flex h-12 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="lg:hidden" />
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
        {/* Recent Chats Section */}
        <RecentChatsSection projectId={projectId} />

        {/* Mobile Accordion Layout (< lg) */}
        <div className="lg:hidden flex-1 overflow-y-auto px-4 py-4">
          <Accordion type="single" collapsible defaultValue="issues">
            {/* Issues Section */}
            <AccordionItem value="issues">
              <AccordionTrigger className="py-3">
                <div className="flex items-center gap-2">
                  <CircleDot className="h-4 w-4 text-[hsl(var(--orange))]" />
                  <span className="font-medium">Issues</span>
                  <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                    {issues.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {/* New Issue Button */}
                  <button
                    onClick={() => setIsNewIssueDialogOpen(true)}
                    className="w-full h-11 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">New Issue</span>
                  </button>
                  {issuesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : issues.length > 0 ? (
                    issues.map((issue) => (
                      <CompactIssueCard key={issue.number} issue={issue} projectId={projectId} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No open issues</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Planning Section */}
            <AccordionItem value="planning">
              <AccordionTrigger className="py-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <span className="font-medium">Planning</span>
                  <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                    {planningLoading ? "..." : planningSessions.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {planningLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : planningSessions.length > 0 ? (
                    planningSessions.map((session) => (
                      <CompactPlanningCard key={session.issueNumber} session={session} projectId={projectId} />
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No active planning sessions</p>
                      <p className="text-xs text-muted-foreground mt-1">Start planning from an issue</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Active Section */}
            <AccordionItem value="active">
              <AccordionTrigger className="py-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[hsl(var(--success))]" />
                  <span className="font-medium">Active</span>
                  <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                    {activeSwarms.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {activeSwarms.length > 0 ? (
                    activeSwarms.map((epic) => (
                      <CompactSwarmCard key={epic.id} epic={epic} projectId={projectId} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No active swarms</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Completed Section */}
            <AccordionItem value="completed">
              <AccordionTrigger className="py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Completed</span>
                  <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                    {completed.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {completed.length > 0 ? (
                    completed.map((epic) => (
                      <CompactEpicCard key={epic.id} epic={epic} projectId={projectId} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No completed items</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Desktop Kanban Board (>= lg) */}
        <div className="hidden lg:block flex-1 overflow-hidden p-6">
          <div className="h-full flex gap-4 overflow-x-auto">
            {/* Issues Column */}
            <KanbanColumn
              title="Issues"
              icon={<CircleDot className="h-3.5 w-3.5" />}
              iconColor="text-[hsl(var(--orange))]"
              count={issues.length}
              accentColor="bg-[hsl(var(--orange))]"
              onAddClick={() => setIsNewIssueDialogOpen(true)}
              isLoading={issuesLoading}
            >
              {issues.map((issue) => (
                <IssueCard key={issue.number} issue={issue} projectId={projectId} />
              ))}
            </KanbanColumn>

            {/* Planning Column */}
            <KanbanColumn
              title="Planning"
              icon={<ClipboardList className="h-3.5 w-3.5" />}
              iconColor="text-primary"
              count={planningSessions.length}
              accentColor="bg-primary"
              isLoading={planningLoading}
            >
              {planningSessions.length > 0 ? (
                planningSessions.map((session) => (
                  <PlanningSessionCard key={session.issueNumber} session={session} projectId={projectId} />
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">No active planning sessions</p>
                  <p className="text-xs text-muted-foreground mt-1">Start planning from an issue</p>
                </div>
              )}
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
                <SwarmCard key={epic.id} epic={epic} projectId={projectId} />
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
                <CompletedCard key={epic.id} epic={epic} projectId={projectId} />
              ))}
            </KanbanColumn>
          </div>
        </div>
      </div>

      {/* New Issue Dialog */}
      <NewIssueDialog
        projectId={projectId}
        projectPath={project.path}
        open={isNewIssueDialogOpen}
        onOpenChange={setIsNewIssueDialogOpen}
      />
    </div>
  );
}

// Recent Chats Section - Responsive layout
function RecentChatsSection({ projectId }: { projectId: string }) {
  const mobileSessions = mockSoloSessions.slice(0, 3);
  const hasMoreSessions = mockSoloSessions.length > 3;

  return (
    <div className="flex-shrink-0 border-b border-border">
      {/* Mobile Layout (< lg) */}
      <div className="lg:hidden px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Chats</span>
          </div>
          {hasMoreSessions && (
            <Link
              href={`/project/${projectId}/solo`}
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          )}
        </div>

        {/* Full-width New Chat button */}
        <Link
          href={`/project/${projectId}/solo`}
          className="w-full h-11 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground mb-3"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">New Chat</span>
        </Link>

        {/* Vertical list of sessions */}
        <div className="space-y-2">
          {mobileSessions.map((session) => (
            <CompactSessionCard
              key={session.id}
              session={session}
              projectId={projectId}
            />
          ))}
        </div>
      </div>

      {/* Desktop Layout (>= lg) */}
      <div className="hidden lg:block px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Chats</span>
          </div>
          <Link
            href={`/project/${projectId}/solo`}
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-thin">
          {/* New Chat Card */}
          <Link
            href={`/project/${projectId}/solo`}
            className="flex-shrink-0 w-48 h-24 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-medium">New Chat</span>
          </Link>

          {/* Session Cards */}
          {mockSoloSessions.map((session) => (
            <SessionCard key={session.id} session={session} projectId={projectId} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Session Card Component (Desktop)
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
  onAddClick,
  isLoading,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  count: number;
  accentColor: string;
  addAction?: string;
  onAddClick?: () => void;
  isLoading?: boolean;
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
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Column Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          children
        )}
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

// Epic Card (Ready items) - Currently unused after replacing Ready column with Planning
// Keeping for potential future use
function _EpicCard({ epic, projectId }: { epic: (typeof mockEpics)[0]; projectId: string }) {
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

// Planning Session Card (Active planning sessions)
function PlanningSessionCard({ 
  session, 
  projectId 
}: { 
  session: PlanningSessionInfo; 
  projectId: string;
}) {
  // Format the display title - remove "Issue #N" prefix if present
  // API may return "Issue #42" as title, but we show issue number separately
  const displayTitle = session.issueTitle.replace(/^Issue #\d+/, "").trim() || `Planning #${session.issueNumber}`;

  return (
    <Link
      href={`/project/${projectId}/planning/${session.issueNumber}`}
      className="block p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors group"
    >
      <div className="flex items-start gap-2 mb-1">
        <ClipboardList className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
        <h4 className="font-medium text-sm flex-1">{displayTitle}</h4>
      </div>
      <div className="flex items-center justify-between ml-5.5">
        <span className="text-xs text-muted-foreground font-mono">#{session.issueNumber}</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// Issue Card (GitHub issues)
function IssueCard({ issue, projectId }: { issue: GitHubIssue; projectId: string }) {
  return (
    <Link
      href={`/project/${projectId}/issue/${issue.number}`}
      className="block p-3 rounded-md bg-card border border-border hover:border-primary/50 transition-colors group"
    >
      <div className="flex items-start gap-2 mb-1">
        <CircleDot className="h-3.5 w-3.5 text-[hsl(var(--success))] flex-shrink-0 mt-0.5" />
        <h4 className="font-medium text-sm flex-1">{issue.title}</h4>
      </div>
      <div className="flex items-center gap-2 ml-5.5">
        <span className="text-xs text-muted-foreground font-mono">#{issue.number}</span>
        {issue.labels.length > 0 && (
          <div className="flex gap-1">
            {issue.labels.slice(0, 2).map((label) => (
              <span
                key={label.name}
                className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </div>
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
