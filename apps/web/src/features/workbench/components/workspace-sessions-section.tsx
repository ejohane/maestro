import { WorkspaceSessionsView } from "../views/workspace-sessions-view"
import type { Workspace } from "../types"

type WorkspaceSessionsSectionProps = {
  selectedWorkspace: Workspace | null
  selectedWorkspaceChatId: string | null
  createSessionError: string | null
  isCreatingSession: boolean
  deletingSessionId: string | null
  deleteSessionError: string | null
  deletingWorkspace: Record<string, boolean>
  deleteWorkspaceErrors: Record<string, string>
  onCreateSession: (event: React.FormEvent<HTMLFormElement>) => void
  onDeleteSession: (sessionId: string) => void
  onSelectWorkspaceChat: (chatId: string) => void
  onDeleteWorkspace: (workspaceId: string, workspaceName?: string) => void
  chat: React.ReactNode
}

export const WorkspaceSessionsSection = ({
  selectedWorkspace,
  selectedWorkspaceChatId,
  createSessionError,
  isCreatingSession,
  deletingSessionId,
  deleteSessionError,
  deletingWorkspace,
  deleteWorkspaceErrors,
  onCreateSession,
  onDeleteSession,
  onSelectWorkspaceChat,
  onDeleteWorkspace,
  chat,
}: WorkspaceSessionsSectionProps) => {
  return (
    <WorkspaceSessionsView
      selectedWorkspace={selectedWorkspace}
      selectedWorkspaceChatId={selectedWorkspaceChatId}
      createSessionError={createSessionError}
      isCreatingSession={isCreatingSession}
      deletingSessionId={deletingSessionId}
      deleteSessionError={deleteSessionError}
      deletingWorkspace={deletingWorkspace}
      deleteWorkspaceErrors={deleteWorkspaceErrors}
      onCreateSession={onCreateSession}
      onDeleteSession={onDeleteSession}
      onSelectWorkspaceChat={onSelectWorkspaceChat}
      onDeleteWorkspace={onDeleteWorkspace}
      chat={chat}
    />
  )
}
