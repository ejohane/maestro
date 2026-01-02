"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";

interface PlanningHeaderProps {
  projectId: string;
  issueNumber: number;
  issueTitle: string;
  projectName: string;
}

export function PlanningHeader({
  projectId,
  issueNumber,
  issueTitle,
  projectName,
}: PlanningHeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEnding, setIsEnding] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const handleEndPlanning = async () => {
    setIsEnding(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/planning/${issueNumber}/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleanup: false }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to end planning:", error);
        return;
      }

      // Invalidate caches so UI updates immediately
      await queryClient.invalidateQueries({ queryKey: ["project-issues", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["planning-sessions", projectId] });

      // Navigate back to project overview
      router.push(`/project/${projectId}`);
    } catch (err) {
      console.error("Error ending planning:", err);
    } finally {
      setIsEnding(false);
      setShowDialog(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="flex h-12 items-center gap-2 px-4">
        <SidebarTrigger className="lg:hidden" />

        {/* Breadcrumb navigation */}
        <nav className="flex items-center gap-1 text-sm min-w-0 flex-1">
          <Link
            href={`/project/${projectId}`}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {projectName}
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground flex-shrink-0">Planning</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate">
            #{issueNumber}
            {issueTitle && (
              <span className="text-muted-foreground font-normal ml-1">
                {issueTitle.length > 40
                  ? `${issueTitle.slice(0, 40)}...`
                  : issueTitle}
              </span>
            )}
          </span>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* End Planning Button with Confirmation */}
          <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5"
                disabled={isEnding}
              >
                {isEnding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">End Planning</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End Planning Session</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the planning label from issue #{issueNumber} 
                  and move it back to the Issues column.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground">
                  The worktree branch and any uncommitted changes will be preserved.
                  You can clean these up manually or restart planning later.
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isEnding}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleEndPlanning}
                  disabled={isEnding}
                >
                  {isEnding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Ending...
                    </>
                  ) : (
                    "End Planning"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Link href={`/project/${projectId}/issue/${issueNumber}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Issue</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
