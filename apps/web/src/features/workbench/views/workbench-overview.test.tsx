import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkbenchOverview } from "./workbench-overview"
import type { Project, Workspace } from "../types"

const project: Project = {
  id: "project-1",
  name: "Core",
  repoPath: "/tmp/core",
  repoUrl: "https://github.com/example/core",
  gitProvider: "github",
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

describe("WorkbenchOverview", () => {
  it("renders project repository context and recent sessions", () => {
    const onSelectChat = vi.fn()

    render(
      <WorkbenchOverview
        isProjectView
        isWorkspaceView={false}
        selectedProject={project}
        selectedWorkspace={null}
        projectIconValue="M"
        viewLabel="Project"
        viewTitle="Core"
        viewDescription="Core description"
        projectRepoLabel={project.repoPath}
        projectRepoHref={project.repoUrl}
        deletingWorkspace={{}}
        deleteWorkspaceErrors={{}}
        recentSessionsLimit={6}
        recentSessionsForView={[
          {
            id: "chat-1",
            name: "Session A",
            projectId: "project-1",
            projectName: "Core",
            workspaceId: "workspace-1",
            workspaceName: "Refactor",
            updatedAt: "2025-01-02T12:00:00Z",
          },
        ]}
        formatDateTime={() => "Jan 2, 12:00 PM"}
        onDeleteWorkspace={vi.fn()}
        onSelectChat={onSelectChat}
      />
    )

    expect(screen.getByText("Open repo")).toHaveAttribute(
      "href",
      "https://github.com/example/core"
    )
    expect(screen.getByText("GitHub")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Session A/ }))
    expect(onSelectChat).toHaveBeenCalledWith("project-1", "workspace-1", "chat-1")
  })

  it("allows deleting current workspace in workspace view", () => {
    const onDeleteWorkspace = vi.fn()

    render(
      <WorkbenchOverview
        isProjectView={false}
        isWorkspaceView
        selectedProject={null}
        selectedWorkspace={workspace}
        projectIconValue=""
        viewLabel="Workspace"
        viewTitle="Refactor"
        viewDescription="Workspace description"
        deletingWorkspace={{}}
        deleteWorkspaceErrors={{}}
        recentSessionsLimit={6}
        recentSessionsForView={[]}
        formatDateTime={() => "Just now"}
        onDeleteWorkspace={onDeleteWorkspace}
        onSelectChat={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }))
    expect(onDeleteWorkspace).toHaveBeenCalledWith("workspace-1", "Refactor")
  })
})
