"use client";

import { MoreVertical, Pencil, Trash2, FolderSearch } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectCardMenuProps {
  isMissing: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onRelocate?: () => void;
}

export function ProjectCardMenu({
  isMissing,
  onEdit,
  onRemove,
  onRelocate,
}: ProjectCardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-secondary shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isMissing && onRelocate && (
          <DropdownMenuItem onClick={onRelocate} className="font-medium">
            <FolderSearch className="h-4 w-4 mr-2" />
            Relocate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Name
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRemove} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
