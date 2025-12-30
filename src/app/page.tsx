"use client";

import { useState } from "react";
import { useProjects, useDeleteProject } from "@/lib/hooks/useProjects";
import { FolderBrowserModal } from "@/components/folder-browser";
import { ProjectCard, EditNameDialog } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import {
  Folder,
  Zap,
  Command,
  Search,
  Plus,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { Project } from "@/lib/types/api";

function ProjectCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="w-8 h-8 rounded-md bg-secondary" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-secondary rounded" />
        <div className="h-3 w-48 bg-secondary rounded" />
      </div>
    </div>
  );
}

function ProjectListSkeleton() {
  return (
    <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
      {[...Array(3)].map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}

function ProjectListError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="border border-border rounded-md p-8 text-center">
      <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-4" />
      <h3 className="font-medium mb-1">Failed to load projects</h3>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
    </div>
  );
}

function NoProjectsEmptyState({ onAddProject }: { onAddProject: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6">
        <Folder className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Add a project folder to get started.
      </p>
      <Button onClick={onAddProject}>
        <Plus className="h-4 w-4 mr-2" />
        Add Project
      </Button>
    </div>
  );
}

function getRelocateInitialPath(project: Project | null): string | undefined {
  if (!project) return undefined;
  // Try parent of old path - the API will fall back to ~/dev or ~ if it doesn't exist
  const parts = project.path.split("/");
  parts.pop();
  return parts.join("/") || undefined;
}

export default function ProjectListPage() {
  const { data: projects, isLoading, error, refetch } = useProjects();
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [relocatingProject, setRelocatingProject] = useState<Project | null>(null);
  const deleteProject = useDeleteProject();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-sm">Maestro</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:bg-secondary flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-secondary px-1.5 font-mono text-[10px] text-muted-foreground">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>
            <Button size="sm" onClick={() => setFolderBrowserOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Add</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-lg font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Select a project to view swarms and sessions
          </p>
        </div>

        {/* Loading State */}
        {isLoading && <ProjectListSkeleton />}

        {/* Error State */}
        {error && !projects && (
          <ProjectListError message={error.message} onRetry={() => refetch()} />
        )}

        {/* Empty State */}
        {!isLoading && !error && projects?.length === 0 && (
          <NoProjectsEmptyState onAddProject={() => setFolderBrowserOpen(true)} />
        )}

        {/* Project List */}
        {projects && projects.length > 0 && (
          <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setEditingProject(project)}
                onRemove={() => deleteProject.mutate(project.id)}
                onRelocate={
                  project.status === "missing"
                    ? () => setRelocatingProject(project)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </main>

      {/* Edit Name Dialog */}
      <EditNameDialog
        project={editingProject}
        open={!!editingProject}
        onOpenChange={(open) => !open && setEditingProject(null)}
      />

      {/* Add Project Modal */}
      <FolderBrowserModal
        open={folderBrowserOpen}
        onOpenChange={setFolderBrowserOpen}
      />

      {/* Relocate Project Modal */}
      <FolderBrowserModal
        open={!!relocatingProject}
        onOpenChange={(open) => !open && setRelocatingProject(null)}
        mode="relocate"
        projectToRelocate={relocatingProject ?? undefined}
        initialPath={getRelocateInitialPath(relocatingProject)}
      />
    </div>
  );
}
