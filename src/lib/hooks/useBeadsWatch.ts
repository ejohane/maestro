// useBeadsWatch - React hook for real-time bead updates via SSE
//
// This hook connects to the beads watch SSE endpoint and provides
// real-time updates when beads are created or modified.

import { useState, useEffect, useCallback, useRef } from "react";
import { Bead } from "@/lib/services/beads";

// Constants
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BACKOFF_MULTIPLIER = 1.5;

export interface UseBeadsWatchOptions {
  /** Whether to automatically connect on mount (default: true) */
  autoConnect?: boolean;
  /** Called when beads are updated */
  onUpdate?: (beads: Bead[]) => void;
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when connection is lost */
  onDisconnect?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface UseBeadsWatchReturn {
  /** Current list of beads */
  beads: Bead[];
  /** Whether connected to the SSE stream */
  isConnected: boolean;
  /** Whether currently attempting to reconnect */
  isReconnecting: boolean;
  /** Current error, if any */
  error: Error | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Manually trigger a refetch (useful after local mutations) */
  refetch: () => void;
  /** Manually connect to the SSE stream */
  connect: () => void;
  /** Manually disconnect from the SSE stream */
  disconnect: () => void;
}

/**
 * Hook for watching beads in real-time via Server-Sent Events
 *
 * @param projectId - The project ID
 * @param issueNumber - The issue number
 * @param options - Configuration options
 * @returns Beads state and control functions
 *
 * @example
 * ```tsx
 * function PlanningView({ projectId, issueNumber }) {
 *   const { beads, isConnected, error } = useBeadsWatch(projectId, issueNumber);
 *
 *   if (!isConnected) {
 *     return <Banner>Connecting to live updates...</Banner>;
 *   }
 *
 *   return <BeadsList beads={beads} />;
 * }
 * ```
 */
export function useBeadsWatch(
  projectId: string,
  issueNumber: number,
  options: UseBeadsWatchOptions = {}
): UseBeadsWatchReturn {
  const {
    autoConnect = true,
    onUpdate,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  // State
  const [beads, setBeads] = useState<Bead[]>([]);
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
  const onUpdateRef = useRef(onUpdate);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  // Ref to store connect function for self-reference
  const connectRef = useRef<() => void>(() => {});

  // Update callback refs
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onUpdate, onConnect, onDisconnect, onError]);

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

    const url = `/api/projects/${projectId}/planning/${issueNumber}/beads/watch`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;

      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);
      setError(null);
      onConnectRef.current?.();
    };

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data);

        if (data.type === "update" && Array.isArray(data.beads)) {
          setBeads(data.beads);
          onUpdateRef.current?.(data.beads);
        } else if (data.type === "connected") {
          // Connection confirmation - state already handled in onopen
        } else if (data.type === "error") {
          const err = new Error(data.error || "Unknown error");
          setError(err);
          onErrorRef.current?.(err);
        }
      } catch (parseError) {
        console.error("[useBeadsWatch] Failed to parse event:", parseError);
      }
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;

      // EventSource automatically attempts to reconnect on error,
      // but we want more control over the reconnection logic

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
              RECONNECT_DELAY_MS * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, prev),
              30000 // Max 30 seconds
            );

            console.log(
              `[useBeadsWatch] Reconnecting in ${delay}ms (attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS})`
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
   * Manually trigger a refetch by reconnecting
   */
  const refetch = useCallback(() => {
    // Reconnecting will trigger an initial fetch
    if (eventSourceRef.current) {
      disconnect();
    }
    setReconnectAttempts(0);
    connect();
  }, [connect, disconnect]);

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
      setBeads([]);
      setReconnectAttempts(0);
      connect();
    }
  }, [projectId, issueNumber, autoConnect, connect]);

  return {
    beads,
    isConnected,
    isReconnecting,
    error,
    reconnectAttempts,
    refetch,
    connect,
    disconnect,
  };
}

export default useBeadsWatch;
