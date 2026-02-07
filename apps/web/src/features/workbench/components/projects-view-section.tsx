import { ProjectsView } from "../views/projects-view"
import type {
  OpenPullRequest,
  Project,
  ProjectFormState,
  WorkspaceSummary,
} from "../types"

type ProjectsViewSectionProps = {
  data: {
    projectForm: ProjectFormState
    createProjectError: string | null
    isCreatingProject: boolean
    isSelectingDirectory: boolean
    allWorkspaces: WorkspaceSummary[]
    projects: Project[]
    isLoading: boolean
    error: string | null
    sortedPullRequests: OpenPullRequest[]
    hasRepoProjects: boolean
    isLoadingPullRequests: boolean
    pullRequestsError: string | null
  }
  formatting: {
    formatDate: (value?: string) => string
    formatDateTime: (value?: string) => string
  }
  actions: {
    onCreateProject: (event: React.FormEvent<HTMLFormElement>) => void
    onProjectFormChange: (
      field: keyof ProjectFormState
    ) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
    onSelectDirectory: () => void
    onSelectWorkspace: (projectId: string, workspaceId: string) => void
    onSelectProject: (projectId: string) => void
  }
}

export const ProjectsViewSection = ({
  data,
  formatting,
  actions,
}: ProjectsViewSectionProps) => {
  return (
    <ProjectsView
      projectForm={data.projectForm}
      createProjectError={data.createProjectError}
      isCreatingProject={data.isCreatingProject}
      isSelectingDirectory={data.isSelectingDirectory}
      allWorkspaces={data.allWorkspaces}
      projects={data.projects}
      isLoading={data.isLoading}
      error={data.error}
      sortedPullRequests={data.sortedPullRequests}
      hasRepoProjects={data.hasRepoProjects}
      isLoadingPullRequests={data.isLoadingPullRequests}
      pullRequestsError={data.pullRequestsError}
      formatDate={formatting.formatDate}
      formatDateTime={formatting.formatDateTime}
      onCreateProject={actions.onCreateProject}
      onProjectFormChange={actions.onProjectFormChange}
      onSelectDirectory={actions.onSelectDirectory}
      onSelectWorkspace={actions.onSelectWorkspace}
      onSelectProject={actions.onSelectProject}
    />
  )
}
