"use client";

import { cn } from "@/lib/utils";

export interface BeadLinkProps {
  beadId: string;
  onClick?: (beadId: string) => void;
  className?: string;
}

/**
 * BeadLink - A clickable link/button that displays a bead ID
 *
 * Used in dependency sections to navigate between beads
 */
export function BeadLink({ beadId, onClick, className }: BeadLinkProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(beadId)}
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded",
        "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        "transition-colors cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        className
      )}
    >
      {beadId}
    </button>
  );
}
