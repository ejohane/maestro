import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

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
  it("renders the active chat content", () => {
    render(
      <WorkspaceSessionsView
        selectedWorkspace={workspace}
        selectedWorkspaceChatId={"chat-1"}
        createSessionError={null}
        deleteSessionError={null}
        deleteWorkspaceErrors={{}}
        chat={<div>Chat panel</div>}
      />
    )

    expect(screen.getByText("Chat panel")).toBeInTheDocument()
    expect(
      screen.queryByText("No sessions in this workspace yet. Use the plus button in the top bar to create one.")
    ).not.toBeInTheDocument()
  })

  it("shows workspace-level errors", () => {
    render(
      <WorkspaceSessionsView
        selectedWorkspace={workspace}
        selectedWorkspaceChatId={null}
        createSessionError={"Cannot create"}
        deleteSessionError={"Delete failed"}
        deleteWorkspaceErrors={{ "workspace-1": "Cannot delete workspace" }}
        chat={<div>Chat panel</div>}
      />
    )

    expect(screen.getByText("Cannot create")).toBeInTheDocument()
    expect(screen.getByText("Delete failed")).toBeInTheDocument()
    expect(screen.getByText("Cannot delete workspace")).toBeInTheDocument()
  })

  it("shows empty state when no sessions are available", () => {
    render(
      <WorkspaceSessionsView
        selectedWorkspace={{ ...workspace, chats: [] }}
        selectedWorkspaceChatId={null}
        createSessionError={null}
        deleteSessionError={null}
        deleteWorkspaceErrors={{}}
        chat={<div>Chat panel</div>}
      />
    )

    expect(
      screen.getByText("No sessions in this workspace yet. Use the plus button in the top bar to create one.")
    ).toBeInTheDocument()
    expect(screen.queryByText("Chat panel")).not.toBeInTheDocument()
  })
})
