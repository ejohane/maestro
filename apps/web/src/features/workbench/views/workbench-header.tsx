import * as React from "react"
import { Ellipsis, History, Plus, Trash2 } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb"
import { Button } from "../../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu"
import { Separator } from "../../../components/ui/separator"
import { SidebarTrigger } from "../../../components/ui/sidebar"
import type { ChatSession, Project, Workspace } from "../types"

type WorkbenchHeaderProps = {
  isSettingsView: boolean
  isLoading: boolean
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: ChatSession | null
  workspaceActiveChatId: string | null
  isCreatingSession: boolean
  deletingSessionId: string | null
  deletingWorkspace: Record<string, boolean>
  onSelectProjectsView: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onCreateSession: (event: React.FormEvent<HTMLFormElement>) => void
  onSelectWorkspaceChat: (chatId: string) => void
  onDeleteSession: (sessionId: string) => void
  onDeleteWorkspace: (workspaceId: string, workspaceName?: string) => void
}

export const WorkbenchHeader = ({
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
  onSelectWorkspaceChat,
  onDeleteSession,
  onDeleteWorkspace,
}: WorkbenchHeaderProps) => {
  const workspaceChats = selectedWorkspace?.chats ?? []
  const activeWorkspaceChat =
    selectedChat ??
    workspaceChats.find((chatEntry) => chatEntry.id === workspaceActiveChatId) ??
    workspaceChats[0] ??
    null
  const previousWorkspaceChats = workspaceChats.filter(
    (chatEntry) => chatEntry.id !== activeWorkspaceChat?.id
  )
  const isDeletingActiveSession = activeWorkspaceChat
    ? deletingSessionId === activeWorkspaceChat.id
    : false
  const isDeletingWorkspace = selectedWorkspace
    ? Boolean(deletingWorkspace[selectedWorkspace.id])
    : false
  const showWorkspaceActions = Boolean(!isSettingsView && !isLoading && selectedWorkspace)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="min-w-0 flex-1">
        <Breadcrumb>
          <BreadcrumbList>
            {isSettingsView ? (
              <BreadcrumbItem>
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              <>
                <BreadcrumbItem>
                  {selectedProject ? (
                    <BreadcrumbLink
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        onSelectProjectsView()
                      }}
                    >
                      Home
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>Home</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {selectedProject && !isLoading ? (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {selectedWorkspace || selectedChat ? (
                        <BreadcrumbLink
                          href="#"
                          onClick={(event) => {
                            event.preventDefault()
                            onSelectProject(selectedProject.id)
                          }}
                        >
                          {selectedProject.name}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{selectedProject.name}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </>
                ) : null}
                {selectedWorkspace && !isLoading ? (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {selectedChat ? (
                        <BreadcrumbLink
                          href="#"
                          onClick={(event) => {
                            event.preventDefault()
                            if (!selectedProject) {
                              return
                            }
                            onSelectWorkspace(selectedProject.id, selectedWorkspace.id)
                          }}
                        >
                          {selectedWorkspace.name}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{selectedWorkspace.name}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </>
                ) : null}
                {selectedChat && !isLoading ? (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{selectedChat.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : null}
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {showWorkspaceActions ? (
        <div className="ml-auto flex items-center gap-2">
          <form onSubmit={onCreateSession}>
            <Button
              type="submit"
              size="icon"
              aria-label="Create session"
              title="Create session"
              disabled={isCreatingSession}
            >
              <Plus className="size-4" />
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
              {previousWorkspaceChats.length ? (
                previousWorkspaceChats.map((chatEntry) => (
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
                disabled={!activeWorkspaceChat || isDeletingActiveSession}
                onSelect={() => {
                  if (!activeWorkspaceChat) {
                    return
                  }
                  onDeleteSession(activeWorkspaceChat.id)
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
      ) : null}
    </header>
  )
}
