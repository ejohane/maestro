import { WorkbenchHeader } from "../views/workbench-header"
import type { Project, Workspace } from "../types"

type WorkbenchHeaderSectionProps = {
  commandPaletteShortcutLabel: string
  isSettingsView: boolean
  isLoading: boolean
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: { id: string; name: string; model?: string } | null
  workspaceActiveChatId: string | null
  isCreatingSession: boolean
  deletingSessionId: string | null
  deletingWorkspace: Record<string, boolean>
  onSelectProjectsView: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onCreateSession: (event: React.FormEvent<HTMLFormElement>) => void
  onOpenCommandPalette: () => void
  onSelectWorkspaceChat: (chatId: string) => void
  onDeleteSession: (sessionId: string) => void
  onDeleteWorkspace: (workspaceId: string, workspaceName?: string) => void
}

export const WorkbenchHeaderSection = ({
  commandPaletteShortcutLabel,
  isSettingsView,
  isLoading,
  selectedProject,
  selectedWorkspace,
  selectedChat,
  workspaceActiveChatId,
  isCreatingSession,
  deletingSessionId,
  deletingWorkspace,
  onSelectProjectsView,
  onSelectProject,
  onSelectWorkspace,
  onCreateSession,
  onOpenCommandPalette,
  onSelectWorkspaceChat,
  onDeleteSession,
  onDeleteWorkspace,
}: WorkbenchHeaderSectionProps) => {
  return (
    <WorkbenchHeader
      commandPaletteShortcutLabel={commandPaletteShortcutLabel}
      isSettingsView={isSettingsView}
      isLoading={isLoading}
      selectedProject={selectedProject}
      selectedWorkspace={selectedWorkspace}
      selectedChat={selectedChat}
      workspaceActiveChatId={workspaceActiveChatId}
      isCreatingSession={isCreatingSession}
      deletingSessionId={deletingSessionId}
      deletingWorkspace={deletingWorkspace}
      onSelectProjectsView={onSelectProjectsView}
      onSelectProject={onSelectProject}
      onSelectWorkspace={onSelectWorkspace}
      onCreateSession={onCreateSession}
      onOpenCommandPalette={onOpenCommandPalette}
      onSelectWorkspaceChat={onSelectWorkspaceChat}
      onDeleteSession={onDeleteSession}
      onDeleteWorkspace={onDeleteWorkspace}
    />
  )
}
