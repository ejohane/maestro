import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkspaceSessionsView } from "./workspace-sessions-view"
import type { Workspace } from "../types"

const workspace: Workspace = {
  id: "workspace-1",
  name: "Refactor",
  chats: [
    { id: "chat-1", name: "Thread A" },
    { id: "chat-2", name: "Thread B" },
  ],
}

describe("WorkspaceSessionsView", () => {
  const openWorkspaceOptionsMenu = () => {
    fireEvent.pointerDown(screen.getByRole("button", { name: "Workspace options" }), {
      button: 0,
    })
  }

  it("renders and wires workspace actions", () => {
    const onCreateSession = vi.fn((event) => event.preventDefault())
    const onDeleteSession = vi.fn()
    const onSelectWorkspaceChat = vi.fn()
    const onDeleteWorkspace = vi.fn()

    render(
      <WorkspaceSessionsView
        selectedWorkspace={workspace}
        selectedWorkspaceChatId={"chat-1"}
        createSessionError={null}
        isCreatingSession={false}
        deletingSessionId={null}
        deleteSessionError={null}
        deletingWorkspace={{}}
        deleteWorkspaceErrors={{}}
        onCreateSession={onCreateSession}
        onDeleteSession={onDeleteSession}
        onSelectWorkspaceChat={onSelectWorkspaceChat}
        onDeleteWorkspace={onDeleteWorkspace}
        chat={<div>Chat panel</div>}
      />
    )

    expect(screen.getByText("Refactor")).toBeInTheDocument()
    expect(screen.getByText("Active session: Thread A")).toBeInTheDocument()
    expect(screen.getByText("Chat panel")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Create session" }))
    expect(onCreateSession).toHaveBeenCalled()

    openWorkspaceOptionsMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Thread B" }))
    expect(onSelectWorkspaceChat).toHaveBeenCalledWith("chat-2")

    openWorkspaceOptionsMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete active session" }))
    expect(onDeleteSession).toHaveBeenCalledWith("chat-1")

    openWorkspaceOptionsMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete workspace" }))
    expect(onDeleteWorkspace).toHaveBeenCalledWith("workspace-1", "Refactor")
  })

  it("shows error states", () => {
    render(
      <WorkspaceSessionsView
        selectedWorkspace={workspace}
        selectedWorkspaceChatId={null}
        createSessionError={"Cannot create"}
        isCreatingSession
        deletingSessionId={null}
        deleteSessionError={"Delete failed"}
        deletingWorkspace={{ "workspace-1": true }}
        deleteWorkspaceErrors={{ "workspace-1": "Cannot delete workspace" }}
        onCreateSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onSelectWorkspaceChat={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        chat={<div>Chat panel</div>}
      />
    )

    expect(screen.getByText("Cannot create")).toBeInTheDocument()
    expect(screen.getByText("Delete failed")).toBeInTheDocument()
    expect(screen.getByText("Cannot delete workspace")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled()

    openWorkspaceOptionsMenu()
    expect(screen.getByRole("menuitem", { name: "Deleting workspace..." })).toHaveAttribute(
      "data-disabled"
    )
  })

  it("shows empty chat state when no sessions are available", () => {
    render(
      <WorkspaceSessionsView
        selectedWorkspace={{ ...workspace, chats: [] }}
        selectedWorkspaceChatId={null}
        createSessionError={null}
        isCreatingSession={false}
        deletingSessionId={null}
        deleteSessionError={null}
        deletingWorkspace={{}}
        deleteWorkspaceErrors={{}}
        onCreateSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onSelectWorkspaceChat={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        chat={<div>Chat panel</div>}
      />
    )

    expect(
      screen.getByText("No sessions in this workspace yet. Create one to start chatting.")
    ).toBeInTheDocument()
    openWorkspaceOptionsMenu()
    expect(screen.getByRole("menuitem", { name: "No previous sessions" })).toBeInTheDocument()
    expect(screen.queryByText("Chat panel")).not.toBeInTheDocument()
  })
})
