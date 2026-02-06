import { AppSidebar } from "../../../components/app-sidebar"
import type { Project } from "../types"

type WorkbenchSidebarSectionProps = {
  projects: Project[]
  isProjectsView: boolean
  isSettingsView: boolean
  selectedProjectId: string | null
  selectedWorkspaceId: string | null
  selectedChatId: string | null
  onSelectProjects: () => void
  onSelectSettings: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onSelectChat: (projectId: string, workspaceId: string, chatId: string) => void
}

export const WorkbenchSidebarSection = ({
  projects,
  isProjectsView,
  isSettingsView,
  selectedProjectId,
  selectedWorkspaceId,
  selectedChatId,
  onSelectProjects,
  onSelectSettings,
  onSelectProject,
  onSelectWorkspace,
  onSelectChat,
}: WorkbenchSidebarSectionProps) => {
  return (
    <AppSidebar
      projects={projects}
      isProjectsView={isProjectsView}
      isSettingsView={isSettingsView}
      selectedProjectId={selectedProjectId}
      selectedWorkspaceId={selectedWorkspaceId}
      selectedChatId={selectedChatId}
      onSelectProjects={onSelectProjects}
      onSelectSettings={onSelectSettings}
      onSelectProject={onSelectProject}
      onSelectWorkspace={onSelectWorkspace}
      onSelectChat={onSelectChat}
    />
  )
}
