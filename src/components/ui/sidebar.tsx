"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useProjects, useProjectIssues } from "@/lib/hooks/useProjects";
import { FolderBrowserModal } from "@/components/folder-browser";
import type { Project } from "@/lib/types/api";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Zap,
  CircleDot,
  FolderOpen,
  Plus,
  Search,
  Command,
  MessageSquare,
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
  onClick?: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
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
  onClick,
  isOpen: controlledIsOpen,
  onToggle,
}: TreeItemProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const hasChildren = !!children;
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      handleToggle();
    }
  };

  const handleContentClick = () => {
    if (onClick) {
      onClick();
    } else if (hasChildren) {
      handleToggle();
    }
  };

  const content = (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
        active
          ? "bg-primary/15 text-primary border border-primary/30 font-medium"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
      onClick={handleContentClick}
    >
      {hasChildren ? (
        <span 
          className="w-4 h-4 flex items-center justify-center hover:bg-secondary rounded"
          onClick={handleChevronClick}
        >
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
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />
      )}
      {statusIndicator === "info" && (
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--info))]" />
      )}
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </div>
  );

  return (
    <div>
      {href && !hasChildren ? <Link href={href}>{content}</Link> : content}
      {hasChildren && isOpen && <div className="ml-4">{children}</div>}
    </div>
  );
}

// Component to fetch and display issues for a project
function ProjectIssuesSection({ project, pathname }: { project: Project; pathname: string }) {
  const { data: issues = [], isLoading } = useProjectIssues(project.id);
  
  // Filter to only open issues
  const openIssues = issues.filter((issue) => issue.state === "OPEN" || issue.state === "open");
  
  if (isLoading) {
    return (
      <TreeItem
        icon={<CircleDot className="h-3.5 w-3.5 text-[hsl(var(--success))]" />}
        label="Open Issues"
        count={0}
      >
        <div className="px-4 py-1 text-xs text-muted-foreground">Loading...</div>
      </TreeItem>
    );
  }
  
  if (openIssues.length === 0) {
    return null;
  }
  
  return (
    <TreeItem
      icon={<CircleDot className="h-3.5 w-3.5 text-[hsl(var(--success))]" />}
      label="Open Issues"
      count={openIssues.length}
      defaultOpen={true}
    >
      {openIssues.map((issue) => (
        <TreeItem
          key={issue.number}
          icon={<CircleDot className="h-2.5 w-2.5 text-[hsl(var(--success))]" />}
          label={issue.title}
          href={`/project/${project.id}/issue/${issue.number}`}
          active={pathname.includes(`/issue/${issue.number}`)}
        />
      ))}
    </TreeItem>
  );
}

export function Sidebar() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentProjectId = params.id as string;
  const { data: projects, isLoading } = useProjects();
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  // Track which projects are expanded - initialize with current project expanded
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    return currentProjectId ? new Set([currentProjectId]) : new Set();
  });

  const handleProjectClick = (projectId: string, isMissing: boolean) => {
    if (isMissing) return;
    router.push(`/project/${projectId}`);
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

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
            const isExpanded = expandedProjects.has(project.id);

            return (
              <TreeItem
                key={project.id}
                icon={
                  isExpanded ? (
                    <FolderOpen className={cn("h-4 w-4", isCurrentProject ? "text-primary" : "text-muted-foreground")} />
                  ) : (
                    <Folder className={cn("h-4 w-4", isMissing && "text-yellow-600")} />
                  )
                }
                label={project.displayName}
                active={isCurrentProject}
                isOpen={isExpanded}
                onToggle={() => toggleProjectExpanded(project.id)}
                statusIndicator={isMissing ? "warning" : undefined}
                onClick={() => handleProjectClick(project.id, isMissing)}
              >
                <ProjectIssuesSection project={project} pathname={pathname} />
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
