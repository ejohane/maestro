import type { RecentSession } from "../types"

type WorkbenchOverviewRecentProps = {
  isProjectView: boolean
  recentSessionsLimit: number
  recentSessionsForView: RecentSession[]
  formatDateTime: (value?: string) => string
  onSelectChat: (projectId: string, workspaceId: string, chatId: string) => void
}

export const WorkbenchOverviewRecent = ({
  isProjectView,
  recentSessionsLimit,
  recentSessionsForView,
  formatDateTime,
  onSelectChat,
}: WorkbenchOverviewRecentProps) => {
  return (
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
  )
}
