import { ProjectWorkspacesTable } from "../../../components/project-workspaces-table"
import type { OpenPullRequest, Project } from "../types"

type ProjectWorkspacesSectionProps = {
  selectedProject: Project | null
  projectPullRequests: OpenPullRequest[]
  isLoadingPullRequests: boolean
  pullRequestsError: string | null
  workspaceTitle: string
  isCreatingWorkspace: boolean
  createWorkspaceError: string | null
  mergedPullRequests: Record<
    string,
    { workspaceId?: string; workspaceName?: string; workspaceDeleted?: boolean }
  >
  mergingPullRequests: Record<string, boolean>
  mergePullRequestErrors: Record<string, string>
  deletingMergeWorkspace: Record<string, boolean>
  deleteMergeWorkspaceErrors: Record<string, string>
  deletingWorkspace: Record<string, boolean>
  deleteWorkspaceErrors: Record<string, string>
  formatDateTime: (value?: string) => string
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onCreateWorkspace: (event: React.FormEvent<HTMLFormElement>) => void
  onWorkspaceTitleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onMergePullRequest: (item: OpenPullRequest) => void
  onDeleteMergedWorkspace: (
    pullRequestKey: string,
    workspaceId: string,
    workspaceName?: string
  ) => void
  onDeleteWorkspace: (workspaceId: string, workspaceName?: string) => Promise<boolean>
  getPullRequestKey: (item: OpenPullRequest) => string
}

export const ProjectWorkspacesSection = ({
  selectedProject,
  projectPullRequests,
  isLoadingPullRequests,
  pullRequestsError,
  workspaceTitle,
  isCreatingWorkspace,
  createWorkspaceError,
  mergedPullRequests,
  mergingPullRequests,
  mergePullRequestErrors,
  deletingMergeWorkspace,
  deleteMergeWorkspaceErrors,
  deletingWorkspace,
  deleteWorkspaceErrors,
  formatDateTime,
  onSelectWorkspace,
  onCreateWorkspace,
  onWorkspaceTitleChange,
  onMergePullRequest,
  onDeleteMergedWorkspace,
  onDeleteWorkspace,
  getPullRequestKey,
}: ProjectWorkspacesSectionProps) => {
  if (!selectedProject) {
    return null
  }

  return (
    <ProjectWorkspacesTable
      projectId={selectedProject.id}
      projectName={selectedProject.name}
      workspaces={selectedProject.workspaces}
      pullRequests={projectPullRequests}
      isLoadingPullRequests={isLoadingPullRequests}
      pullRequestsError={pullRequestsError}
      onSelectWorkspace={onSelectWorkspace}
      onCreateWorkspace={onCreateWorkspace}
      workspaceTitle={workspaceTitle}
      onWorkspaceTitleChange={onWorkspaceTitleChange}
      isCreatingWorkspace={isCreatingWorkspace}
      createWorkspaceError={createWorkspaceError}
      formatDateTime={formatDateTime}
      onMergePullRequest={onMergePullRequest}
      mergedPullRequests={mergedPullRequests}
      mergingPullRequests={mergingPullRequests}
      mergePullRequestErrors={mergePullRequestErrors}
      onDeleteMergedWorkspace={onDeleteMergedWorkspace}
      deletingMergeWorkspace={deletingMergeWorkspace}
      deleteMergeWorkspaceErrors={deleteMergeWorkspaceErrors}
      onDeleteWorkspace={onDeleteWorkspace}
      deletingWorkspace={deletingWorkspace}
      deleteWorkspaceErrors={deleteWorkspaceErrors}
      getPullRequestKey={getPullRequestKey}
    />
  )
}
