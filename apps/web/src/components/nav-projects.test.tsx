import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { NavProjects } from "./nav-projects"
import { SidebarProvider } from "./ui/sidebar"

const projects = [
  {
    id: "project-1",
    name: "Core",
    repoPath: "/tmp/core",
    defaultBranch: "main",
    workspaces: [
      {
        id: "workspace-old",
        name: "Older workspace",
        chats: [
          {
            id: "chat-old",
            name: "Legacy",
            updatedAt: "2025-01-01T10:00:00Z",
          },
        ],
        updatedAt: "2025-01-01T09:00:00Z",
      },
      {
        id: "workspace-new",
        name: "Newest workspace",
        chats: [],
        updatedAt: "2025-01-02T12:00:00Z",
      },
    ],
  },
]

type RenderOptions = {
  selectedProjectId?: string | null
  selectedWorkspaceId?: string | null
  activeWorkspaceIds?: string[]
}

const renderNavProjects = (options: RenderOptions = {}) => {
  const onSelectProject = vi.fn()
  const onSelectWorkspace = vi.fn()
  const onCreateProject = vi.fn()
  const onCreateWorkspace = vi.fn()

  render(
    <SidebarProvider>
      <NavProjects
        projects={projects}
        isProjectsView={false}
        selectedProjectId={options.selectedProjectId ?? null}
        selectedWorkspaceId={options.selectedWorkspaceId ?? null}
        onSelectProject={onSelectProject}
        onSelectWorkspace={onSelectWorkspace}
        onCreateProject={onCreateProject}
        onCreateWorkspace={onCreateWorkspace}
        activeWorkspaceIds={options.activeWorkspaceIds ?? []}
      />
    </SidebarProvider>
  )

  return { onSelectProject, onSelectWorkspace, onCreateProject, onCreateWorkspace }
}

describe("NavProjects", () => {
  it("shows projects/workspaces hierarchy open by default and sorts workspaces by recency", () => {
    renderNavProjects()

    expect(screen.getByText("Projects")).toBeInTheDocument()
    const workspaceButtons = screen.getAllByRole("button", { name: /Open workspace/ })
    expect(workspaceButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Open workspace Newest workspace",
      "Open workspace Older workspace",
    ])
  })

  it("wires project/workspace navigation and hover actions", () => {
    const { onSelectProject, onSelectWorkspace, onCreateProject, onCreateWorkspace } =
      renderNavProjects()

    fireEvent.click(screen.getByRole("button", { name: "Open project Core" }))
    fireEvent.click(screen.getByRole("button", { name: "Open workspace Newest workspace" }))
    fireEvent.click(screen.getByRole("button", { name: "Add workspace to Core" }))
    fireEvent.click(screen.getByRole("button", { name: "Add project" }))

    expect(onSelectProject).toHaveBeenCalledWith("project-1")
    expect(onSelectWorkspace).toHaveBeenCalledWith("project-1", "workspace-new")
    expect(onCreateWorkspace).toHaveBeenCalledWith("project-1")
    expect(onCreateProject).toHaveBeenCalledTimes(1)
  })

  it("shows a spinner for workspaces with active conversations", () => {
    renderNavProjects({ activeWorkspaceIds: ["workspace-new"] })

    expect(
      screen.getByLabelText("Active conversation in Newest workspace")
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Active conversation in Older workspace")
    ).not.toBeInTheDocument()
  })
})
