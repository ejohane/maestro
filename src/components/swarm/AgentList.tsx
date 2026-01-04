"use client";

import { AgentCard } from "./AgentCard";
import type { SwarmAgentState } from "@/lib/types/api";

interface AgentListProps {
  agents: SwarmAgentState[];
  onApprovePermission: (sessionId: string, permissionId: string) => void;
  onDenyPermission: (sessionId: string, permissionId: string) => void;
}

export function AgentList({
  agents,
  onApprovePermission,
  onDenyPermission,
}: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No agents spawned yet.</p>
        <p className="text-sm">
          Agents will appear as the orchestrator delegates tasks.
        </p>
      </div>
    );
  }

  const sortedAgents = [...agents].sort((a, b) => {
    const priority: Record<string, number> = {
      blocked: 0,
      busy: 1,
      error: 2,
      idle: 3,
      completed: 4,
    };
    return (priority[a.status] ?? 5) - (priority[b.status] ?? 5);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Agents</h2>
        <span className="text-sm text-muted-foreground">
          {agents.filter((a) => a.status === "busy").length} running /{" "}
          {agents.length} total
        </span>
      </div>
      {sortedAgents.map((agent) => (
        <AgentCard
          key={agent.sessionId}
          agent={agent}
          onApprovePermission={(permissionId) =>
            onApprovePermission(agent.sessionId, permissionId)
          }
          onDenyPermission={(permissionId) =>
            onDenyPermission(agent.sessionId, permissionId)
          }
        />
      ))}
    </div>
  );
}
