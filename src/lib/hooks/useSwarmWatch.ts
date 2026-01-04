// useSwarmWatch - React hook for real-time swarm data via SSE
//
// This hook connects to the swarm watch SSE endpoint and provides
// unified real-time access to all swarm data including orchestrator state,
// agent states, permissions, and progress.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SwarmOrchestratorState,
  SwarmAgentState,
  PendingPermission,
  SwarmProgress,
  PermissionResponse,
} from "@/lib/types/api";

// Constants
const INITIAL_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_MULTIPLIER = 1.5;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface UseSwarmWatchOptions {
  /** Whether to automatically connect on mount (default: true) */
  autoConnect?: boolean;
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when connection is lost */
  onDisconnect?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when swarm completes */
  onComplete?: () => void;
}

export interface UseSwarmWatchReturn {
  /** Current orchestrator state */
  orchestrator: SwarmOrchestratorState | null;
  /** List of agent states */
  agents: SwarmAgentState[];
  /** Pending permission requests */
  permissions: PendingPermission[];
  /** Current progress statistics */
  progress: SwarmProgress;
  /** Whether connected to the SSE stream */
  isConnected: boolean;
  /** Whether currently attempting to reconnect */
  isReconnecting: boolean;
  /** Current error, if any */
  error: Error | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Manually connect to the SSE stream */
  connect: () => void;
  /** Manually disconnect from the SSE stream */
  disconnect: () => void;
  /** Respond to a permission request */
  respondToPermission: (
    sessionId: string,
    permissionId: string,
    response: PermissionResponse
  ) => Promise<boolean>;
}

const DEFAULT_PROGRESS: SwarmProgress = {
  total: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  percentage: 0,
};

