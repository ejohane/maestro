import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import type { Project, RecentSession, Workspace } from "../types"

type WorkbenchOverviewProps = {
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
  recentSessionsLimit: number
  recentSessionsForView: RecentSession[]
  formatDateTime: (value?: string) => string
  onDeleteWorkspace: (workspaceId: string, workspaceName?: string) => void
  onSelectChat: (projectId: string, workspaceId: string, chatId: string) => void
}

export const WorkbenchOverview = ({
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
  recentSessionsLimit,
  recentSessionsForView,
  formatDateTime,
  onDeleteWorkspace,
  onSelectChat,
}: WorkbenchOverviewProps) => {
  return (
    <>
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
        <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {viewDescription}
        </div>
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
      <div className="rounded-xl border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Recent sessions</div>
            <div className="text-xs text-muted-foreground">
              {isProjectView
                ? `Last ${recentSessionsLimit} sessions in this project.`
                : `Last ${recentSessionsLimit} sessions across your workspaces.`}
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {recentSessionsForView.length ? (
            recentSessionsForView.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectChat(session.projectId, session.workspaceId, session.id)}
                className="min-w-[220px] rounded-lg border bg-muted/20 px-4 py-3 text-left transition hover:border-primary/60 hover:bg-muted/40"
              >
                <div className="text-sm font-semibold text-foreground">{session.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {session.projectName} · {session.workspaceName}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Updated {formatDateTime(session.updatedAt)}
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              No sessions yet. Create a workspace to start chatting.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
