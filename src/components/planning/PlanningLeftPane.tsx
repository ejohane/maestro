"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SetupProgress } from "./SetupProgress";
import { SetupSummary } from "./SetupSummary";
import { PlanningChat } from "./PlanningChat";
import { Loader2, AlertCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlanningLeftPaneProps {
  projectId: string;
  issueNumber: number;
  issueTitle: string;
  selectedBead: { id: string; title: string } | null;
  onClearContext: () => void;
  autoStart?: boolean;
}

type SetupState = "pending" | "checking" | "in_progress" | "completed" | "error";

interface SessionInfo {
  sessionId: string;
  worktreePath: string;
  branch?: string;
  isInitialPromptPending?: boolean;
}

interface SessionStatusResponse {
  exists: boolean;
  worktreePath?: string;
  branch?: string;
  depsInstalled?: boolean;
  sessionId?: string;
  sessionAlive?: boolean;
}

/**
 * PlanningLeftPane - Contains the setup progress and chat sections
 *
 * Manages the transition from setup to chat mode:
 * 1. On mount: Check for existing session
 * 2. If session exists: Show chat immediately
 * 3. If no session and autoStart: Automatically start planning
 * 4. If no session and !autoStart: Show "Start Planning" button
 * 5. After setup completes: Collapse setup section, show chat
 */
export function PlanningLeftPane({
  projectId,
  issueNumber,
  issueTitle,
  selectedBead,
  onClearContext,
  autoStart = false,
}: PlanningLeftPaneProps) {
  // State
  const [setupState, setSetupState] = useState<SetupState>("checking");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [setupCollapsed, setSetupCollapsed] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Track if we've started setup to prevent duplicate starts
  const setupStartedRef = useRef(false);

  // Start planning - can be called from button click or auto-start
  const startPlanning = useCallback(() => {
    if (setupStartedRef.current) return;
    setupStartedRef.current = true;
    setSetupState("in_progress");
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    let cancelled = false;
    
    async function checkExistingSession() {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/planning/${issueNumber}/session`
        );

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: SessionStatusResponse = await response.json();

        if (cancelled) return;

        if (data.exists && data.sessionId && data.worktreePath && data.sessionAlive) {
          // Existing session found and alive
          setSessionInfo({
            sessionId: data.sessionId,
            worktreePath: data.worktreePath,
            branch: data.branch,
          });
          setSetupState("completed");
          setSetupCollapsed(true);
        } else {
          // No session or session not alive - check if we should auto-start
          if (autoStart) {
            startPlanning();
          } else {
            setSetupState("pending");
          }
        }
      } catch (err) {
        console.error("Error checking session:", err);
        if (cancelled) return;
        // On error, check if we should auto-start
        if (autoStart) {
          startPlanning();
        } else {
          setSetupState("pending");
        }
      }
    }

    checkExistingSession();
    
    return () => {
      cancelled = true;
    };
  }, [projectId, issueNumber, autoStart, startPlanning]);

  // Handle manual start from button click
  const handleStartPlanning = useCallback(() => {
    startPlanning();
  }, [startPlanning]);

  // Handle session created (called early, before setup completes)
  const handleSessionCreated = useCallback(
    (result: { sessionId: string; worktreePath: string }) => {
      // Set session info early so chat can connect while setup continues
      // Mark that the initial prompt is pending (will be sent next)
      setSessionInfo({
        sessionId: result.sessionId,
        worktreePath: result.worktreePath,
        isInitialPromptPending: true,
      });
    },
    []
  );

  // Handle setup completion
  const handleSetupComplete = useCallback(
    (result: { sessionId: string; worktreePath: string }) => {
      // When setup completes, the initial prompt was just sent but the AI is still processing
      // Mark isInitialPromptPending so the chat knows to poll for activity
      setSessionInfo({
        sessionId: result.sessionId,
        worktreePath: result.worktreePath,
        isInitialPromptPending: true,
      });
      setSetupState("completed");
      setSetupCollapsed(true);
      setSetupError(null);
    },
    []
  );

  // Handle setup error
  const handleSetupError = useCallback(
    (error: { step: string; error: string }) => {
      setSetupError(`${error.step}: ${error.error}`);
      setSetupState("error");
    },
    []
  );

  // Retry setup
  const handleRetry = useCallback(() => {
    setupStartedRef.current = false;
    setSetupError(null);
    setSetupState("pending");
  }, []);

  // Handle when initial prompt processing completes
  const handleInitialPromptComplete = useCallback(() => {
    setSessionInfo((prev) =>
      prev ? { ...prev, isInitialPromptPending: false } : null
    );
  }, []);

  // Toggle setup section collapse
  const toggleSetupCollapse = useCallback(() => {
    setSetupCollapsed((prev) => !prev);
  }, []);

  // Loading state while checking for existing session
  if (setupState === "checking") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Checking for existing session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pending state - show Start Planning button
  if (setupState === "pending") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <div className="flex flex-col items-center gap-2">
              <h3 className="text-lg font-medium">Ready to Plan</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                This will create a dedicated workspace for issue #{issueNumber} and start an AI planning session.
              </p>
            </div>
            <Button onClick={handleStartPlanning} size="lg">
              <Play className="h-4 w-4 mr-2" />
              Start Planning
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Setup in progress
  if (setupState === "in_progress") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border">
          <SetupProgress
            projectId={projectId}
            issueNumber={issueNumber}
            issueTitle={issueTitle}
            onComplete={handleSetupComplete}
            onError={handleSetupError}
            onSessionCreated={handleSessionCreated}
          />
        </div>
        {/* Show chat once session is created (before setup fully completes) */}
        <div className="flex-1 overflow-hidden">
          {sessionInfo ? (
            <PlanningChat
              projectId={projectId}
              issueNumber={issueNumber}
              sessionId={sessionInfo.sessionId}
              worktreePath={sessionInfo.worktreePath}
              selectedBead={selectedBead}
              onClearContext={onClearContext}
              isInitialPromptPending={sessionInfo.isInitialPromptPending}
              onInitialPromptComplete={handleInitialPromptComplete}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Chat will appear once the session is ready...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (setupState === "error") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-md border border-destructive/30">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">
                Setup failed
              </p>
              {setupError && (
                <p className="text-xs text-destructive/80 mt-1 break-words">
                  {setupError}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-3"
              >
                Retry Setup
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  // Completed state - show collapsible summary and chat
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Setup Summary (collapsible) */}
      {sessionInfo && (
        <SetupSummary
          worktreePath={sessionInfo.worktreePath}
          branch={sessionInfo.branch}
          isCollapsed={setupCollapsed}
          onToggle={toggleSetupCollapse}
        />
      )}

      {/* Chat section fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <PlanningChat
          projectId={projectId}
          issueNumber={issueNumber}
          sessionId={sessionInfo?.sessionId || null}
          worktreePath={sessionInfo?.worktreePath || null}
          selectedBead={selectedBead}
          onClearContext={onClearContext}
          isInitialPromptPending={sessionInfo?.isInitialPromptPending}
          onInitialPromptComplete={handleInitialPromptComplete}
        />
      </div>
    </div>
  );
}
