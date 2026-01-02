"use client";

import { useState } from "react";
import { X, MessageSquare, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Bead } from "@/lib/services/beads";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BeadLink } from "./BeadLink";

export interface BeadDetailProps {
  bead: Bead;
  onUpdate: (updates: {
    status?: string;
    priority?: number;
    title?: string;
  }) => Promise<void>;
  onClose: () => void;
  onChatAbout: (beadId: string) => void;
  onDelete: (beadId: string) => Promise<void>;
  onBeadClick?: (beadId: string) => void;
}

const STATUS_OPTIONS: { value: Bead["status"]; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS: { value: Bead["priority"]; label: string }[] = [
  { value: 0, label: "P0 - Critical" },
  { value: 1, label: "P1 - High" },
  { value: 2, label: "P2 - Medium" },
  { value: 3, label: "P3 - Low" },
  { value: 4, label: "P4 - Backlog" },
];

const TYPE_COLORS: Record<Bead["type"], string> = {
  epic: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  task: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  bug: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  feature: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  question:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  docs: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

/**
 * BeadDetail - Detail panel component for displaying and editing bead information
 *
 * Shows full information about a selected bead including:
 * - Title and close button
 * - Status/Priority dropdowns (editable)
 * - Type badge (read-only)
 * - Description with Markdown rendering
 * - Dependencies (blocks/blocked by)
 * - Action buttons (Chat about this, Delete)
 */
export function BeadDetail({
  bead,
  onUpdate,
  onClose,
  onChatAbout,
  onDelete,
  onBeadClick,
}: BeadDetailProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (value: string) => {
    setIsUpdating(true);
    try {
      await onUpdate({ status: value });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePriorityChange = async (value: string) => {
    setIsUpdating(true);
    try {
      await onUpdate({ priority: parseInt(value, 10) });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(bead.id);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasBlocks = bead.blocks && bead.blocks.length > 0;
  const hasBlockedBy = bead.blockedBy && bead.blockedBy.length > 0;
  const hasDependencies = hasBlocks || hasBlockedBy;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <h2 className="text-base font-semibold leading-tight truncate min-w-0 flex-1">
          {bead.id}: {bead.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close detail panel"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status, Priority, Type row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select
              value={bead.status}
              onValueChange={handleStatusChange}
              disabled={isUpdating}
            >
              <SelectTrigger size="sm" className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Priority:</span>
            <Select
              value={String(bead.priority)}
              onValueChange={handlePriorityChange}
              disabled={isUpdating}
            >
              <SelectTrigger size="sm" className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type badge (read-only) */}
          <Badge
            variant="secondary"
            className={cn("capitalize", TYPE_COLORS[bead.type])}
          >
            {bead.type}
          </Badge>
        </div>

        <Separator />

        {/* Description */}
        {bead.description ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {bead.description}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No description provided
          </p>
        )}

        {/* Dependencies section */}
        {hasDependencies && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Dependencies
              </h3>

              {/* Blocks */}
              {hasBlocks && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Blocks:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {bead.blocks!.map((blockedId) => (
                      <BeadLink
                        key={blockedId}
                        beadId={blockedId}
                        onClick={onBeadClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Blocked by */}
              {hasBlockedBy && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    Blocked by:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {bead.blockedBy!.map((blockerId) => (
                      <BeadLink
                        key={blockerId}
                        beadId={blockerId}
                        onClick={onBeadClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer actions - min 44px touch targets */}
      <div className="flex items-center justify-center gap-3 p-4 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChatAbout(bead.id)}
          className="h-10"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Chat about this
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-10"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{bead.id}: {bead.title}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
