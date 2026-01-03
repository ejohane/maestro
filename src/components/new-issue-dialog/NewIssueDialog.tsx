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
import { Textarea } from "@/components/ui/textarea";
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
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: prompt.trim(),
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
      setPrompt("");
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
        setPrompt("");
        setError(null);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for Cmd+Enter (macOS) or Ctrl+Enter (Windows/Linux)
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      // Prevent default to avoid newline insertion
      e.preventDefault();

      // Guard: Do nothing if form would be invalid
      if (!prompt.trim() || isCreating) return;

      // Submit the form using the native form submission
      // This ensures the form onSubmit handler is called
      e.currentTarget.form?.requestSubmit();
    }
    // Note: Plain Enter behavior is preserved automatically
    // (we only handle the case when metaKey/ctrlKey is pressed)
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Issue</DialogTitle>
            <DialogDescription>
              Describe what you want to build or explore. The agent will create a GitHub
              issue and elaborate your request with relevant technical context.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="issue-prompt" className="text-sm font-medium">
              Prompt
            </Label>
            <Textarea
              id="issue-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build or explore..."
              className="mt-2 min-h-[100px] resize-none"
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
            <Button type="submit" disabled={!prompt.trim() || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>Create Issue</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
