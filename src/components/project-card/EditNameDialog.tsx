"use client";

import { useState, useEffect } from "react";
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
import { useUpdateProject } from "@/lib/hooks/useProjects";
import type { Project } from "@/lib/types/api";

interface EditNameDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditNameDialog({
  project,
  open,
  onOpenChange,
}: EditNameDialogProps) {
  const [name, setName] = useState("");
  const updateProject = useUpdateProject();

  useEffect(() => {
    if (project && open) {
      setName(project.name || "");
    }
  }, [project, open]);

  const handleSave = async () => {
    if (!project) return;
    await updateProject.mutateAsync({
      id: project.id,
      name: name.trim() || null, // null reverts to derived name
    });
    onOpenChange(false);
  };

  const derivedName = project?.path.split("/").pop() || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Project Name</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={derivedName}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use folder name ({derivedName})
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateProject.isPending}>
            {updateProject.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
