import * as React from "react"

import type { Workspace } from "../types"

type WorkspaceSessionsViewProps = {
  selectedWorkspace: Workspace | null
  selectedWorkspaceChatId: string | null
  createSessionError: string | null
  deleteSessionError: string | null
  deleteWorkspaceErrors: Record<string, string>
  chat: React.ReactNode
}

export const WorkspaceSessionsView = ({
  selectedWorkspace,
  selectedWorkspaceChatId,
  createSessionError,
  deleteSessionError,
  deleteWorkspaceErrors,
  chat,
}: WorkspaceSessionsViewProps) => {
  const chats = selectedWorkspace?.chats ?? []
  const activeChat =
    chats.find((chatEntry) => chatEntry.id === selectedWorkspaceChatId) ?? chats[0] ?? null
  const workspaceDeleteError = selectedWorkspace
    ? deleteWorkspaceErrors[selectedWorkspace.id]
    : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {createSessionError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {createSessionError}
        </div>
      ) : null}
      {deleteSessionError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {deleteSessionError}
        </div>
      ) : null}
      {workspaceDeleteError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {workspaceDeleteError}
        </div>
      ) : null}
      <section className="min-h-0 flex-1 overflow-hidden">
        {activeChat ? (
          <div className="h-full min-h-0">{chat}</div>
        ) : (
          <div className="flex h-full min-h-[340px] items-center justify-center px-6 py-8 text-sm text-muted-foreground">
            No sessions in this workspace yet. Use the plus button in the top bar to create one.
          </div>
        )}
      </section>
    </div>
  )
}
