"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ActiveSwarm } from "@/lib/types/api";

interface UseActiveSwarmsReturn {
  swarms: ActiveSwarm[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches and provides access to all active swarms for a project.
 * Polls every 10 seconds for fresh data.
 */
export function useActiveSwarms(projectId: string): UseActiveSwarmsReturn {
  const queryClient = useQueryClient();

  const {
    data: swarms = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["active-swarms", projectId],
    queryFn: async (): Promise<ActiveSwarm[]> => {
      const response = await fetch(`/api/projects/${projectId}/swarms`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch active swarms");
      }
      const data = await response.json();
      return data.swarms || [];
    },
    enabled: !!projectId,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["active-swarms", projectId] });
    };
  }, [projectId, queryClient]);

  return {
    swarms,
    isLoading,
    error: error as Error | null,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Helper hook to get a specific swarm by issue number.
 */
export function useActiveSwarm(
  projectId: string,
  issueNumber: number
): ActiveSwarm | undefined {
  const { swarms } = useActiveSwarms(projectId);
  return swarms.find((s) => s.issueNumber === issueNumber);
}
