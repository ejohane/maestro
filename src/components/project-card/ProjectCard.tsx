"use client";

import Link from "next/link";
import { Folder, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectCardMenu } from "./ProjectCardMenu";
import type { Project } from "@/lib/types/api";

interface ProjectCardProps {
  project: Project;
  onEdit: () => void;
  onRemove: () => void;
  onRelocate?: () => void;
}

export function ProjectCard({
  project,
  onEdit,
  onRemove,
  onRelocate,
}: ProjectCardProps) {
  const isMissing = project.status === "missing";

  const cardContent = (
    <>
      {/* Icon with warning indicator */}
      <div className="relative">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md",
            isMissing ? "bg-yellow-500/10" : "bg-secondary"
          )}
        >
          <Folder
            className={cn(
              "h-4 w-4",
              isMissing ? "text-yellow-600" : "text-muted-foreground"
            )}
          />
        </div>
        {isMissing && (
          <AlertTriangle className="h-3 w-3 text-yellow-600 absolute -top-1 -right-1" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-medium text-sm",
              isMissing && "text-muted-foreground"
            )}
          >
            {project.displayName}
          </span>
          {isMissing && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600">
              Missing
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {project.displayPath}
        </p>
      </div>

      {!isMissing && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors",
        isMissing ? "opacity-60 bg-secondary/20" : "hover:bg-secondary/50"
      )}
    >
      {isMissing ? (
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-default">
          {cardContent}
        </div>
      ) : (
        <Link
          href={`/project/${project.id}`}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          {cardContent}
        </Link>
      )}

      {/* Menu - NOT part of link */}
      <ProjectCardMenu
        isMissing={isMissing}
        onEdit={onEdit}
        onRemove={onRemove}
        onRelocate={onRelocate}
      />
    </div>
  );
}
