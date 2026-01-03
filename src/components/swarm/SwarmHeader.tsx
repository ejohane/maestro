"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Square, Zap, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StopSwarmDialog } from "./StopSwarmDialog";
import { useState } from "react";
import type { AgentStatus } from "@/lib/types/api";

interface SwarmHeaderProps {
  projectId: string;
  issueNumber: number;
  issueTitle?: string;
  epicId: string;
  orchestratorStatus: AgentStatus;
  isConnected: boolean;
  onStopSwarm: () => void;
  isStopping?: boolean;
}

export function SwarmHeader({
  projectId,
  issueNumber,
  issueTitle,
  epicId,
  orchestratorStatus,
  isConnected,
  onStopSwarm,
  isStopping = false,
}: SwarmHeaderProps) {
  const router = useRouter();
  const [showStopDialog, setShowStopDialog] = useState(false);

  const handleBackClick = () => {
    router.push(`/project/${projectId}/planning/${issueNumber}`);
  };

  const handleStopConfirm = () => {
    setShowStopDialog(false);
    onStopSwarm();
  };

  const getStatusColor = () => {
    if (!isConnected) return "text-yellow-500";
    switch (orchestratorStatus) {
      case "busy": return "text-green-500";
      case "idle": return "text-blue-500";
      case "blocked": return "text-orange-500";
      case "error": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusText = () => {
    if (!isConnected) return "Reconnecting...";
    switch (orchestratorStatus) {
      case "busy": return "Running";
      case "idle": return "Idle";
      case "blocked": return "Waiting for input";
      case "error": return "Error";
      case "completed": return "Completed";
      default: return "Unknown";
    }
  };

  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3 bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBackClick} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to planning</span>
          </Button>

          <div className="flex items-center gap-2">
            <Zap className={`h-5 w-5 ${getStatusColor()}`} />
            <div>
              <h1 className="text-lg font-semibold">
                Swarm: #{issueNumber}
                {issueTitle && (
                  <span className="ml-2 text-muted-foreground font-normal">{issueTitle}</span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground">Epic: {epicId}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-yellow-500 animate-pulse" />
            )}
            <span className={isConnected ? "text-muted-foreground" : "text-yellow-500"}>
              {isConnected ? "Connected" : "Reconnecting..."}
            </span>
          </div>

          <Badge variant={orchestratorStatus === "error" ? "destructive" : "secondary"} className="flex items-center gap-1">
            {orchestratorStatus === "busy" && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
            {orchestratorStatus === "error" && <AlertTriangle className="h-3 w-3" />}
            {getStatusText()}
          </Badge>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowStopDialog(true)}
            disabled={isStopping || orchestratorStatus === "completed"}
          >
            <Square className="h-4 w-4 mr-2" />
            {isStopping ? "Stopping..." : "Stop Swarm"}
          </Button>
        </div>
      </header>

      <StopSwarmDialog
        open={showStopDialog}
        onOpenChange={setShowStopDialog}
        onConfirm={handleStopConfirm}
        issueNumber={issueNumber}
      />
    </>
  );
}
