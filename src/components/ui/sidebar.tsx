"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState } from "react";
import { mockEpics, mockSoloSessions } from "@/lib/data/mock";
import { useProjects } from "@/lib/hooks/useProjects";
import { FolderBrowserModal } from "@/components/folder-browser";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Zap,
  Circle,
  Lightbulb,
  CheckCircle,
  MessageSquare,
  Clock,
  FolderOpen,
  Plus,
  Search,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeItemProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  statusIndicator?: "active" | "warning" | "info";
}

function TreeItem({
  icon,
  label,
  href,
  active,
  children,
  defaultOpen = false,
  count,
  statusIndicator,
}: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  const content = (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
      onClick={() => hasChildren && setIsOpen(!isOpen)}
    >
      {hasChildren ? (
        <span className="w-4 h-4 flex items-center justify-center">
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
      ) : (
        <span className="w-4 h-4" />
      )}
      <span className="flex items-center gap-2 flex-1 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {statusIndicator === "active" && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--success))]"></span>
        </span>
      )}
      {statusIndicator === "warning" && (
        <Circle className="h-2 w-2 fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" />
      )}
      {statusIndicator === "info" && (
        <Circle className="h-2 w-2 fill-[hsl(var(--info))] text-[hsl(var(--info))]" />
      )}
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </div>
  );

  return (
    <div>
      {href ? <Link href={href}>{content}</Link> : content}
      {hasChildren && isOpen && <div className="ml-4">{children}</div>}
    </div>
  );
}

