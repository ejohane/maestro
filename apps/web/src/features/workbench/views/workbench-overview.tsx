import { WorkbenchOverviewHeader } from "../components/workbench-overview-header"
import { WorkbenchOverviewRecent } from "../components/workbench-overview-recent"
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
      <WorkbenchOverviewHeader
        isProjectView={isProjectView}
        isWorkspaceView={isWorkspaceView}
        selectedProject={selectedProject}
        selectedWorkspace={selectedWorkspace}
        projectIconValue={projectIconValue}
        viewLabel={viewLabel}
        viewTitle={viewTitle}
        viewDescription={viewDescription}
        projectRepoLabel={projectRepoLabel}
        projectRepoHref={projectRepoHref}
        deletingWorkspace={deletingWorkspace}
        deleteWorkspaceErrors={deleteWorkspaceErrors}
        onDeleteWorkspace={onDeleteWorkspace}
      />
      <WorkbenchOverviewRecent
        isProjectView={isProjectView}
        recentSessionsLimit={recentSessionsLimit}
        recentSessionsForView={recentSessionsForView}
        formatDateTime={formatDateTime}
        onSelectChat={onSelectChat}
      />
    </>
  )
}
