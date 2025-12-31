"use client"

import { AlertTriangle, RefreshCw, X } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getUserFriendlyMessage } from "@/lib/utils/error-handling"

/**
 * Error types for the planning mode feature.
 * Each type has specific title and suggestion mappings.
 */
export type PlanningErrorType = "worktree" | "deps" | "session" | "general"

export interface PlanningErrorProps {
  /** The type of error that occurred */
  type: PlanningErrorType
  /** The error object with details */
  error: Error
  /** Optional callback to retry the failed operation */
  onRetry?: () => void
  /** Optional callback to dismiss the error */
  onDismiss?: () => void
}

/**
 * Error information mapping for different error types.
 * Provides user-friendly titles and context-specific suggestions.
 */
interface ErrorInfo {
  title: string
  suggestion: string | null
  getSuggestion?: (error: Error) => string | null
}

const errorInfo: Record<PlanningErrorType, ErrorInfo> = {
  worktree: {
    title: "Failed to create worktree",
    suggestion: null,
    getSuggestion: (error: Error): string | null => {
      const message = error.message.toLowerCase()

      if (message.includes("already exists")) {
        return "A worktree for this issue already exists. Try cleaning up old worktrees with `git worktree prune`."
      }
      if (message.includes("branch") && message.includes("exists")) {
        return "The branch already exists. You may want to delete it first or use a different branch name."
      }
      if (message.includes("not a git repository")) {
        return "Make sure you're running this from within a git repository."
      }
      if (message.includes("uncommitted changes")) {
        return "Commit or stash your changes before creating a worktree."
      }
      if (message.includes("permission")) {
        return "Check that you have write permissions to the project directory."
      }
      if (message.includes("disk") || message.includes("space")) {
        return "Free up some disk space and try again."
      }
      // Default suggestion for worktree errors
      return "Check your git configuration and try again. You may need to clean up existing worktrees with `git worktree list` and `git worktree remove`."
    },
  },
  deps: {
    title: "Failed to install dependencies",
    suggestion: "Try running `bun install` manually in the worktree directory.",
  },
  session: {
    title: "Failed to connect to OpenCode",
    suggestion: "Make sure OpenCode is running: `opencode serve`",
  },
  general: {
    title: "Something went wrong",
    suggestion: null,
  },
}

/**
 * Gets the suggestion for an error based on its type and message content.
 */
function getSuggestion(type: PlanningErrorType, error: Error): string | null {
  const info = errorInfo[type]

  // Use dynamic suggestion getter if available
  if (info.getSuggestion) {
    return info.getSuggestion(error)
  }

  return info.suggestion
}

/**
 * PlanningError displays a user-friendly error message with contextual suggestions
 * for resolving common issues in planning mode.
 *
 * Features:
 * - Error-type specific titles and suggestions
 * - User-friendly error message translation
 * - Optional retry and dismiss callbacks
 * - Consistent visual design using Alert components
 *
 * @example
 * ```tsx
 * <PlanningError
 *   type="worktree"
 *   error={new Error("branch already exists")}
 *   onRetry={() => handleRetry()}
 *   onDismiss={() => setError(null)}
 * />
 * ```
 */
export function PlanningError({
  type,
  error,
  onRetry,
  onDismiss,
}: PlanningErrorProps) {
  const info = errorInfo[type]
  const suggestion = getSuggestion(type, error)
  const friendlyMessage = getUserFriendlyMessage(error)

  return (
    <Alert variant="destructive" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="pr-8">{info.title}</AlertTitle>
      <AlertDescription>
        <div className="space-y-3">
          {/* Error message */}
          <p className="text-sm">{friendlyMessage}</p>

          {/* Suggestion */}
          {suggestion && (
            <p className="text-sm text-muted-foreground">{suggestion}</p>
          )}

          {/* Action buttons */}
          {(onRetry || onDismiss) && (
            <div className="flex items-center gap-2 pt-1">
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="h-7 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="h-7 text-xs"
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </AlertDescription>

      {/* Close button in top-right corner */}
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="absolute top-2 right-2 h-6 w-6 rounded-md opacity-70 hover:opacity-100"
          aria-label="Dismiss error"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Alert>
  )
}
