import { WorkspaceSessionsView } from "../views/workspace-sessions-view"
import type { Project, Workspace } from "../types"

type WorkspaceSessionsSectionProps = {
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  createSessionError: string | null
  isCreatingSession: boolean
  deletingSessionId: string | null
  deleteSessionError: string | null
  onCreateSession: (event: React.FormEvent<HTMLFormElement>) => void
  onDeleteSession: (sessionId: string) => void
  onSelectChat: (projectId: string, workspaceId: string, chatId: string) => void
}

export const WorkspaceSessionsSection = ({
  selectedProject,
  selectedWorkspace,
  createSessionError,
  isCreatingSession,
  deletingSessionId,
  deleteSessionError,
  onCreateSession,
  onDeleteSession,
  onSelectChat,
}: WorkspaceSessionsSectionProps) => {
  return (
    <WorkspaceSessionsView
      selectedProject={selectedProject}
      selectedWorkspace={selectedWorkspace}
      createSessionError={createSessionError}
      isCreatingSession={isCreatingSession}
      deletingSessionId={deletingSessionId}
      deleteSessionError={deleteSessionError}
      onCreateSession={onCreateSession}
      onDeleteSession={onDeleteSession}
      onSelectChat={onSelectChat}
    />
  )
}
