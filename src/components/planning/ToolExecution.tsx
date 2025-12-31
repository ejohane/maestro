"use client";

import { cn } from "@/lib/utils";
import { Terminal, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { ToolState } from "@/lib/hooks/useChatSession";

interface ToolExecutionProps {
  toolName: string;
  state: ToolState;
  className?: string;
}

function getStatusIcon(status: ToolState["status"]) {
  switch (status) {
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    default:
      return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getStatusLabel(status: ToolState["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export function ToolExecution({
  toolName,
  state,
  className,
}: ToolExecutionProps) {
  const displayTitle = state.title || toolName;
  
  // Format input args for display (if present)
  let argsDisplay: string | null = null;
  if (state.input) {
    // For common tools, show condensed info
    if (toolName === "bash" && state.input.command) {
      argsDisplay = String(state.input.command);
    } else if (toolName === "read" && state.input.filePath) {
      argsDisplay = `Reading: ${state.input.filePath}`;
    } else if (toolName === "glob" && state.input.pattern) {
      argsDisplay = `Pattern: ${state.input.pattern}`;
    } else if (toolName === "grep" && state.input.pattern) {
      argsDisplay = `Searching: ${state.input.pattern}`;
    } else if (toolName === "edit" && state.input.filePath) {
      argsDisplay = `Editing: ${state.input.filePath}`;
    } else if (toolName === "write" && state.input.filePath) {
      argsDisplay = `Writing: ${state.input.filePath}`;
    } else {
      // Fallback: show JSON preview, truncated
      const jsonStr = JSON.stringify(state.input);
      argsDisplay = jsonStr.length > 100 ? jsonStr.slice(0, 100) + "..." : jsonStr;
    }
  }

  return (
    <div
      className={cn(
        "bg-muted rounded-md p-2.5 text-sm border border-border",
        state.status === "error" && "border-destructive/50 bg-destructive/5",
        state.status === "running" && "border-primary/30",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="font-medium flex-1 truncate">{displayTitle}</span>
        <div className="flex items-center gap-1.5">
          {getStatusIcon(state.status)}
          <span
            className={cn(
              "text-xs",
              state.status === "running" && "text-primary",
              state.status === "completed" && "text-green-600",
              state.status === "error" && "text-destructive",
              (state.status === "pending") && "text-muted-foreground"
            )}
          >
            {getStatusLabel(state.status)}
          </span>
        </div>
      </div>

      {argsDisplay && (
        <div className="mt-1.5 text-xs text-muted-foreground font-mono truncate pl-6">
          {argsDisplay}
        </div>
      )}

      {state.error && (
        <div className="mt-2 text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 font-mono">
          {state.error}
        </div>
      )}

      {state.output && state.status === "completed" && (
        <div className="mt-2 text-xs text-muted-foreground bg-background/50 rounded px-2 py-1.5 font-mono max-h-24 overflow-y-auto">
          {state.output.length > 500
            ? state.output.slice(0, 500) + "..."
            : state.output}
        </div>
      )}
    </div>
  );
}
