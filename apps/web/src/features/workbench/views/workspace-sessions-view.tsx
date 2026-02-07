import * as React from "react"
import { Ellipsis, History, Plus, Trash2 } from "lucide-react"

import { Button } from "../../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu"
import type { Workspace } from "../types"

type WorkspaceSessionsViewProps = {
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

export const WorkspaceSessionsView = ({
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
}: WorkspaceSessionsViewProps) => {
  const chats = selectedWorkspace?.chats ?? []
  const activeChat =
    chats.find((chatEntry) => chatEntry.id === selectedWorkspaceChatId) ?? chats[0] ?? null
  const previousChats = chats.filter((chatEntry) => chatEntry.id !== activeChat?.id)
  const isDeletingWorkspace = selectedWorkspace
    ? Boolean(deletingWorkspace[selectedWorkspace.id])
    : false
  const workspaceDeleteError = selectedWorkspace
    ? deleteWorkspaceErrors[selectedWorkspace.id]
    : null
  const isDeletingActiveSession = activeChat ? deletingSessionId === activeChat.id : false

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-3">
      <section className="rounded-xl border bg-card/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </p>
            <div className="truncate text-lg font-semibold text-foreground">
              {selectedWorkspace?.name ?? "Workspace"}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {activeChat ? `Active session: ${activeChat.name}` : "No sessions yet."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={onCreateSession}>
              <Button type="submit" size="sm" disabled={isCreatingSession}>
                <Plus className="size-4" />
                {isCreatingSession ? "Creating..." : "Create session"}
              </Button>
            </form>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="Workspace options">
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Workspace options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground">
                  Previous sessions
                </DropdownMenuLabel>
                {previousChats.length ? (
                  previousChats.map((chatEntry) => (
                    <DropdownMenuItem
                      key={chatEntry.id}
                      onSelect={() => onSelectWorkspaceChat(chatEntry.id)}
                      className="gap-3"
                    >
                      <History className="size-4" />
                      <span className="truncate">{chatEntry.name}</span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>No previous sessions</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!activeChat || isDeletingActiveSession}
                  onSelect={() => {
                    if (!activeChat) {
                      return
                    }
                    onDeleteSession(activeChat.id)
                  }}
                >
                  <Trash2 className="size-4" />
                  {isDeletingActiveSession ? "Deleting active session..." : "Delete active session"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!selectedWorkspace || isDeletingWorkspace}
                  onSelect={() => {
                    if (!selectedWorkspace) {
                      return
                    }
                    onDeleteWorkspace(selectedWorkspace.id, selectedWorkspace.name)
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  {isDeletingWorkspace ? "Deleting workspace..." : "Delete workspace"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {createSessionError ? (
          <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {createSessionError}
          </div>
        ) : null}
        {deleteSessionError ? (
          <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {deleteSessionError}
          </div>
        ) : null}
        {workspaceDeleteError ? (
          <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {workspaceDeleteError}
          </div>
        ) : null}
      </section>
      <section className="min-h-0 flex-1 overflow-hidden">
        {activeChat ? (
          <div className="flex h-full min-h-0 flex-col rounded-xl border bg-card/30 p-2">
            {chat}
          </div>
        ) : (
          <div className="flex h-full min-h-[340px] items-center justify-center rounded-xl border border-dashed px-6 py-8 text-sm text-muted-foreground">
            No sessions in this workspace yet. Create one to start chatting.
          </div>
        )}
      </section>
    </div>
  )
}
