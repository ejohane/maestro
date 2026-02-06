import { WorkbenchHeader } from "../views/workbench-header"
import type { Project, Workspace } from "../types"

type WorkbenchHeaderSectionProps = {
  isSettingsView: boolean
  isLoading: boolean
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: { id: string; name: string; model?: string } | null
  onSelectProjectsView: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
}

export const WorkbenchHeaderSection = ({
  isSettingsView,
  isLoading,
  selectedProject,
  selectedWorkspace,
  selectedChat,
  onSelectProjectsView,
  onSelectProject,
  onSelectWorkspace,
}: WorkbenchHeaderSectionProps) => {
  return (
    <WorkbenchHeader
      isSettingsView={isSettingsView}
      isLoading={isLoading}
      selectedProject={selectedProject}
      selectedWorkspace={selectedWorkspace}
      selectedChat={selectedChat}
      onSelectProjectsView={onSelectProjectsView}
      onSelectProject={onSelectProject}
      onSelectWorkspace={onSelectWorkspace}
    />
  )
}