/**
 * Hook for watching swarm data in real-time via Server-Sent Events
 *
 * @param projectId - The project ID
 * @param issueNumber - The issue number
 * @param options - Configuration options
 * @returns Swarm state and control functions
 *
 * @example
 * ```tsx
 * function SwarmView({ projectId, issueNumber }) {
 *   const {
 *     orchestrator,
 *     agents,
 *     permissions,
 *     progress,
 *     isConnected,
 *     respondToPermission,
 *   } = useSwarmWatch(projectId, issueNumber);
 *
 *   if (!isConnected) {
 *     return <Banner>Connecting to swarm...</Banner>;
 *   }
 *
 *   return (
 *     <div>
 *       <SwarmStats progress={progress} />
 *       <AgentList agents={agents} />
 *       {permissions.map(p => (
 *         <PermissionRequest
 *           key={p.id}
 *           permission={p}
 *           onRespond={(response) => respondToPermission(p.sessionId, p.id, response)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSwarmWatch(
  projectId: string,
  issueNumber: number,
  options: UseSwarmWatchOptions = {}
): UseSwarmWatchReturn {
  const {
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
    onComplete,
  } = options;

  // State
  const [orchestrator, setOrchestrator] =
    useState<SwarmOrchestratorState | null>(null);
  const [agents, setAgents] = useState<SwarmAgentState[]>([]);
  const [permissions, setPermissions] = useState<PendingPermission[]>([]);
  const [progress, setProgress] = useState<SwarmProgress>(DEFAULT_PROGRESS);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs for cleanup and callbacks
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);
  const mountedRef = useRef(true);

  // Store callbacks in refs to avoid stale closures
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);
  const onCompleteRef = useRef(onComplete);

  // Ref to store connect function for self-reference
  const connectRef = useRef<() => void>(() => {});

  // Update callback refs
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
    onCompleteRef.current = onComplete;
  }, [onConnect, onDisconnect, onError, onComplete]);

  /**
   * Clean up any pending reconnect timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Close the EventSource connection
   */
  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  /**
   * Disconnect from the SSE stream
   */
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearReconnectTimeout();
    closeEventSource();
    setIsConnected(false);
    setIsReconnecting(false);
  }, [clearReconnectTimeout, closeEventSource]);

  /**
   * Connect to the SSE stream
   */
  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up existing connection
    closeEventSource();
    clearReconnectTimeout();

    shouldReconnectRef.current = true;
    setError(null);

    const url = `/api/projects/${projectId}/swarm/${issueNumber}/watch`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Handle named events
    eventSource.addEventListener("connected", () => {
      if (!mountedRef.current) return;

      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);
      setError(null);
      onConnectRef.current?.();
    });

    eventSource.addEventListener("agent.created", (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as SwarmAgentState;
        setAgents((prev) => {
          // Avoid duplicates
          if (prev.some((a) => a.sessionId === data.sessionId)) return prev;
          return [...prev, data];
        });
      } catch (parseError) {
        console.error("[useSwarmWatch] Failed to parse agent.created:", parseError);
      }
    });

    eventSource.addEventListener("agent.status", (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as {
          sessionId: string;
          status: SwarmAgentState["status"];
        };
        setAgents((prev) =>
          prev.map((a) =>
            a.sessionId === data.sessionId ? { ...a, status: data.status } : a
          )
        );
      } catch (parseError) {
        console.error("[useSwarmWatch] Failed to parse agent.status:", parseError);
      }
    });

    eventSource.addEventListener("agent.activity", (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as {
          sessionId: string;
          activity: string;
        };
        setAgents((prev) =>
          prev.map((a) =>
            a.sessionId === data.sessionId
              ? {
                  ...a,
                  lastActivity: data.activity,
                  lastActivityAt: new Date().toISOString(),
                }
              : a
          )
        );
      } catch (parseError) {
        console.error("[useSwarmWatch] Failed to parse agent.activity:", parseError);
      }
    });

    eventSource.addEventListener("permission.requested", (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as PendingPermission;
        // Add to permissions list (avoid duplicates)
        setPermissions((prev) => {
          if (prev.some((p) => p.id === data.id)) return prev;
          return [...prev, data];
        });
        // Update agent status to blocked
        setAgents((prev) =>
          prev.map((a) =>
            a.sessionId === data.sessionId
              ? { ...a, status: "blocked" as const, pendingPermission: data }
              : a
          )
        );
      } catch (parseError) {
        console.error("[useSwarmWatch] Failed to parse permission.requested:", parseError);
      }
    });

    eventSource.addEventListener("permission.resolved", (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as {
          sessionId: string;
          permissionId: string;
        };
        // Remove from permissions list
        setPermissions((prev) => prev.filter((p) => p.id !== data.permissionId));
        // Update agent status back to busy
        setAgents((prev) =>
          prev.map((a) =>
            a.sessionId === data.sessionId
              ? { ...a, status: "busy" as const, pendingPermission: undefined }
              : a
          )
        );
      } catch (parseError) {
        console.error("[useSwarmWatch] Failed to parse permission.resolved:", parseError);
      }
    });

    eventSource.addEventListener("progress.updated", (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as SwarmProgress;
        setProgress(data);
      } catch (parseError) {
        console.error("[useSwarmWatch] Failed to parse progress.updated:", parseError);
      }
    });

    eventSource.addEventListener("orchestrator.status", (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as SwarmOrchestratorState;
        setOrchestrator(data);
      } catch (parseError) {
        console.error("[useSwarmWatch] Failed to parse orchestrator.status:", parseError);
      }
    });

    eventSource.addEventListener("swarm.completed", () => {
      if (!mountedRef.current) return;
      onCompleteRef.current?.();
    });

    eventSource.addEventListener("swarm.error", (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as { error: string };
        const err = new Error(data.error);
        setError(err);
        onErrorRef.current?.(err);
      } catch (parseError) {
        console.error("[useSwarmWatch] Failed to parse swarm.error:", parseError);
      }
    });

    // Handle connection errors with exponential backoff reconnection
    eventSource.onerror = () => {
      if (!mountedRef.current) return;

      setIsConnected((wasConnected) => {
        if (wasConnected) {
          onDisconnectRef.current?.();
        }
        return false;
      });

      // Close the errored connection
      eventSource.close();
      eventSourceRef.current = null;

      // Attempt reconnection if we should
      if (shouldReconnectRef.current && mountedRef.current) {
        setReconnectAttempts((prev) => {
          const attempts = prev + 1;

          if (attempts <= MAX_RECONNECT_ATTEMPTS) {
            setIsReconnecting(true);

            // Calculate delay with exponential backoff
            const delay = Math.min(
              INITIAL_RECONNECT_DELAY * Math.pow(RECONNECT_MULTIPLIER, prev),
              MAX_RECONNECT_DELAY
            );

            console.log(
              `[useSwarmWatch] Reconnecting in ${delay}ms (attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS})`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && shouldReconnectRef.current) {
                // Use the ref to call connect to avoid closure issues
                connectRef.current();
              }
            }, delay);
          } else {
            setIsReconnecting(false);
            const err = new Error(
              `Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts`
            );
            setError(err);
            onErrorRef.current?.(err);
          }

          return attempts;
        });
      }
    };
  }, [projectId, issueNumber, closeEventSource, clearReconnectTimeout]);

  // Update connect ref whenever connect function changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  /**
   * Respond to a permission request
   */
  const respondToPermission = useCallback(
    async (
      sessionId: string,
      permissionId: string,
      response: PermissionResponse
    ): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/swarm/${issueNumber}/permission`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, permissionId, response }),
          }
        );
        const data = await res.json();
        return data.success === true;
      } catch (err) {
        console.error("[useSwarmWatch] Failed to respond to permission:", err);
        return false;
      }
    },
    [projectId, issueNumber]
  );

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      clearReconnectTimeout();
      closeEventSource();
    };
  }, [autoConnect, connect, clearReconnectTimeout, closeEventSource]);

  // Reconnect when projectId or issueNumber changes
  useEffect(() => {
    if (autoConnect && mountedRef.current) {
      // Reset state and reconnect
      setOrchestrator(null);
      setAgents([]);
      setPermissions([]);
      setProgress(DEFAULT_PROGRESS);
      setReconnectAttempts(0);
      connect();
    }
  }, [projectId, issueNumber, autoConnect, connect]);

  return {
    orchestrator,
    agents,
    permissions,
    progress,
    isConnected,
    isReconnecting,
    error,
    reconnectAttempts,
    connect,
    disconnect,
    respondToPermission,
  };
}

export default useSwarmWatch;
