"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PlanningHeader,
  PlanningLeftPane,
  PlanningRightPane,
} from "@/components/planning";
import { Skeleton } from "@/components/ui/skeleton";
import { useBeadsWatch } from "@/lib/hooks/useBeadsWatch";
import { useIsMobile } from "@/hooks/use-mobile";

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
}

interface BeadContext {
  id: string;
  title: string;
}

export default function PlanningPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.id as string;
  const issueNumber = params.issueNumber as string;
  const autoStart = searchParams.get("autoStart") === "true";

  // Start Swarm state
  const [isStartingSwarm, setIsStartingSwarm] = useState(false);

  // Issue state
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [isLoadingIssue, setIsLoadingIssue] = useState(true);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Layout state
  const isMobile = useIsMobile();
  const isDesktop = !isMobile;
  const [activeTab, setActiveTab] = useState<"setup" | "plan">("setup");

  // Beads tracking for unread indicator (mobile only)
  const { beads } = useBeadsWatch(projectId, parseInt(issueNumber) || 0);
  const beadsHash = JSON.stringify(beads.map(b => b.id));
  const [lastSeenBeadsHash, setLastSeenBeadsHash] = useState(beadsHash);
  
  // Track unseen changes when on setup tab
  const hasUnseenChanges = beadsHash !== lastSeenBeadsHash && activeTab === "setup" && beads.length > 0;

  // Update last seen hash when switching to plan tab
  useEffect(() => {
    if (activeTab === "plan") {
      setLastSeenBeadsHash(beadsHash);
    }
  }, [activeTab, beadsHash]);

  // Bead context state (for linking chat messages to specific beads)
  const [selectedBead, setSelectedBead] = useState<BeadContext | null>(null);

  // Clear the selected bead context
  const handleClearContext = useCallback(() => {
    setSelectedBead(null);
  }, []);

  // Set bead context for chat (called from BeadDetail's "Chat about this" button)
  const handleChatAbout = useCallback((beadId: string, beadTitle: string) => {
    setSelectedBead({ id: beadId, title: beadTitle });
    // On mobile, switch to the setup/chat tab
    if (!isDesktop) {
      setActiveTab("setup");
    }
  }, [isDesktop]);

  // Escape key to clear context
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedBead) {
        setSelectedBead(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBead]);

  // Handle Start Swarm
  const handleStartSwarm = useCallback(async () => {
    setIsStartingSwarm(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/swarm/${issueNumber}/start`,
        { method: "POST" }
      );
      const data = await response.json();
      
      if (data.success) {
        router.push(`/project/${projectId}/swarm/${issueNumber}`);
      } else {
        console.error("Failed to start swarm:", data.error);
        // TODO: Show error toast
      }
    } catch (err) {
      console.error("Error starting swarm:", err);
    } finally {
      setIsStartingSwarm(false);
    }
  }, [projectId, issueNumber, router]);

  // Panel resizing state (percentage-based, 40% default)
  const [leftPanelPercent, setLeftPanelPercent] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("planning-panel-percent");
      return saved ? parseFloat(saved) : 40;
    }
    return 40;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch issue details
  const fetchIssue = useCallback(async () => {
    setIsLoadingIssue(true);
    setIssueError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueNumber}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          setIssueError("Issue not found.");
        } else {
          setIssueError("Failed to load issue.");
        }
        return;
      }
      const data = await response.json();
      setIssue(data);
    } catch {
      setIssueError("Failed to load issue. Check your connection.");
    } finally {
      setIsLoadingIssue(false);
    }
  }, [projectId, issueNumber]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  // Panel resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newPercent =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;
      // Clamp between 25% and 75%
      const clampedPercent = Math.max(25, Math.min(75, newPercent));
      setLeftPanelPercent(clampedPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem("planning-panel-percent", leftPanelPercent.toString());
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, leftPanelPercent]);

  // Loading skeleton
  if (isLoadingIssue) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-card">
          <div className="flex h-12 items-center gap-2 px-4">
            <Skeleton className="h-7 w-7" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32 mt-1" />
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Check if beads exist (for Start Swarm button visibility)
  const hasBeads = beads.length > 0;

  // Error state
  if (issueError && !issue) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <PlanningHeader
          projectId={projectId}
          issueNumber={parseInt(issueNumber)}
          issueTitle=""
          projectName="Project"
          hasBeads={false}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{issueError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout: Split pane with resizable divider
  if (isDesktop) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <PlanningHeader
          projectId={projectId}
          issueNumber={issue?.number || parseInt(issueNumber)}
          issueTitle={issue?.title || ""}
          projectName="Project"
          hasBeads={hasBeads}
          onStartSwarm={handleStartSwarm}
          isStartingSwarm={isStartingSwarm}
        />

        <div ref={containerRef} className="flex-1 overflow-hidden flex min-h-0">
          {/* Left Pane */}
          <div
            className="flex flex-col border-r border-border overflow-hidden relative flex-shrink-0 min-w-0"
            style={{ width: `${leftPanelPercent}%` }}
          >
            {/* Drag handle */}
            <div
              className={cn(
                "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors z-10",
                isDragging ? "bg-primary" : "hover:bg-primary/30"
              )}
              onMouseDown={handleMouseDown}
            />
            <PlanningLeftPane
              projectId={projectId}
              issueNumber={issue?.number || parseInt(issueNumber)}
              issueTitle={issue?.title || ""}
              selectedBead={selectedBead}
              onClearContext={handleClearContext}
              autoStart={autoStart}
            />
          </div>

          {/* Right Pane */}
          <div
            className="flex flex-col flex-1 overflow-hidden min-w-0"
            style={{ width: `${100 - leftPanelPercent}%` }}
          >
            <PlanningRightPane
              projectId={projectId}
              issueNumber={issue?.number || parseInt(issueNumber)}
              onChatAbout={handleChatAbout}
            />
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout: Tabbed interface
  return (
    <div className="flex flex-col h-screen bg-background">
      <PlanningHeader
        projectId={projectId}
        issueNumber={issue?.number || parseInt(issueNumber)}
        issueTitle={issue?.title || ""}
        projectName="Project"
        hasBeads={hasBeads}
        onStartSwarm={handleStartSwarm}
        isStartingSwarm={isStartingSwarm}
      />

      {/* Mobile tabs - min 44px touch targets */}
      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setActiveTab("setup")}
          className={cn(
            "flex-1 min-h-[44px] py-2 text-xs font-medium transition-colors",
            activeTab === "setup"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground"
          )}
        >
          Setup & Chat
        </button>
        <button
          onClick={() => setActiveTab("plan")}
          className={cn(
            "flex-1 min-h-[44px] py-2 text-xs font-medium transition-colors relative",
            activeTab === "plan"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground"
          )}
        >
          Plan
          {/* Unread indicator - blue dot when beads changed */}
          {hasUnseenChanges && (
            <span className="absolute top-2 right-[calc(50%-20px)] h-2 w-2 rounded-full bg-blue-500" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-w-0 min-h-0">
        {activeTab === "setup" ? (
          <PlanningLeftPane
            projectId={projectId}
            issueNumber={issue?.number || parseInt(issueNumber)}
            issueTitle={issue?.title || ""}
            selectedBead={selectedBead}
            onClearContext={handleClearContext}
            autoStart={autoStart}
          />
        ) : (
          <PlanningRightPane
            projectId={projectId}
            issueNumber={issue?.number || parseInt(issueNumber)}
            onChatAbout={handleChatAbout}
          />
        )}
      </div>
    </div>
  );
}