export function Sidebar() {
  const params = useParams();
  const pathname = usePathname();
  const currentProjectId = params.id as string;
  const { data: projects, isLoading } = useProjects();
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);

  // Categorize epics
  const activeSwarms = mockEpics.filter(
    (e) => e.state === "in_progress" && e.subtasks.some((t) => t.assignedAgent)
  );
  const inProgress = mockEpics.filter(
    (e) => e.state === "in_progress" && !e.subtasks.some((t) => t.assignedAgent)
  );
  const readyToSwarm = mockEpics.filter((e) => e.state === "planned");
  const ideas = mockEpics.filter((e) => e.state === "ideating");
  const completed = mockEpics.filter((e) => e.state === "closed");

  return (
    <div className="w-64 h-screen flex flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="h-12 flex items-center gap-2 px-3 border-b border-border">
        <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <span className="font-semibold text-sm">Maestro</span>
      </div>

      {/* Search */}
      <div className="p-2">
        <button className="w-full h-8 px-3 rounded-md text-xs text-muted-foreground bg-secondary/50 hover:bg-secondary flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px]">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Tree Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {/* Projects Section */}
        <div className="mb-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projects
            </span>
            <button 
              onClick={() => setFolderBrowserOpen(true)}
              className="h-5 w-5 rounded hover:bg-secondary flex items-center justify-center"
              aria-label="Add project"
            >
              <Plus className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="px-4 py-2 text-xs text-muted-foreground">
            Loading...
          </div>
        ) : projects?.length ? (
          projects.map((project) => {
            const isCurrentProject = project.id === currentProjectId;
            const isMissing = project.status === "missing";

            return (
              <TreeItem
                key={project.id}
                icon={
                  isCurrentProject ? (
                    <FolderOpen className="h-4 w-4 text-primary" />
                  ) : (
                    <Folder className={cn("h-4 w-4", isMissing && "text-yellow-600")} />
                  )
                }
                label={project.displayName}
                href={isMissing ? undefined : undefined}
                defaultOpen={isCurrentProject}
                statusIndicator={isMissing ? "warning" : undefined}
              >
                {isCurrentProject && (
                  <>
                    {/* Active Swarms */}
                    {activeSwarms.length > 0 && (
                      <TreeItem
                        icon={<Zap className="h-3.5 w-3.5 text-[hsl(var(--success))]" />}
                        label="Active Swarms"
                        count={activeSwarms.length}
                        defaultOpen={true}
                      >
                        {activeSwarms.map((epic) => (
                          <TreeItem
                            key={epic.id}
                            icon={<Circle className="h-2 w-2 fill-[hsl(var(--success))] text-[hsl(var(--success))]" />}
                            label={epic.title}
                            href={`/project/${project.id}/swarm/${epic.id}`}
                            active={pathname.includes(`/swarm/${epic.id}`)}
                            statusIndicator="active"
                          />
                        ))}
                      </TreeItem>
                    )}

                    {/* In Progress */}
                    {inProgress.length > 0 && (
                      <TreeItem
                        icon={<Clock className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />}
                        label="In Progress"
                        count={inProgress.length}
                        defaultOpen={true}
                      >
                        {inProgress.map((epic) => (
                          <TreeItem
                            key={epic.id}
                            icon={<Circle className="h-2 w-2" />}
                            label={epic.title}
                            href={`/project/${project.id}/epic/${epic.id}`}
                            active={pathname.includes(`/epic/${epic.id}`)}
                            statusIndicator="warning"
                          />
                        ))}
                      </TreeItem>
                    )}

                    {/* Ready */}
                    {readyToSwarm.length > 0 && (
                      <TreeItem
                        icon={<Circle className="h-3.5 w-3.5 text-[hsl(var(--info))]" />}
                        label="Ready"
                        count={readyToSwarm.length}
                      >
                        {readyToSwarm.map((epic) => (
                          <TreeItem
                            key={epic.id}
                            icon={<Circle className="h-2 w-2" />}
                            label={epic.title}
                            href={`/project/${project.id}/epic/${epic.id}`}
                            active={pathname.includes(`/epic/${epic.id}`)}
                          />
                        ))}
                      </TreeItem>
                    )}

                    {/* Ideas */}
                    {ideas.length > 0 && (
                      <TreeItem
                        icon={<Lightbulb className="h-3.5 w-3.5 text-[hsl(var(--orange))]" />}
                        label="Ideas"
                        count={ideas.length}
                      >
                        {ideas.map((epic) => (
                          <TreeItem
                            key={epic.id}
                            icon={<Lightbulb className="h-2.5 w-2.5" />}
                            label={epic.title}
                            href={`/project/${project.id}/ideate?epic=${epic.id}`}
                            active={pathname.includes("/ideate") && pathname.includes(epic.id)}
                          />
                        ))}
                      </TreeItem>
                    )}

                    {/* Completed */}
                    {completed.length > 0 && (
                      <TreeItem
                        icon={<CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                        label="Completed"
                        count={completed.length}
                      >
                        {completed.map((epic) => (
                          <TreeItem
                            key={epic.id}
                            icon={<CheckCircle className="h-2.5 w-2.5 text-[hsl(var(--success))]" />}
                            label={epic.title}
                            href={`/project/${project.id}/epic/${epic.id}`}
                            active={pathname.includes(`/epic/${epic.id}`)}
                          />
                        ))}
                      </TreeItem>
                    )}

                    {/* Solo Sessions */}
                    <TreeItem
                      icon={<MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                      label="Solo Sessions"
                      count={mockSoloSessions.length}
                    >
                      {mockSoloSessions.map((session) => (
                        <TreeItem
                          key={session.id}
                          icon={<MessageSquare className="h-2.5 w-2.5" />}
                          label={session.title}
                          href={`/project/${project.id}/solo/${session.id}`}
                          active={pathname.includes(`/solo/${session.id}`)}
                        />
                      ))}
                    </TreeItem>
                  </>
                )}
              </TreeItem>
            );
          })
        ) : (
          <div className="px-4 py-2 text-xs text-muted-foreground">
            No projects
          </div>
        )}
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-border space-y-1">
        <Link
          href={currentProjectId ? `/project/${currentProjectId}/ideate` : "#"}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
            "hover:bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          <Plus className="h-4 w-4" />
          New Idea
        </Link>
        <Link
          href={currentProjectId ? `/project/${currentProjectId}/solo` : "#"}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Solo Chat
        </Link>
      </div>

      <FolderBrowserModal 
        open={folderBrowserOpen} 
        onOpenChange={setFolderBrowserOpen}
      />
    </div>
  );
}
