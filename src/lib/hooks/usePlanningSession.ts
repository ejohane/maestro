"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Status of the planning session state machine
 * 
 * State transitions:
 * - checking: Initial state, fetching session status
 * - fresh: No worktree exists, full setup needed
 * - resuming: Worktree exists but session dead, creating new session
 * - recovered: New session created to replace dead one
 * - ready: Session exists and is alive
 * - error: Something went wrong
 */
export type PlanningSessionStatus =
  | "checking"
  | "fresh"
  | "resuming"
  | "recovered"
  | "ready"
  | "error";

export interface PlanningSessionState {
  /** Current status of the session state machine */
  status: PlanningSessionStatus;
  /** OpenCode session ID (null if no session exists) */
  sessionId: string | null;
  /** Path to the worktree (null if no worktree exists) */
  worktreePath: string | null;
  /** Branch name in the worktree */
  branch: string | null;
  /** Whether dependencies are installed */
  depsInstalled: boolean;
  /** Whether this is a newly created session (recovered from dead session) */
  isNewSession: boolean;
  /** Error if status is 'error' */
  error: Error | null;
}

export interface UsePlanningSessionReturn extends PlanningSessionState {
  /** Refetch session status and recover if needed */
  refetch: () => Promise<void>;
}

interface SessionStatusResponse {
  exists: boolean;
  worktreePath?: string;
  branch?: string;
  depsInstalled?: boolean;
  sessionId?: string;
  sessionAlive?: boolean;
}

interface SessionCreateResponse {
  sessionId: string;
  worktreePath: string;
  branch: string;
  isRecovered: boolean;
}

/**
 * Hook for managing planning session state
 * 
 * Handles the following scenarios:
 * 1. Fresh start (no worktree) - returns status='fresh'
 * 2. Existing worktree + live session - returns status='ready'
 * 3. Existing worktree + dead session - auto-recovers, returns status='recovered'
 * 4. Errors - returns status='error' with error details
 * 
 * @param projectId - The project UUID
 * @param issueNumber - The GitHub issue number
 */
export function usePlanningSession(
  projectId: string,
  issueNumber: number
): UsePlanningSessionReturn {
  const [state, setState] = useState<PlanningSessionState>({
    status: "checking",
    sessionId: null,
    worktreePath: null,
    branch: null,
    depsInstalled: false,
    isNewSession: false,
    error: null,
  });

  // Use ref to track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);

  const checkAndRecoverSession = useCallback(async () => {
    // Prevent duplicate requests
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    setState((prev) => ({
      ...prev,
      status: "checking",
      error: null,
    }));

    try {
      // Step 1: Check session status
      const statusRes = await fetch(
        `/api/projects/${projectId}/planning/${issueNumber}/session`
      );

      if (!statusRes.ok) {
        const errorData = await statusRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to check session status");
      }

      const statusData: SessionStatusResponse = await statusRes.json();

      // Case 1: No worktree exists - fresh start needed
      if (!statusData.worktreePath) {
        setState({
          status: "fresh",
          sessionId: null,
          worktreePath: null,
          branch: null,
          depsInstalled: false,
          isNewSession: false,
          error: null,
        });
        return;
      }

      // Case 2: Worktree exists with live session - ready to use
      if (statusData.exists && statusData.sessionAlive && statusData.sessionId) {
        setState({
          status: "ready",
          sessionId: statusData.sessionId,
          worktreePath: statusData.worktreePath,
          branch: statusData.branch ?? null,
          depsInstalled: statusData.depsInstalled ?? false,
          isNewSession: false,
          error: null,
        });
        return;
      }

      // Case 3: Worktree exists but session is dead or missing - need to recover
      setState((prev) => ({
        ...prev,
        status: "resuming",
        worktreePath: statusData.worktreePath ?? null,
        branch: statusData.branch ?? null,
        depsInstalled: statusData.depsInstalled ?? false,
      }));

      // Create new session via POST
      const createRes = await fetch(
        `/api/projects/${projectId}/planning/${issueNumber}/session`,
        { method: "POST" }
      );

      if (!createRes.ok) {
        const errorData = await createRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create planning session");
      }

      const createData: SessionCreateResponse = await createRes.json();

      // Session recovered successfully
      setState({
        status: createData.isRecovered ? "recovered" : "ready",
        sessionId: createData.sessionId,
        worktreePath: createData.worktreePath,
        branch: createData.branch,
        depsInstalled: statusData.depsInstalled ?? false,
        isNewSession: createData.isRecovered,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [projectId, issueNumber]);

  // Check session on mount
  useEffect(() => {
    checkAndRecoverSession();
  }, [checkAndRecoverSession]);

  return {
    ...state,
    refetch: checkAndRecoverSession,
  };
}
