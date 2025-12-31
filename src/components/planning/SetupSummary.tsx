"use client"

import { CheckCircle2, GitBranch, Folder, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface SetupSummaryProps {
  worktreePath: string
  branch?: string
  isCollapsed: boolean
  onToggle: () => void
}

/**
 * SetupSummary - Displays branch/worktree info after setup completes
 * 
 * Shows a collapsible summary of the planning environment that was created,
 * including the worktree path and branch name.
 */
export function SetupSummary({
  worktreePath,
  branch,
  isCollapsed,
  onToggle,
}: SetupSummaryProps) {
  // Extract display-friendly path (last 2-3 segments)
  const pathSegments = worktreePath.split("/")
  const displayPath = pathSegments.slice(-2).join("/")

  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "hover:bg-accent/50 transition-colors"
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span className="text-sm font-medium">Setup complete</span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!isCollapsed && (
        <div className="px-4 pb-3 pt-1 space-y-2">
          {branch && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3 flex-shrink-0" />
              <span className="truncate font-mono">{branch}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Folder className="h-3 w-3 flex-shrink-0" />
            <span className="truncate font-mono" title={worktreePath}>
              .../{displayPath}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
