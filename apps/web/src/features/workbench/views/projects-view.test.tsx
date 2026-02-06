import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ProjectsView } from "./projects-view"
import type { OpenPullRequest, Project, ProjectFormState, WorkspaceSummary } from "../types"

const projectForm: ProjectFormState = {
  name: "Core",
  repoPath: "/tmp/core",
  defaultBranch: "main",
  gitProvider: "github",
  repoUrl: "https://github.com/example/core",
}

const projects: Project[] = [
  {
    id: "project-1",
    name: "Core",
    icon: "M",
    repoPath: "/tmp/core",
    repoUrl: "https://github.com/example/core",
    defaultBranch: "main",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
    workspaces: [{ id: "workspace-1", name: "Refactor", chats: [] }],
  },
]

const workspaces: WorkspaceSummary[] = [
  {
    id: "workspace-1",
    name: "Refactor",
    projectId: "project-1",
    projectName: "Core",
    updatedAt: "2026-01-03T10:00:00Z",
  },
]

const pullRequests: OpenPullRequest[] = [
  {
    id: "pr-1",
    number: "11",
    title: "Improve UI",
    url: "https://example.com/pr/11",
    provider: "github",
    repo: "core",
    projectId: "project-1",
    projectName: "Core",
    author: "erik",
    sourceBranch: "feature/ui",
    targetBranch: "main",
    updatedAt: "2026-01-03T08:00:00Z",
  },
]

describe("ProjectsView", () => {
  it("renders data state and wires interactions", () => {
    const onCreateProject = vi.fn((event) => event.preventDefault())
    const onSelectDirectory = vi.fn()
    const onSelectWorkspace = vi.fn()
    const onSelectProject = vi.fn()

    const onProjectFormChange = vi.fn((field: keyof ProjectFormState) =>
      vi.fn((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => event)
    )

    render(
      <ProjectsView
        projectForm={projectForm}
        createProjectError={null}
        isCreatingProject={false}
        isSelectingDirectory={false}
        allWorkspaces={workspaces}
        projects={projects}
        isLoading={false}
        error={null}
        sortedPullRequests={pullRequests}
        hasRepoProjects
        isLoadingPullRequests={false}
        pullRequestsError={null}
        formatDate={() => "Jan 3, 2026"}
        formatDateTime={() => "Jan 3, 10:00 AM"}
        onCreateProject={onCreateProject}
        onProjectFormChange={onProjectFormChange}
        onSelectDirectory={onSelectDirectory}
        onSelectWorkspace={onSelectWorkspace}
        onSelectProject={onSelectProject}
      />
    )

    fireEvent.submit(screen.getByRole("button", { name: "Create project" }).closest("form")!)
    fireEvent.click(screen.getByRole("button", { name: "Select folder" }))
    fireEvent.click(screen.getByRole("button", { name: /Refactor.*Updated Jan 3, 10:00 AM/ }))
    fireEvent.click(screen.getByRole("button", { name: /Default branch: main/ }))

    fireEvent.change(screen.getByPlaceholderText("main"), { target: { value: "develop" } })

    expect(onCreateProject).toHaveBeenCalled()
    expect(onSelectDirectory).toHaveBeenCalled()
    expect(onSelectWorkspace).toHaveBeenCalledWith("project-1", "workspace-1")
    expect(onSelectProject).toHaveBeenCalledWith("project-1")
    expect(onProjectFormChange).toHaveBeenCalledWith("defaultBranch")
    expect(screen.getByRole("link", { name: /Improve UI/ })).toHaveAttribute(
      "href",
      "https://example.com/pr/11"
    )
  })

  it("renders loading/error/empty variants", () => {
    const { rerender } = render(
      <ProjectsView
        projectForm={{ ...projectForm, name: "" }}
        createProjectError={"Missing name"}
        isCreatingProject
        isSelectingDirectory
        allWorkspaces={[]}
        projects={[]}
        isLoading
        error={null}
        sortedPullRequests={[]}
        hasRepoProjects={false}
        isLoadingPullRequests
        pullRequestsError={null}
        formatDate={() => "date"}
        formatDateTime={() => "datetime"}
        onCreateProject={vi.fn()}
        onProjectFormChange={() => vi.fn()}
        onSelectDirectory={vi.fn()}
        onSelectWorkspace={vi.fn()}
        onSelectProject={vi.fn()}
      />
    )

    expect(screen.getByText("Missing name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Selecting folder..." })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Creating project..." })).toBeDisabled()
    expect(screen.getByText("Loading projects...")).toBeInTheDocument()
    expect(screen.getByText("Loading open pull requests...")).toBeInTheDocument()

    rerender(
      <ProjectsView
        projectForm={{ ...projectForm, name: "" }}
        createProjectError={null}
        isCreatingProject={false}
        isSelectingDirectory={false}
        allWorkspaces={[]}
        projects={[]}
        isLoading={false}
        error={"Unable to load"}
        sortedPullRequests={[]}
        hasRepoProjects={false}
        isLoadingPullRequests={false}
        pullRequestsError={"PR fetch failed"}
        formatDate={() => "date"}
        formatDateTime={() => "datetime"}
        onCreateProject={vi.fn()}
        onProjectFormChange={() => vi.fn()}
        onSelectDirectory={vi.fn()}
        onSelectWorkspace={vi.fn()}
        onSelectProject={vi.fn()}
      />
    )

    expect(screen.getByText("Unable to load")).toBeInTheDocument()
    expect(screen.getByText("PR fetch failed")).toBeInTheDocument()
    expect(screen.getByText("No workspaces yet. Create one from a project.")).toBeInTheDocument()
  })
})
