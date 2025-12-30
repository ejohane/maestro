"use client";

import { Folder, GitBranch } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Directory } from "@/lib/types/api";

interface DirectoryListProps {
  directories: Directory[];
  onNavigate: (path: string) => void;
  isLoading?: boolean;
}

function DirectoryItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-5 h-5 rounded bg-secondary" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-secondary rounded" />
      </div>
    </div>
  );
}

export function DirectoryList({
  directories,
  onNavigate,
  isLoading,
}: DirectoryListProps) {
  if (isLoading) {
    return (
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {[...Array(5)].map((_, i) => (
            <DirectoryItemSkeleton key={i} />
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (directories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">No subdirectories</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y">
        {directories.map((dir) => (
          <button
            key={dir.path}
            onClick={() => onNavigate(dir.path)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onNavigate(dir.path);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-left",
              "hover:bg-secondary/50 transition-colors",
              "focus:outline-none focus:bg-secondary/50",
              "min-h-[44px]" // Touch-friendly
            )}
          >
            <Folder className="h-5 w-5 text-foreground/70 shrink-0" />
            <span className="flex-1 text-sm truncate text-foreground">{dir.name}</span>
            {dir.isGitRepo && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-secondary shrink-0">
                <GitBranch className="h-3 w-3" />
                git
              </span>
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
