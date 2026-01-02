"use client";

import { useState, useMemo } from "react";
import { List, Network, ListTodo, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBeadsWatch } from "@/lib/hooks/useBeadsWatch";
import { BeadsList } from "./BeadsList";
import { BeadDetail } from "./BeadDetail";
import type { Bead, BeadTree } from "@/lib/services/beads";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type ViewMode = "list" | "graph";

interface PlanningRightPaneProps {
  /**
   * The project ID for API calls
   */
  projectId: string;
  /**
   * The issue number for API calls
   */
  issueNumber: number;
  /**
   * Callback when user clicks "Chat about this" on a bead.
   * The parent component should create the BeadContext from this.
   */
  onChatAbout?: (beadId: string, beadTitle: string) => void;
}

/**
 * Build a BeadTree from a flat array of beads
 * Finds the epic (root) and recursively builds child nodes
 */
function buildBeadTree(beads: Bead[]): BeadTree | null {
  if (beads.length === 0) return null;

  // Find the epic (root) - no parent
  const epic = beads.find((b) => b.type === "epic" && !b.parent);
  if (!epic) return null;

  function buildNode(bead: Bead): BeadTree {
    const children = beads
      .filter((b) => b.parent === bead.id)
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
      .map(buildNode);
    return { root: bead, children };
  }

  return buildNode(epic);
}

/**
 * Empty state component shown when no beads exist yet
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground">No beads yet</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        The AI is analyzing your issue...
      </p>
    </div>
  );
}

/**
 * PlanningRightPane - Contains the plan visualization and detail panel
 *
 * Features:
 * - View toggle (List view / Graph view)
 * - BeadsList for hierarchical task display
 * - BeadDetail panel for selected task editing
 * - Real-time updates via useBeadsWatch hook
 * - Offline indicator when disconnected
 */
export function PlanningRightPane({
  projectId,
  issueNumber,
  onChatAbout,
}: PlanningRightPaneProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedBeadId, setSelectedBeadId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Real-time bead updates
  const { beads, isConnected, refetch } = useBeadsWatch(
    projectId,
    issueNumber
  );

  // Build tree from flat beads list
  const tree = useMemo(() => buildBeadTree(beads), [beads]);

  // Get the currently selected bead
  const selectedBead = selectedBeadId
    ? beads.find((b) => b.id === selectedBeadId)
    : null;

  // Handle bead update via API
  const handleUpdate = async (updates: {
    status?: string;
    priority?: number;
    title?: string;
  }) => {
    if (!selectedBeadId) return;

    await fetch(
      `/api/projects/${projectId}/planning/${issueNumber}/beads/${selectedBeadId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );

    // Refetch to get updated data
    refetch();
  };

  // Handle bead delete via API
  const handleDelete = async (beadId: string) => {
    await fetch(
      `/api/projects/${projectId}/planning/${issueNumber}/beads/${beadId}`,
      {
        method: "DELETE",
      }
    );

    // Clear selection and refetch
    setSelectedBeadId(null);
    refetch();
  };

  // Handle clicking a bead link in the detail panel
  const handleBeadClick = (beadId: string) => {
    setSelectedBeadId(beadId);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden min-w-0">
      {/* Header with view toggle and connection status */}
      <div className="border-b border-border p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Plan</h2>
          {!isConnected && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <WifiOff className="h-3 w-3" />
              Offline
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded text-xs font-medium transition-colors",
              viewMode === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            onClick={() => setViewMode("graph")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded text-xs font-medium transition-colors",
              viewMode === "graph"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Network className="h-3.5 w-3.5" />
            Graph
          </button>
        </div>
      </div>

      {/* Main content area - list + detail panel */}
      <div className="flex flex-1 overflow-hidden relative min-w-0">
        {/* Beads list */}
        <div className="flex-1 overflow-auto min-w-0">
          {viewMode === "list" ? (
            tree ? (
              <BeadsList
                tree={tree}
                selectedId={selectedBeadId}
                onSelect={setSelectedBeadId}
              />
            ) : (
              <EmptyState />
            )
          ) : (
            // Graph view placeholder
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Network className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Dependency graph view
              </p>
              <p className="text-xs text-muted-foreground mt-1 italic">
                Coming soon
              </p>
            </div>
          )}
        </div>

        {/* Detail panel - desktop: slide-in overlay */}
        {!isMobile && (
          <div
            className={cn(
              "absolute right-0 top-0 bottom-0 w-[75%]",
              "bg-card border-l shadow-xl z-10 overflow-auto",
              "transition-transform duration-300 ease-out",
              selectedBead ? "translate-x-0" : "translate-x-full"
            )}
          >
            {selectedBead && (
              <BeadDetail
                bead={selectedBead}
                onUpdate={handleUpdate}
                onClose={() => setSelectedBeadId(null)}
                onChatAbout={(beadId) =>
                  onChatAbout?.(beadId, selectedBead.title)
                }
                onDelete={handleDelete}
                onBeadClick={handleBeadClick}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet for bead detail */}
      {isMobile && (
        <Sheet open={!!selectedBead} onOpenChange={(open) => !open && setSelectedBeadId(null)}>
          <SheetContent side="bottom" className="h-[92vh] safe-bottom p-0" showCloseButton={false}>
            <SheetHeader className="sr-only">
              <SheetTitle>Bead Details</SheetTitle>
            </SheetHeader>
            {selectedBead && (
              <BeadDetail
                bead={selectedBead}
                onUpdate={handleUpdate}
                onClose={() => setSelectedBeadId(null)}
                onChatAbout={(beadId) =>
                  onChatAbout?.(beadId, selectedBead.title)
                }
                onDelete={handleDelete}
                onBeadClick={handleBeadClick}
              />
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
