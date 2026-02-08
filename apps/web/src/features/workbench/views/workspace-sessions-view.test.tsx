import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkspaceSessionsView } from "./workspace-sessions-view"
import type { Project, Workspace } from "../types"

const project: Project = {
  id: "project-1",
  name: "Core",
  repoPath: "/tmp/core",
  defaultBranch: "main",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  workspaces: [],
}

const workspace: Workspace = {
  id: "workspace-1",
  name: "Refactor",
  chats: [
    { id: "chat-1", name: "Thread A" },
    { id: "chat-2", name: "Thread B" },
  ],
}

describe("WorkspaceSessionsView", () => {
  it("renders and wires session controls", () => {
    const onCreateSession = vi.fn((event) => event.preventDefault())
    const onDeleteSession = vi.fn()
    const onSelectChat = vi.fn()

    render(
      <WorkspaceSessionsView
        selectedProject={project}
        selectedWorkspace={workspace}
        createSessionError={null}
        isCreatingSession={false}
        deletingSessionId={"chat-2"}
        deleteSessionError={null}
        onCreateSession={onCreateSession}
        onDeleteSession={onDeleteSession}
        onSelectChat={onSelectChat}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Create session" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Open" })[0])
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    expect(onCreateSession).toHaveBeenCalled()
    expect(onSelectChat).toHaveBeenCalledWith("project-1", "workspace-1", "chat-1")
    expect(onDeleteSession).toHaveBeenCalledWith("chat-1")
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled()
  })

  it("shows empty and error states", () => {
    render(
      <WorkspaceSessionsView
        selectedProject={project}
        selectedWorkspace={{ ...workspace, chats: [] }}
        createSessionError={"Cannot create"}
        isCreatingSession
        deletingSessionId={null}
        deleteSessionError={"Delete failed"}
        onCreateSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onSelectChat={vi.fn()}
      />
    )

    expect(screen.getByText("Cannot create")).toBeInTheDocument()
    expect(screen.getByText("No sessions yet. Create your first one.")).toBeInTheDocument()
    expect(screen.getByText("Delete failed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Creating session..." })).toBeDisabled()
  })
})
