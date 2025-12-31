"use client";

import { FolderOpen } from "lucide-react";
import type { BeadTree } from "@/lib/services/beads";
import { BeadNode } from "./BeadNode";

export interface BeadsListProps {
  tree: BeadTree | null;
  selectedId: string | null;
  onSelect: (beadId: string) => void;
}

/**
 * BeadsList - Main list container for displaying beads in a hierarchical tree structure
 *
 * Features:
 * - Renders BeadTree as a visual tree with indentation
 * - Handles empty state when tree is null
 * - Passes selection state down to BeadNode components
 * - Accessible tree navigation with ARIA attributes
 */
export function BeadsList({ tree, selectedId, onSelect }: BeadsListProps) {
  // Empty state when no tree
  if (!tree) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center">
        <FolderOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No beads yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Use the chat to create tasks and organize your work
        </p>
      </div>
    );
  }

  return (
    <div
      role="tree"
      aria-label="Beads tree"
      className="py-2"
    >
      <BeadNode
        bead={tree.root}
        children={tree.children}
        depth={0}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  );
}
