"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface NewIssueDialogProps {
  projectId: string;
  projectPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewIssueDialog({
  projectId,
  projectPath,
  open,
  onOpenChange,
}: NewIssueDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: title.trim(),
          projectPath,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create issue");
      }

      const data = await response.json();
      
      // Close dialog and navigate to the issue view
      onOpenChange(false);
      setTitle("");
      router.push(`/project/${projectId}/issue/${data.number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setTitle("");
        setError(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Issue</DialogTitle>
            <DialogDescription>
              Create a new GitHub issue to start exploring an idea with the agent.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="issue-title" className="text-sm font-medium">
              Title
            </Label>
            <Input
              id="issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What would you like to explore?"
              className="mt-2"
              autoFocus
              disabled={isCreating}
            />
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Issue"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
