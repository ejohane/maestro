import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SidebarProvider } from "../../../components/ui/sidebar"
import { WorkbenchHeader } from "./workbench-header"
import type { ChatSession, Project, Workspace } from "../types"

const project: Project = {
  id: "project-1",
  name: "Core",
  repoPath: "/tmp/core",
  defaultBranch: "main",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-02T00:00:00Z",
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

const chat: ChatSession = {
  id: "chat-1",
  name: "Thread A",
}

const baseActions = () => ({
  onSelectProjectsView: vi.fn(),
  onSelectProject: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onCreateSession: vi.fn((event) => event.preventDefault()),
  onOpenCommandPalette: vi.fn(),
  onSelectWorkspaceChat: vi.fn(),
  onDeleteSession: vi.fn(),
  onDeleteWorkspace: vi.fn(),
})

describe("WorkbenchHeader", () => {
  it("renders settings breadcrumb when in settings view", () => {
    const actions = baseActions()

    render(
      <SidebarProvider>
        <WorkbenchHeader
          commandPaletteShortcutLabel="⌘K"
          isSettingsView
          isLoading={false}
          selectedProject={null}
          selectedWorkspace={null}
          selectedChat={null}
          workspaceActiveChatId={null}
          isCreatingSession={false}
          deletingSessionId={null}
          deletingWorkspace={{}}
          onSelectProjectsView={actions.onSelectProjectsView}
          onSelectProject={actions.onSelectProject}
          onSelectWorkspace={actions.onSelectWorkspace}
          onCreateSession={actions.onCreateSession}
          onOpenCommandPalette={actions.onOpenCommandPalette}
          onSelectWorkspaceChat={actions.onSelectWorkspaceChat}
          onDeleteSession={actions.onDeleteSession}
          onDeleteWorkspace={actions.onDeleteWorkspace}
        />
      </SidebarProvider>
    )

    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Create session" })).not.toBeInTheDocument()
  })

  it("navigates through breadcrumb interactions", () => {
    const actions = baseActions()

    render(
      <SidebarProvider>
        <WorkbenchHeader
          commandPaletteShortcutLabel="⌘K"
          isSettingsView={false}
          isLoading={false}
          selectedProject={project}
          selectedWorkspace={workspace}
          selectedChat={chat}
          workspaceActiveChatId={"chat-1"}
          isCreatingSession={false}
          deletingSessionId={null}
          deletingWorkspace={{}}
          onSelectProjectsView={actions.onSelectProjectsView}
          onSelectProject={actions.onSelectProject}
          onSelectWorkspace={actions.onSelectWorkspace}
          onCreateSession={actions.onCreateSession}
          onOpenCommandPalette={actions.onOpenCommandPalette}
          onSelectWorkspaceChat={actions.onSelectWorkspaceChat}
          onDeleteSession={actions.onDeleteSession}
          onDeleteWorkspace={actions.onDeleteWorkspace}
        />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    fireEvent.click(screen.getByRole("link", { name: "Core" }))
    fireEvent.click(screen.getByRole("link", { name: "Refactor" }))

    expect(actions.onSelectProjectsView).toHaveBeenCalledTimes(1)
    expect(actions.onSelectProject).toHaveBeenCalledWith("project-1")
    expect(actions.onSelectWorkspace).toHaveBeenCalledWith("project-1", "workspace-1")
  })

  it("renders workspace action controls in top bar", () => {
    const actions = baseActions()

    render(
      <SidebarProvider>
        <WorkbenchHeader
          commandPaletteShortcutLabel="⌘K"
          isSettingsView={false}
          isLoading={false}
          selectedProject={project}
          selectedWorkspace={workspace}
          selectedChat={chat}
          workspaceActiveChatId={"chat-1"}
          isCreatingSession={false}
          deletingSessionId={null}
          deletingWorkspace={{}}
          onSelectProjectsView={actions.onSelectProjectsView}
          onSelectProject={actions.onSelectProject}
          onSelectWorkspace={actions.onSelectWorkspace}
          onCreateSession={actions.onCreateSession}
          onOpenCommandPalette={actions.onOpenCommandPalette}
          onSelectWorkspaceChat={actions.onSelectWorkspaceChat}
          onDeleteSession={actions.onDeleteSession}
          onDeleteWorkspace={actions.onDeleteWorkspace}
        />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Create session" }))
    expect(actions.onCreateSession).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }))
    expect(actions.onOpenCommandPalette).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(screen.getByRole("button", { name: "Workspace options" }), {
      button: 0,
    })
    fireEvent.click(screen.getByRole("menuitem", { name: "Thread B" }))
    expect(actions.onSelectWorkspaceChat).toHaveBeenCalledWith("chat-2")

    fireEvent.pointerDown(screen.getByRole("button", { name: "Workspace options" }), {
      button: 0,
    })
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete active session" }))
    expect(actions.onDeleteSession).toHaveBeenCalledWith("chat-1")

    fireEvent.pointerDown(screen.getByRole("button", { name: "Workspace options" }), {
      button: 0,
    })
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete workspace" }))
    expect(actions.onDeleteWorkspace).toHaveBeenCalledWith("workspace-1", "Refactor")
  })
})
