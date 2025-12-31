"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useProjects, useProjectIssues } from "@/lib/hooks/useProjects";
import { FolderBrowserModal } from "@/components/folder-browser";
import type { Project } from "@/lib/types/api";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Component to fetch and display issues for a project
function ProjectIssuesSection({ 
  project, 
  pathname,
  onNavigate,
}: { 
  project: Project; 
  pathname: string;
  onNavigate: () => void;
}) {
  const { data: issues = [], isLoading } = useProjectIssues(project.id);
  const [isOpen, setIsOpen] = useState(true);
  
  // Filter to only open issues
  const openIssues = issues.filter((issue) => issue.state === "OPEN" || issue.state === "open");
  
  if (isLoading) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton size="sm" className="text-muted-foreground">
          <CircleDot className="h-3 w-3 text-[hsl(var(--success))]" />
          <span>Loading issues...</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }
  
  if (openIssues.length === 0) {
    return null;
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton size="sm" className="w-full justify-between pr-2">
            <span className="flex items-center gap-2">
              <CircleDot className="h-3 w-3 text-[hsl(var(--success))]" />
              <span>Open Issues</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{openIssues.length}</span>
              {isOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {openIssues.map((issue) => {
              const isActive = pathname.includes(`/issue/${issue.number}`);
              return (
                <SidebarMenuSubItem key={issue.number}>
                  <SidebarMenuSubButton
                    asChild
                    size="sm"
                    isActive={isActive}
                  >
                    <Link 
                      href={`/project/${project.id}/issue/${issue.number}`}
                      onClick={onNavigate}
                    >
                      <CircleDot className="h-2.5 w-2.5 text-[hsl(var(--success))]" />
                      <span className="truncate">{issue.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

// Individual project item with collapsible issues
function ProjectItem({ 
  project, 
  isCurrentProject, 
  pathname,
  onNavigate,
}: { 
  project: Project;
  isCurrentProject: boolean;
  pathname: string;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(isCurrentProject);
  const isMissing = project.status === "missing";

  const handleProjectClick = () => {
    if (isMissing) return;
    onNavigate();
    router.push(`/project/${project.id}`);
  };

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isCurrentProject}
            onClick={handleProjectClick}
            className={cn(isMissing && "opacity-60")}
          >
            {isOpen ? (
              <FolderOpen className={cn("h-4 w-4", isCurrentProject ? "text-primary" : "text-muted-foreground")} />
            ) : (
              <Folder className={cn("h-4 w-4", isMissing && "text-yellow-600")} />
            )}
            <span className="truncate">{project.displayName}</span>
            {isMissing && (
              <span className="ml-auto h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />
            )}
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <ProjectIssuesSection 
              project={project} 
              pathname={pathname}
              onNavigate={onNavigate}
            />
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const params = useParams();
  const pathname = usePathname();
  const currentProjectId = params.id as string;
  const { data: projects, isLoading } = useProjects();
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  const { setOpenMobile, isMobile } = useSidebar();

  // Handler to close mobile sidebar on navigation
  const handleNavigate = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-2 px-1 py-1">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-sm">Maestro</span>
        </div>
      </SidebarHeader>

      {/* Search Button */}
      <SidebarGroup className="py-2">
        <button className="w-full h-8 px-3 rounded-md text-xs text-muted-foreground bg-secondary/50 hover:bg-secondary flex items-center gap-2 transition-colors">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px]">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </SidebarGroup>

      {/* Main Content */}
      <SidebarContent>
        {/* Projects Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-wider">
            Projects
          </SidebarGroupLabel>
          <SidebarGroupAction
            onClick={() => setFolderBrowserOpen(true)}
            title="Add project"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add project</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                </>
              ) : projects?.length ? (
                projects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    isCurrentProject={project.id === currentProjectId}
                    pathname={pathname}
                    onNavigate={handleNavigate}
                  />
                ))
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled className="text-muted-foreground">
                    <Folder className="h-4 w-4" />
                    <span>No projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Actions */}
      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="New Idea"
            >
              <Link 
                href={currentProjectId ? `/project/${currentProjectId}/ideate` : "#"}
                onClick={handleNavigate}
              >
                <Lightbulb className="h-4 w-4" />
                <span>New Idea</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Solo Chat"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Link 
                href={currentProjectId ? `/project/${currentProjectId}/solo` : "#"}
                onClick={handleNavigate}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Solo Chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <FolderBrowserModal 
        open={folderBrowserOpen} 
        onOpenChange={setFolderBrowserOpen}
      />
    </Sidebar>
  );
}
