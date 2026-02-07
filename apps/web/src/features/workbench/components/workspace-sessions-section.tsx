import { WorkspaceSessionsView } from "../views/workspace-sessions-view"
import type { Workspace } from "../types"

type WorkspaceSessionsSectionProps = {
  selectedWorkspace: Workspace | null
  selectedWorkspaceChatId: string | null
  createSessionError: string | null
  deleteSessionError: string | null
  deleteWorkspaceErrors: Record<string, string>
  chat: React.ReactNode
}

export const WorkspaceSessionsSection = ({
  selectedWorkspace,
  selectedWorkspaceChatId,
  createSessionError,
  deleteSessionError,
  deleteWorkspaceErrors,
  chat,
}: WorkspaceSessionsSectionProps) => {
  return (
    <WorkspaceSessionsView
      selectedWorkspace={selectedWorkspace}
      selectedWorkspaceChatId={selectedWorkspaceChatId}
      createSessionError={createSessionError}
      deleteSessionError={deleteSessionError}
      deleteWorkspaceErrors={deleteWorkspaceErrors}
      chat={chat}
    />
  )
}
