"use client";

import { Home, ChevronRight, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  currentPath: string;
  displayPath: string;
  onNavigate: (path: string) => void;
  parent: string | null;
  canGoUp: boolean;
}

export function Breadcrumbs({
  currentPath,
  displayPath,
  onNavigate,
  parent,
  canGoUp,
}: BreadcrumbsProps) {
  // Parse display path into segments: ~/dev/project -> ["~", "dev", "project"]
  const segments = displayPath.split("/").filter(Boolean);

  // Build absolute paths for each segment
  const buildPathForSegment = (segmentIndex: number): string => {
    if (segmentIndex === 0 && segments[0] === "~") {
      // Home directory
      return currentPath.split("/").slice(0, 3).join("/"); // /Users/username
    }
    // Count segments from displayPath and map to currentPath
    const pathParts = currentPath.split("/");
    const homeParts = 3; // /Users/username = 3 parts
    const targetParts = homeParts + segmentIndex;
    return pathParts.slice(0, targetParts).join("/");
  };

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        disabled={!canGoUp}
        onClick={() => parent && onNavigate(parent)}
        aria-label="Go up one directory"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1 min-w-0">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const segmentPath = buildPathForSegment(index);

          return (
            <div key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              {isLast ? (
                <span className="text-sm font-medium px-1.5 py-0.5 truncate text-foreground">
                  {segment === "~" ? <Home className="h-4 w-4 inline" /> : segment}
                </span>
              ) : (
                <button
                  onClick={() => onNavigate(segmentPath)}
                  className={cn(
                    "text-sm px-1.5 py-0.5 rounded hover:bg-secondary text-muted-foreground",
                    "hover:text-foreground transition-colors"
                  )}
                >
                  {segment === "~" ? <Home className="h-4 w-4" /> : segment}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
