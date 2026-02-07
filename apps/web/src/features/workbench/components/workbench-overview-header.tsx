import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import type { Project, Workspace } from "../types"

type WorkbenchOverviewHeaderProps = {
  isProjectView: boolean
  isWorkspaceView: boolean
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  projectIconValue: string
  viewLabel: string
  viewTitle: string
  viewDescription: string
  projectRepoLabel?: string
  projectRepoHref?: string | null
  deletingWorkspace: Record<string, boolean>
  deleteWorkspaceErrors: Record<string, string>
  onDeleteWorkspace: (workspaceId: string, workspaceName?: string) => void
}

export const WorkbenchOverviewHeader = ({
  isProjectView,
  isWorkspaceView,
  selectedProject,
  selectedWorkspace,
  projectIconValue,
  viewLabel,
  viewTitle,
  viewDescription,
  projectRepoLabel,
  projectRepoHref,
  deletingWorkspace,
  deleteWorkspaceErrors,
  onDeleteWorkspace,
}: WorkbenchOverviewHeaderProps) => {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {viewLabel}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-2xl font-semibold text-foreground">
        {isProjectView && projectIconValue ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
            {projectIconValue}
          </div>
        ) : null}
        <span>{viewTitle}</span>
      </div>
      <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{viewDescription}</div>
      {isProjectView && selectedProject ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Repository</span>
          {projectRepoHref ? (
            <a
              className="font-medium text-primary hover:underline"
              href={projectRepoHref}
              target="_blank"
              rel="noreferrer"
            >
              Open repo
            </a>
          ) : (
            <span className="text-foreground">{projectRepoLabel}</span>
          )}
          {selectedProject.gitProvider ? (
            <Badge variant="secondary">
              {selectedProject.gitProvider === "github" ? "GitHub" : "GitLab"}
            </Badge>
          ) : null}
        </div>
      ) : null}
      {isWorkspaceView ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="destructive"
            onClick={() =>
              selectedWorkspace
                ? onDeleteWorkspace(selectedWorkspace.id, selectedWorkspace.name)
                : undefined
            }
            disabled={
              selectedWorkspace ? Boolean(deletingWorkspace[selectedWorkspace.id]) : false
            }
          >
            {selectedWorkspace && deletingWorkspace[selectedWorkspace.id]
              ? "Deleting workspace..."
              : "Delete workspace"}
          </Button>
          {selectedWorkspace && deleteWorkspaceErrors[selectedWorkspace.id] ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {deleteWorkspaceErrors[selectedWorkspace.id]}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
