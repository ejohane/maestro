import * as React from "react"

import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import { Input } from "../../../components/ui/input"
import type { OpenPullRequest, Project, ProjectFormState, WorkspaceSummary } from "../types"

type ProjectsViewProps = {
  projectForm: ProjectFormState
  createProjectError: string | null
  isCreatingProject: boolean
  isSelectingDirectory: boolean
  allWorkspaces: WorkspaceSummary[]
  projects: Project[]
  isLoading: boolean
  error: string | null
  sortedPullRequests: OpenPullRequest[]
  hasRepoProjects: boolean
  isLoadingPullRequests: boolean
  pullRequestsError: string | null
  formatDate: (value?: string) => string
  formatDateTime: (value?: string) => string
  onCreateProject: (event: React.FormEvent<HTMLFormElement>) => void
  onProjectFormChange: (
    field: keyof ProjectFormState
  ) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onSelectDirectory: () => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onSelectProject: (projectId: string) => void
}

export const ProjectsView = ({
  projectForm,
  createProjectError,
  isCreatingProject,
  isSelectingDirectory,
  allWorkspaces,
  projects,
  isLoading,
  error,
  sortedPullRequests,
  hasRepoProjects,
  isLoadingPullRequests,
  pullRequestsError,
  formatDate,
  formatDateTime,
  onCreateProject,
  onProjectFormChange,
  onSelectDirectory,
  onSelectWorkspace,
  onSelectProject,
}: ProjectsViewProps) => {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="grid gap-4">
        <Card className="border-dashed">
          <form onSubmit={onCreateProject}>
            <CardHeader>
              <CardTitle>Create a new project</CardTitle>
              <CardDescription>
                Connect a repo, set the default branch, and start a workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Project name
                </label>
                <Input
                  value={projectForm.name}
                  onChange={onProjectFormChange("name")}
                  placeholder="e.g. Marketing site"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Repo path
                </label>
                <Input
                  value={projectForm.repoPath}
                  onChange={onProjectFormChange("repoPath")}
                  placeholder="/path/to/repo (optional)"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Repo URL
                </label>
                <Input
                  value={projectForm.repoUrl}
                  onChange={onProjectFormChange("repoUrl")}
                  placeholder="https://github.com/org/repo (optional)"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Git provider
                </label>
                <select
                  value={projectForm.gitProvider}
                  onChange={onProjectFormChange("gitProvider")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Auto-detect</option>
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Default branch
                </label>
                <Input
                  value={projectForm.defaultBranch}
                  onChange={onProjectFormChange("defaultBranch")}
                  placeholder="main"
                />
              </div>
              {createProjectError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {createProjectError}
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onSelectDirectory}
                disabled={isSelectingDirectory}
              >
                {isSelectingDirectory ? "Selecting folder..." : "Select folder"}
              </Button>
              <Button type="submit" disabled={!projectForm.name.trim() || isCreatingProject}>
                {isCreatingProject ? "Creating project..." : "Create project"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>All workspaces</CardTitle>
            <CardDescription>
              Active workspaces across every project.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {allWorkspaces.length ? (
              allWorkspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => onSelectWorkspace(workspace.projectId, workspace.id)}
                  className="rounded-lg border bg-muted/20 px-4 py-3 text-left transition hover:border-primary/60 hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {workspace.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{workspace.projectName}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDateTime(workspace.updatedAt)}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                No workspaces yet. Create one from a project.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {isLoading ? (
            <Card className="flex items-center justify-center border-dashed p-6 text-sm text-muted-foreground">
              Loading projects...
            </Card>
          ) : error ? (
            <Card className="flex items-center justify-center border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
              {error}
            </Card>
          ) : projects.length ? (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project.id)}
                className="text-left"
              >
                <Card className="h-full transition hover:border-primary/60 hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {project.icon ? (
                        <span className="text-xl leading-none">{project.icon}</span>
                      ) : null}
                      <span>{project.name}</span>
                    </CardTitle>
                    <CardDescription className="truncate">
                      {project.repoUrl?.trim() || project.repoPath}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">{project.workspaces.length}</span>{" "}
                      workspaces
                    </div>
                    <div>Default branch: {project.defaultBranch || "main"}</div>
                    <div>Updated {formatDate(project.updatedAt)}</div>
                  </CardContent>
                </Card>
              </button>
            ))
          ) : (
            <Card className="flex items-center justify-center border-dashed p-6 text-sm text-muted-foreground">
              No projects yet. Create your first one.
            </Card>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Open PRs and MRs</CardTitle>
            <CardDescription>
              Pull requests for GitHub repos and merge requests for GitLab.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {isLoadingPullRequests ? (
              <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Loading open pull requests...
              </div>
            ) : pullRequestsError ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {pullRequestsError}
              </div>
            ) : sortedPullRequests.length ? (
              sortedPullRequests.map((item) => (
                <a
                  key={`${item.projectId}-${item.id}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border bg-muted/20 px-4 py-3 transition hover:border-primary/60 hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <Badge variant="secondary">
                      {item.provider === "github" ? "PR" : "MR"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.projectName} · {item.repo}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {item.author ? `@${item.author}` : "Unknown author"}
                    {item.sourceBranch && item.targetBranch
                      ? `${item.sourceBranch} → ${item.targetBranch}`
                      : null}
                    <span>Updated {formatDateTime(item.updatedAt)}</span>
                  </div>
                </a>
              ))
            ) : hasRepoProjects ? (
              <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                No open pull requests right now.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Add a repo URL to projects to see open PRs or MRs here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
