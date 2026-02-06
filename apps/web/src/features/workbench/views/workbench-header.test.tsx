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
  chats: [],
}

const chat: ChatSession = {
  id: "chat-1",
  name: "Thread A",
}

describe("WorkbenchHeader", () => {
  it("renders settings breadcrumb when in settings view", () => {
    render(
      <SidebarProvider>
        <WorkbenchHeader
          isSettingsView
          isLoading={false}
          selectedProject={null}
          selectedWorkspace={null}
          selectedChat={null}
          onSelectProjectsView={vi.fn()}
          onSelectProject={vi.fn()}
          onSelectWorkspace={vi.fn()}
        />
      </SidebarProvider>
    )

    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("navigates through breadcrumb interactions", () => {
    const onSelectProjectsView = vi.fn()
    const onSelectProject = vi.fn()
    const onSelectWorkspace = vi.fn()

    render(
      <SidebarProvider>
        <WorkbenchHeader
          isSettingsView={false}
          isLoading={false}
          selectedProject={project}
          selectedWorkspace={workspace}
          selectedChat={chat}
          onSelectProjectsView={onSelectProjectsView}
          onSelectProject={onSelectProject}
          onSelectWorkspace={onSelectWorkspace}
        />
      </SidebarProvider>
    )

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    fireEvent.click(screen.getByRole("link", { name: "Core" }))
    fireEvent.click(screen.getByRole("link", { name: "Refactor" }))

    expect(onSelectProjectsView).toHaveBeenCalledTimes(1)
    expect(onSelectProject).toHaveBeenCalledWith("project-1")
    expect(onSelectWorkspace).toHaveBeenCalledWith("project-1", "workspace-1")
  })
})
