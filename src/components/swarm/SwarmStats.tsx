"use client";

import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Bot,
  AlertTriangle,
} from "lucide-react";
import type { SwarmProgress } from "@/lib/types/api";

interface SwarmStatsProps {
  progress: SwarmProgress;
  agentCount: number;
  runningAgentCount: number;
  blockedAgentCount: number;
}

export function SwarmStats({
  progress,
  agentCount,
  runningAgentCount,
  blockedAgentCount,
}: SwarmStatsProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">{progress.percentage}%</span>
        </div>
        <Progress value={progress.percentage} className="h-2" />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between gap-4 text-sm">
        {/* Task stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>{progress.completed} completed</span>
          </div>
          <div className="flex items-center gap-1">
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            <span>{progress.inProgress} in progress</span>
          </div>
          <div className="flex items-center gap-1">
            <Circle className="h-4 w-4 text-muted-foreground" />
            <span>{progress.pending} pending</span>
          </div>
        </div>

        {/* Agent stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span>
              {runningAgentCount}/{agentCount} agents
            </span>
          </div>
          {blockedAgentCount > 0 && (
            <div className="flex items-center gap-1 text-orange-500">
              <AlertTriangle className="h-4 w-4" />
              <span>{blockedAgentCount} blocked</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
