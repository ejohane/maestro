import { AppSidebar } from "../../../components/app-sidebar"
import type { Project } from "../types"

type WorkbenchSidebarSectionProps = {
  projects: Project[]
  isProjectsView: boolean
  isSettingsView: boolean
  selectedProjectId: string | null
  selectedWorkspaceId: string | null
  onSelectProjects: () => void
  onSelectSettings: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onCreateProject: () => void
  onCreateWorkspace: (projectId: string) => void
  activeWorkspaceIds: string[]
}

export const WorkbenchSidebarSection = ({
  projects,
  isProjectsView,
  isSettingsView,
  selectedProjectId,
  selectedWorkspaceId,
  onSelectProjects,
  onSelectSettings,
  onSelectProject,
  onSelectWorkspace,
  onCreateProject,
  onCreateWorkspace,
  activeWorkspaceIds,
}: WorkbenchSidebarSectionProps) => {
  return (
    <AppSidebar
      projects={projects}
      isProjectsView={isProjectsView}
      isSettingsView={isSettingsView}
      selectedProjectId={selectedProjectId}
      selectedWorkspaceId={selectedWorkspaceId}
      onSelectProjects={onSelectProjects}
      onSelectSettings={onSelectSettings}
      onSelectProject={onSelectProject}
      onSelectWorkspace={onSelectWorkspace}
      onCreateProject={onCreateProject}
      onCreateWorkspace={onCreateWorkspace}
      activeWorkspaceIds={activeWorkspaceIds}
    />
  )
}
