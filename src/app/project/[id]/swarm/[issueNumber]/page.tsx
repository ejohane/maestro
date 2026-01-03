"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useSwarmWatch } from "@/lib/hooks/useSwarmWatch";
import { useBeadsWatch } from "@/lib/hooks/useBeadsWatch";
import { SwarmHeader, SwarmStats, AgentList, TaskList } from "@/components/swarm";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function SwarmPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const issueNumber = parseInt(params.issueNumber as string, 10);

  const [isStopping, setIsStopping] = useState(false);

  // Get real-time beads data
  const { beads } = useBeadsWatch(projectId, issueNumber);

  const {
    orchestrator,
    agents,
    permissions: _permissions,
    progress: swarmProgress,
    isConnected,
    isReconnecting,
    error,
    respondToPermission,
  } = useSwarmWatch(projectId, issueNumber, {
    onComplete: () => {
      console.log("Swarm completed");
    },
    onError: (err) => {
      console.error("Swarm error:", err);
    },
  });

  const handleStopSwarm = async () => {
    setIsStopping(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/swarm/${issueNumber}/stop`,
        { method: "POST" }
      );
      const data = await response.json();
      
      if (data.success) {
        router.push(`/project/${projectId}/planning/${issueNumber}`);
      } else {
        console.error("Failed to stop swarm:", data.error);
      }
    } catch (err) {
      console.error("Error stopping swarm:", err);
    } finally {
      setIsStopping(false);
    }
  };

  const handleApprovePermission = async (sessionId: string, permissionId: string) => {
    await respondToPermission(sessionId, permissionId, "once");
  };

  const handleDenyPermission = async (sessionId: string, permissionId: string) => {
    await respondToPermission(sessionId, permissionId, "reject");
  };

  const runningAgentCount = agents.filter((a) => a.status === "busy").length;
  const blockedAgentCount = agents.filter((a) => a.status === "blocked").length;

  // Calculate progress from beads (more reliable than SSE progress)
  const tasks = beads.filter((b) => b.type === "task");
  const beadsProgress = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "closed").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    pending: tasks.filter((t) => t.status === "open").length,
    percentage: tasks.length > 0
      ? Math.round((tasks.filter((t) => t.status === "closed").length / tasks.length) * 100)
      : 0,
  };
  
  // Use beads-calculated progress if SSE progress is empty/default
  const progress = swarmProgress.total > 0 ? swarmProgress : beadsProgress;

  // Loading state
  if (!isConnected && !error && agents.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Unable to load swarm</h2>
        <p className="text-muted-foreground text-center max-w-md">{error.message}</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button onClick={() => router.push(`/project/${projectId}/planning/${issueNumber}`)}>
            Back to Planning
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SwarmHeader
        projectId={projectId}
        issueNumber={issueNumber}
        epicId={orchestrator?.epicId || ""}
        orchestratorStatus={orchestrator?.status || "idle"}
        isConnected={isConnected}
        onStopSwarm={handleStopSwarm}
        isStopping={isStopping}
      />

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <SwarmStats
          progress={progress}
          agentCount={agents.length}
          runningAgentCount={runningAgentCount}
          blockedAgentCount={blockedAgentCount}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AgentList
            agents={agents}
            onApprovePermission={handleApprovePermission}
            onDenyPermission={handleDenyPermission}
          />
          <TaskList beads={beads} />
        </div>
      </div>

      {isReconnecting && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 dark:bg-yellow-900 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Reconnecting...</span>
        </div>
      )}
    </div>
  );
}
