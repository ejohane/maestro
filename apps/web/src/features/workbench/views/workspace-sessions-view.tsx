import * as React from "react"

import { Button } from "../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import type { Project, Workspace } from "../types"

type WorkspaceSessionsViewProps = {
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

export const WorkspaceSessionsView = ({
  selectedProject,
  selectedWorkspace,
  createSessionError,
  isCreatingSession,
  deletingSessionId,
  deleteSessionError,
  onCreateSession,
  onDeleteSession,
  onSelectChat,
}: WorkspaceSessionsViewProps) => {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card className="border-dashed">
        <form onSubmit={onCreateSession}>
          <CardHeader>
            <CardTitle>Create a new session</CardTitle>
            <CardDescription>
              Start a focused chat within this workspace. OpenCode will name it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {createSessionError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {createSessionError}
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isCreatingSession}>
              {isCreatingSession ? "Creating session..." : "Create session"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Chat sessions</CardTitle>
          <CardDescription>Jump back into any active thread.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {selectedWorkspace?.chats.length ? (
            selectedWorkspace.chats.map((chat) => {
              const isDeleting = deletingSessionId === chat.id
              return (
                <div
                  key={chat.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{chat.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!selectedProject || !selectedWorkspace) {
                          return
                        }
                        onSelectChat(selectedProject.id, selectedWorkspace.id, chat.id)
                      }}
                    >
                      Open
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSession(chat.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              No sessions yet. Create your first one.
            </div>
          )}
          {deleteSessionError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {deleteSessionError}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
