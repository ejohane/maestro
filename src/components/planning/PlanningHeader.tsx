"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="flex h-12 items-center gap-2 px-4">
        <SidebarTrigger className="lg:hidden" />

        {/* Breadcrumb navigation */}
        <nav className="flex items-center gap-1 text-sm min-w-0 flex-1 overflow-hidden">
          {/* Project name - can truncate on small screens */}
          <Link
            href={`/project/${projectId}`}
            className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[100px] sm:max-w-[150px] lg:max-w-none"
          >
            {projectName}
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

          {/* "Planning" segment - hidden on very small screens */}
          <span className="text-muted-foreground flex-shrink-0 hidden sm:inline">
            Planning
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:inline" />

          {/* Issue number and title - always visible */}
          <span className="font-medium truncate min-w-0">
            #{issueNumber}
            {issueTitle && (
              <span className="text-muted-foreground font-normal ml-1">
                {issueTitle}
              </span>
            )}
          </span>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
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
