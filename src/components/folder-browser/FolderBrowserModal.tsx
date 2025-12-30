"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Breadcrumbs } from "./Breadcrumbs";
import { DirectoryList } from "./DirectoryList";
import { useFilesystem } from "@/lib/hooks/useFilesystem";
import { useAddProject, useUpdateProject } from "@/lib/hooks/useProjects";
import type { Project } from "@/lib/types/api";

interface FolderBrowserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "add" | "relocate";
  initialPath?: string;
  projectToRelocate?: Project;
  onSuccess?: () => void;
}

export function FolderBrowserModal({
  open,
  onOpenChange,
  mode = "add",
  initialPath,
  projectToRelocate,
  onSuccess,
}: FolderBrowserModalProps) {
  const [currentPath, setCurrentPath] = useState<string | undefined>(initialPath);
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: filesystem, isLoading, error: fetchError, refetch } = useFilesystem(currentPath);
  const addProject = useAddProject();
  const updateProject = useUpdateProject();

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentPath(initialPath);
      setCustomName("");
      setError(null);
    }
  }, [open, initialPath]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!filesystem?.currentPath) return;

    setError(null);
    try {
      if (mode === "relocate" && projectToRelocate) {
        await updateProject.mutateAsync({
          id: projectToRelocate.id,
          path: filesystem.currentPath,
        });
      } else {
        await addProject.mutateAsync({
          path: filesystem.currentPath,
          name: customName.trim() || undefined,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const isPending = addProject.isPending || updateProject.isPending;
  const folderName = filesystem?.currentPath.split("/").pop() || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-none h-full sm:max-w-lg sm:h-auto sm:max-h-[80vh] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle>
            {mode === "relocate" ? "Relocate Project" : "Select Project Folder"}
          </DialogTitle>
        </DialogHeader>

        {/* Relocate mode: show old path warning */}
        {mode === "relocate" && projectToRelocate && (
          <div className="px-4 py-3 bg-yellow-500/10 border-b shrink-0">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span>Current path (missing):</span>
            </div>
            <p className="text-sm font-mono mt-1 text-muted-foreground">{projectToRelocate.displayPath}</p>
          </div>
        )}

        {/* Breadcrumbs */}
        {filesystem && (
          <Breadcrumbs
            currentPath={filesystem.currentPath}
            displayPath={filesystem.displayPath}
            onNavigate={handleNavigate}
            parent={filesystem.parent}
            canGoUp={filesystem.canGoUp}
          />
        )}

        {/* Directory list */}
        <div className="flex-1 min-h-0">
          {fetchError ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between">
                  <span>{fetchError.message}</span>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <DirectoryList
              directories={filesystem?.directories || []}
              onNavigate={handleNavigate}
              isLoading={isLoading && !filesystem}
            />
          )}
        </div>

        {/* Name input (add mode only) */}
        {mode === "add" && (
          <div className="px-4 py-3 border-t shrink-0">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name (optional)</Label>
              <Input
                id="project-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={folderName}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="px-4 pb-3 shrink-0">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter className="px-4 py-3 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!filesystem?.currentPath || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "relocate" ? "Update Location" : "Add Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
