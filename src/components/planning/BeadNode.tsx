"use client";

import { useState } from "react";
import {
  Circle,
  CircleDot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Bead, BeadTree } from "@/lib/services/beads";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface BeadNodeProps {
  bead: Bead;
  children: BeadTree[];
  depth: number;
  selectedId: string | null;
  onSelect: (beadId: string) => void;
}

// Status configuration for icons and colors
const statusConfig = {
  open: { color: "text-muted-foreground", Icon: Circle },
  in_progress: { color: "text-blue-500", Icon: CircleDot },
  closed: { color: "text-green-500", Icon: CheckCircle2 },
} as const;

// Priority badge configuration (P2 is default, not shown)
const priorityConfig: Record<number, string> = {
  0: "bg-red-500 text-white", // P0 - Critical
  1: "bg-orange-500 text-white", // P1 - High
  // 2: default, don't show
  3: "bg-gray-400 text-white", // P3 - Low
  4: "bg-gray-300 text-gray-600", // P4 - Backlog
};

/**
 * BeadNode - Individual tree node component for displaying a bead in the tree
 *
 * Features:
 * - Expand/collapse for nodes with children
 * - Status indicator (icon + color)
 * - Type badge for epics
 * - Priority badge for non-default priorities
 * - Selection highlighting
 * - Proper indentation based on depth
 */
export function BeadNode({
  bead,
  children,
  depth,
  selectedId,
  onSelect,
}: BeadNodeProps) {
  // Root node (depth 0) is expanded by default
  const [isExpanded, setIsExpanded] = useState(depth === 0);

  const hasChildren = children.length > 0;
  const isSelected = bead.id === selectedId;
  const { color: statusColor, Icon: StatusIcon } = statusConfig[bead.status];
  const priorityClass = priorityConfig[bead.priority];
  const showPriorityBadge = bead.priority !== 2 && priorityClass;
  const showTypeBadge = bead.type === "epic";

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSelect = () => {
    onSelect(bead.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect();
    } else if (e.key === "ArrowRight" && hasChildren && !isExpanded) {
      e.preventDefault();
      setIsExpanded(true);
    } else if (e.key === "ArrowLeft" && hasChildren && isExpanded) {
      e.preventDefault();
      setIsExpanded(false);
    }
  };

  // Indentation: 16px per depth level
  const indentStyle = { paddingLeft: `${depth * 16}px` };

  return (
    <div className="select-none">
      {/* Node row - min-height 48px for touch targets */}
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={0}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-2 py-3 px-2 cursor-pointer rounded-sm min-h-[48px]",
          "hover:bg-accent/50 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isSelected && "bg-accent"
        )}
        style={indentStyle}
      >
        {/* Expand/collapse button or spacer - 44px touch target */}
        <button
          type="button"
          onClick={handleToggleExpand}
          className={cn(
            "flex-shrink-0 h-11 w-11 flex items-center justify-center rounded hover:bg-accent transition-colors -ml-2",
            !hasChildren && "invisible"
          )}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          tabIndex={-1}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Status indicator */}
        <StatusIcon className={cn("h-4 w-4 flex-shrink-0", statusColor)} />

        {/* Title */}
        <span className="flex-1 min-w-0 truncate text-sm">{bead.title}</span>

        {/* Type badge (epic only) */}
        {showTypeBadge && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex-shrink-0"
          >
            Epic
          </Badge>
        )}

        {/* Priority badge (non-default only) */}
        {showPriorityBadge && (
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 h-4 border-0 flex-shrink-0",
              priorityClass
            )}
          >
            P{bead.priority}
          </Badge>
        )}
      </div>

      {/* Children (recursive) */}
      {hasChildren && isExpanded && (
        <div role="group">
          {children.map((child) => (
            <BeadNode
              key={child.root.id}
              bead={child.root}
              children={child.children}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
