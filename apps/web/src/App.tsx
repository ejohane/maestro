import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { AppSidebar } from "./components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb"
import { Badge } from "./components/ui/badge"
import { Button } from "./components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card"
import { Input } from "./components/ui/input"
import { Separator } from "./components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "./components/ui/sidebar"
import { useTheme } from "./hooks/use-theme"

type GitProvider = "github" | "gitlab"

type ApiProject = {
  id: string
  name: string
  icon?: string
  repoPath: string
  defaultBranch: string
  gitProvider?: GitProvider
  repoUrl?: string
  createdAt: string
  updatedAt: string
}

type ApiConversation = {
  id: string
  projectId: string
  title?: string
  branch: string
  workspacePath: string
  createdAt: string
  updatedAt: string
}

type ApiSession = {
  id: string
  conversationId: string
  title?: string
  model?: string
  createdAt: string
  updatedAt: string
}

type CreateConversationResponse = {
  project: ApiProject
  conversation: ApiConversation
  session: ApiSession
}

type ChatSession = {
  id: string
  name: string
}

type Workspace = {
  id: string
  name: string
  chats: ChatSession[]
}

type Project = {
  id: string
  name: string
  icon?: string
  repoPath: string
  defaultBranch: string
  gitProvider?: GitProvider
  repoUrl?: string
  createdAt: string
  updatedAt: string
  workspaces: Workspace[]
}

const App = () => {
  const { theme, toggleTheme } = useTheme()
  const [projects, setProjects] = React.useState<Project[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isProjectsView, setIsProjectsView] = React.useState(false)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    null
  )
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string | null>(
    null
  )
  const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null)
  const [projectForm, setProjectForm] = React.useState({
    name: "",
    repoPath: "",
    defaultBranch: "main",
    gitProvider: "",
    repoUrl: "",
  })
  const [isCreatingProject, setIsCreatingProject] = React.useState(false)
  const [isSelectingDirectory, setIsSelectingDirectory] = React.useState(false)
  const [createProjectError, setCreateProjectError] = React.useState<string | null>(
    null
  )
  const [workspaceForm, setWorkspaceForm] = React.useState({ title: "" })
  const [isCreatingWorkspace, setIsCreatingWorkspace] = React.useState(false)
  const [createWorkspaceError, setCreateWorkspaceError] = React.useState<string | null>(
    null
  )
  const [projectIconDraft, setProjectIconDraft] = React.useState("")
  const [isUpdatingProjectIcon, setIsUpdatingProjectIcon] = React.useState(false)
  const [projectIconError, setProjectIconError] = React.useState<string | null>(null)
  const [projectRepoForm, setProjectRepoForm] = React.useState({
    repoUrl: "",
    gitProvider: "",
  })
  const [isUpdatingProjectRepo, setIsUpdatingProjectRepo] = React.useState(false)
  const [projectRepoError, setProjectRepoError] = React.useState<string | null>(null)
  const [isDetectingRepo, setIsDetectingRepo] = React.useState(false)
  const [detectRepoError, setDetectRepoError] = React.useState<string | null>(null)
  const [isDeletingWorkspace, setIsDeletingWorkspace] = React.useState(false)
  const [deleteWorkspaceError, setDeleteWorkspaceError] = React.useState<string | null>(null)

  const loadProjects = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [projectsRes, conversationsRes] = await Promise.all([
        fetch("/api/projects?all=1"),
        fetch("/api/conversations"),
      ])
      if (!projectsRes.ok) {
        throw new Error("Failed to load projects.")
      }
      if (!conversationsRes.ok) {
        throw new Error("Failed to load workspaces.")
      }

      const apiProjects = (await projectsRes.json()) as ApiProject[]
      const conversations = (await conversationsRes.json()) as ApiConversation[]
      const sessionsResults = await Promise.all(
        conversations.map(async (conversation) => {
          const response = await fetch(
            `/api/conversations/${conversation.id}/sessions`
          )
          if (!response.ok) {
            return { conversationId: conversation.id, sessions: [] as ApiSession[] }
          }
          const sessions = (await response.json()) as ApiSession[]
          return { conversationId: conversation.id, sessions }
        })
      )

      const sessionsByConversation = new Map(
        sessionsResults.map((result) => [result.conversationId, result.sessions])
      )

      const nextProjects = apiProjects.map((project) => {
        const projectConversations = conversations.filter(
          (conversation) => conversation.projectId === project.id
        )
        const workspaces: Workspace[] = projectConversations.map((conversation) => {
          const workspaceLabelFromPath = conversation.workspacePath
            .split(/[\\/]/)
            .filter(Boolean)
            .pop()
          const workspaceName =
            conversation.title?.trim() ||
            workspaceLabelFromPath ||
            conversation.branch ||
            conversation.id
          const sessions = sessionsByConversation.get(conversation.id) ?? []
          return {
            id: conversation.id,
            name: workspaceName,
            chats: sessions.map((session) => ({
              id: session.id,
              name: session.title?.trim() || session.model || session.id,
            })),
          }
        })

        return {
          id: project.id,
          name: project.name,
          icon: project.icon,
          repoPath: project.repoPath,
          defaultBranch: project.defaultBranch,
          gitProvider: project.gitProvider,
          repoUrl: project.repoUrl,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          workspaces,
        }
      })

      setProjects(nextProjects)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects.")
      setProjects([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  React.useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(null)
      setSelectedWorkspaceId(null)
      setSelectedChatId(null)
      return
    }
    if (isProjectsView) {
      setSelectedProjectId(null)
      setSelectedWorkspaceId(null)
      setSelectedChatId(null)
      return
    }
    const project =
      projects.find((item) => item.id === selectedProjectId) ?? projects[0]
    const shouldSelectWorkspace =
      selectedWorkspaceId !== null ||
      selectedChatId !== null ||
      selectedProjectId === null
    const workspace = shouldSelectWorkspace
      ? project.workspaces.find((item) => item.id === selectedWorkspaceId) ??
        project.workspaces[0] ??
        null
      : null
    const chat = shouldSelectWorkspace
      ? workspace?.chats.find((item) => item.id === selectedChatId) ??
        workspace?.chats[0] ??
        null
      : null
    setSelectedProjectId(project.id)
    setSelectedWorkspaceId(workspace?.id ?? null)
    setSelectedChatId(chat?.id ?? null)
  }, [projects, isProjectsView])

  const selectedProject = React.useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const selectedWorkspace = React.useMemo(
    () =>
      selectedProject?.workspaces.find(
        (workspace) => workspace.id === selectedWorkspaceId
      ) ?? null,
    [selectedProject, selectedWorkspaceId]
  )
  const selectedChat = React.useMemo(
    () =>
      selectedWorkspace?.chats.find((chat) => chat.id === selectedChatId) ?? null,
    [selectedWorkspace, selectedChatId]
  )

  React.useEffect(() => {
    setProjectIconDraft(selectedProject?.icon ?? "")
    setProjectIconError(null)
  }, [selectedProject])

  React.useEffect(() => {
    setProjectRepoForm({
      repoUrl: selectedProject?.repoUrl ?? "",
      gitProvider: selectedProject?.gitProvider ?? "",
    })
    setProjectRepoError(null)
    setDetectRepoError(null)
  }, [selectedProject])

  React.useEffect(() => {
    setDeleteWorkspaceError(null)
  }, [selectedWorkspaceId])

  const handleSelectProjectsView = () => {
    setIsProjectsView(true)
    setSelectedProjectId(null)
    setSelectedWorkspaceId(null)
    setSelectedChatId(null)
  }

  const handleSelectProject = (projectId: string) => {
    setIsProjectsView(false)
    setSelectedProjectId(projectId)
    setSelectedWorkspaceId(null)
    setSelectedChatId(null)
  }

  const handleSelectWorkspace = (projectId: string, workspaceId: string) => {
    setIsProjectsView(false)
    setSelectedProjectId(projectId)
    setSelectedWorkspaceId(workspaceId)
    setSelectedChatId(null)
  }

  const handleSelectChat = (
    projectId: string,
    workspaceId: string,
    chatId: string
  ) => {
    setIsProjectsView(false)
    setSelectedProjectId(projectId)
    setSelectedWorkspaceId(workspaceId)
    setSelectedChatId(chatId)
  }

  const handleProjectFormChange = (field: keyof typeof projectForm) => {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value
      setProjectForm((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleProjectRepoFormChange = (field: keyof typeof projectRepoForm) => {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value
      setProjectRepoForm((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleWorkspaceFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setWorkspaceForm({ title: value })
  }

  const handleProjectIconChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectIconDraft(event.target.value)
  }

  const handleSelectDirectory = async () => {
    setIsSelectingDirectory(true)
    setCreateProjectError(null)
    try {
      const response = await fetch("/api/fs/select-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startPath: projectForm.repoPath || undefined }),
      })
      if (!response.ok) {
        let message = "Failed to select folder."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(message)
      }
      const payload = (await response.json()) as { path?: string }
      if (payload.path) {
        setProjectForm((prev) => ({ ...prev, repoPath: payload.path ?? "" }))
      }
    } catch (err) {
      setCreateProjectError(
        err instanceof Error ? err.message : "Failed to select folder."
      )
    } finally {
      setIsSelectingDirectory(false)
    }
  }

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = projectForm.name.trim()
    if (!name) {
      setCreateProjectError("Project name is required.")
      return
    }
    const defaultBranch = projectForm.defaultBranch.trim() || "main"
    const repoPath = projectForm.repoPath.trim()

    setIsCreatingProject(true)
    setCreateProjectError(null)
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          defaultBranch,
          repoPath: repoPath || undefined,
          gitProvider: projectForm.gitProvider || undefined,
          repoUrl: projectForm.repoUrl.trim() || undefined,
        }),
      })
      if (!response.ok) {
        let message = "Failed to create project."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(message)
      }
      const createdProject = (await response.json()) as ApiProject
      setProjectForm({
        name: "",
        repoPath: "",
        defaultBranch: defaultBranch,
        gitProvider: "",
        repoUrl: "",
      })
      setIsProjectsView(false)
      setSelectedProjectId(createdProject.id)
      setSelectedWorkspaceId(null)
      setSelectedChatId(null)
      await loadProjects()
    } catch (err) {
      setCreateProjectError(
        err instanceof Error ? err.message : "Failed to create project."
      )
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleCreateWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProject) {
      return
    }
    const title = workspaceForm.title.trim()
    setIsCreatingWorkspace(true)
    setCreateWorkspaceError(null)
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          title: title || undefined,
        }),
      })
      if (!response.ok) {
        let message = "Failed to create workspace."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(message)
      }
      const payload = (await response.json()) as CreateConversationResponse
      setWorkspaceForm({ title: "" })
      setIsProjectsView(false)
      setSelectedProjectId(payload.project.id)
      setSelectedWorkspaceId(payload.conversation.id)
      setSelectedChatId(payload.session.id)
      await loadProjects()
    } catch (err) {
      setCreateWorkspaceError(
        err instanceof Error ? err.message : "Failed to create workspace."
      )
    } finally {
      setIsCreatingWorkspace(false)
    }
  }

  const handleUpdateProjectIcon = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProject) {
      return
    }
    setIsUpdatingProjectIcon(true)
    setProjectIconError(null)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon: projectIconDraft.trim() || null }),
      })
      if (!response.ok) {
        let message = "Failed to update project icon."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(message)
      }
      await loadProjects()
    } catch (err) {
      setProjectIconError(
        err instanceof Error ? err.message : "Failed to update project icon."
      )
    } finally {
      setIsUpdatingProjectIcon(false)
    }
  }

  const handleUpdateProjectRepo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProject) {
      return
    }
    setIsUpdatingProjectRepo(true)
    setProjectRepoError(null)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: projectRepoForm.repoUrl.trim() || null,
          gitProvider: projectRepoForm.gitProvider || undefined,
        }),
      })
      if (!response.ok) {
        let message = "Failed to update repository settings."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(message)
      }
      await loadProjects()
    } catch (err) {
      setProjectRepoError(
        err instanceof Error ? err.message : "Failed to update repository settings."
      )
    } finally {
      setIsUpdatingProjectRepo(false)
    }
  }

  const handleDetectProjectRepo = async () => {
    if (!selectedProject) {
      return
    }
    setIsDetectingRepo(true)
    setDetectRepoError(null)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/detect-repo`, {
        method: "POST",
      })
      if (!response.ok) {
        let message = "Failed to detect repository metadata."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(message)
      }
      await loadProjects()
    } catch (err) {
      setDetectRepoError(
        err instanceof Error ? err.message : "Failed to detect repository metadata."
      )
    } finally {
      setIsDetectingRepo(false)
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!selectedProject || !selectedWorkspace) {
      return
    }
    const workspaceLabel = selectedWorkspace.name || selectedWorkspace.id
    const confirmed = window.confirm(
      `Delete workspace "${workspaceLabel}"? This removes the worktree and all sessions.`
    )
    if (!confirmed) {
      return
    }
    setIsDeletingWorkspace(true)
    setDeleteWorkspaceError(null)
    try {
      const response = await fetch(
        `/api/conversations/${selectedWorkspace.id}?confirm=true`,
        {
          method: "DELETE",
        }
      )
      if (!response.ok) {
        let message = "Failed to delete workspace."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(message)
      }
      setSelectedWorkspaceId(null)
      setSelectedChatId(null)
      await loadProjects()
    } catch (err) {
      setDeleteWorkspaceError(
        err instanceof Error ? err.message : "Failed to delete workspace."
      )
    } finally {
      setIsDeletingWorkspace(false)
    }
  }

  const formatDate = (value?: string) => {
    if (!value) {
      return "Unknown"
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return "Unknown"
    }
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date)
  }

  const isProjectView = Boolean(
    selectedProject && !selectedWorkspace && !selectedChat && !isProjectsView
  )
  const isWorkspaceView = Boolean(selectedWorkspace && !selectedChat)
  const isChatView = Boolean(selectedChat)
  const projectIconValue = selectedProject?.icon?.trim() ?? ""
  const projectIconPreview =
    projectIconDraft.trim() || selectedProject?.name?.slice(0, 1).toUpperCase() || "?"
  const projectIconDirty = projectIconDraft.trim() !== projectIconValue
  const projectRepoUrlValue = selectedProject?.repoUrl?.trim() ?? ""
  const projectRepoProviderValue = selectedProject?.gitProvider ?? ""
  const projectRepoDirty =
    projectRepoForm.repoUrl.trim() !== projectRepoUrlValue ||
    projectRepoForm.gitProvider !== projectRepoProviderValue

  const viewLabel = isChatView
    ? "Chat Session"
    : isWorkspaceView
      ? "Workspace"
      : isProjectView
        ? "Project"
        : "Home"
  const viewTitle = isProjectsView
    ? "Home"
    : selectedChat?.name ??
      selectedWorkspace?.name ??
      selectedProject?.name ??
      (isLoading ? "Syncing projects" : "Choose a project")
  const viewDescription = isProjectsView
    ? "Home for your projects, new work, and recent workspaces."
    : selectedChat
      ? `Workspace in ${selectedWorkspace?.name ?? "workspace"}.`
      : selectedWorkspace
        ? "Workspace activity, members, and recent sessions."
        : selectedProject
          ? `Repo: ${selectedProject.repoUrl?.trim() || selectedProject.repoPath}`
          : isLoading
            ? "Fetching projects, workspaces, and sessions."
            : error
              ? error
              : "Select a project to explore its workspaces."

  const secondaryTitle = isChatView
    ? "Workspace context"
    : isWorkspaceView
      ? "Chat sessions"
      : isProjectView
        ? "Workspaces"
        : "Projects"
  const secondaryItems = isLoading
    ? ["Loading projects..."]
    : error
      ? ["Unable to load projects."]
      : isChatView
        ? [
            selectedProject?.name ?? "",
            selectedWorkspace?.name ?? "",
          ].filter(Boolean)
        : isWorkspaceView
          ? selectedWorkspace?.chats.map((chat) => chat.name) ?? []
          : isProjectView
            ? selectedProject?.workspaces.map((workspace) => workspace.name) ?? []
            : projects.map((project) => project.name)
  const showWorkspaceCreator = Boolean(isProjectView && selectedProject)
  const projectRepoLabel = selectedProject?.repoUrl?.trim() || selectedProject?.repoPath
  const projectRepoHref =
    selectedProject?.repoUrl?.trim() && selectedProject.repoUrl.trim().startsWith("http")
      ? selectedProject.repoUrl.trim()
      : null
  return (
    <SidebarProvider>
      <AppSidebar
        projects={projects}
        isProjectsView={isProjectsView}
        selectedProjectId={selectedProjectId}
        selectedWorkspaceId={selectedWorkspaceId}
        selectedChatId={selectedChatId}
        onSelectProjects={handleSelectProjectsView}
        onSelectProject={handleSelectProject}
        onSelectWorkspace={handleSelectWorkspace}
        onSelectChat={handleSelectChat}
      />
      <SidebarRail />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {selectedProject ? (
                  <BreadcrumbLink
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      handleSelectProjectsView()
                    }}
                  >
                    Home
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>Home</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {selectedProject && !isLoading ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {selectedWorkspace || selectedChat ? (
                      <BreadcrumbLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          handleSelectProject(selectedProject.id)
                        }}
                      >
                        {selectedProject.name}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{selectedProject.name}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </>
              ) : null}
              {selectedWorkspace && !isLoading ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {selectedChat ? (
                      <BreadcrumbLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (!selectedProject) {
                            return
                          }
                          handleSelectWorkspace(selectedProject.id, selectedWorkspace.id)
                        }}
                      >
                        {selectedWorkspace.name}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{selectedWorkspace.name}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </>
              ) : null}
              {selectedChat && !isLoading ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedChat.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span className="sr-only">Toggle dark mode</span>
            </Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {viewLabel}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-2xl font-semibold text-foreground">
              {isProjectView && projectIconValue ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                  {projectIconValue}
                </div>
              ) : null}
              <span>{viewTitle}</span>
            </div>
            <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {viewDescription}
            </div>
            {isProjectView && selectedProject ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Repository</span>
                {projectRepoHref ? (
                  <a
                    className="font-medium text-primary hover:underline"
                    href={projectRepoHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open repo
                  </a>
                ) : (
                  <span className="text-foreground">{projectRepoLabel}</span>
                )}
                {selectedProject.gitProvider ? (
                  <Badge variant="secondary">
                    {selectedProject.gitProvider === "github" ? "GitHub" : "GitLab"}
                  </Badge>
                ) : null}
              </div>
            ) : null}
            {isWorkspaceView ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteWorkspace}
                  disabled={isDeletingWorkspace}
                >
                  {isDeletingWorkspace ? "Deleting workspace..." : "Delete workspace"}
                </Button>
                {deleteWorkspaceError ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {deleteWorkspaceError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {isProjectsView ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card className="border-dashed">
                <form onSubmit={handleCreateProject}>
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
                        onChange={handleProjectFormChange("name")}
                        placeholder="e.g. Marketing site"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Repo path
                      </label>
                      <Input
                        value={projectForm.repoPath}
                        onChange={handleProjectFormChange("repoPath")}
                        placeholder="/path/to/repo (optional)"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Repo URL
                      </label>
                      <Input
                        value={projectForm.repoUrl}
                        onChange={handleProjectFormChange("repoUrl")}
                        placeholder="https://github.com/org/repo (optional)"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Git provider
                      </label>
                      <select
                        value={projectForm.gitProvider}
                        onChange={handleProjectFormChange("gitProvider")}
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
                        onChange={handleProjectFormChange("defaultBranch")}
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
                      onClick={handleSelectDirectory}
                      disabled={isSelectingDirectory}
                    >
                      {isSelectingDirectory ? "Selecting folder..." : "Select folder"}
                    </Button>
                    <Button
                      type="submit"
                      disabled={!projectForm.name.trim() || isCreatingProject}
                    >
                      {isCreatingProject ? "Creating project..." : "Create project"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
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
                      onClick={() => handleSelectProject(project.id)}
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
                            <span className="font-medium text-foreground">
                              {project.workspaces.length}
                            </span>{" "}
                            workspaces
                          </div>
                          <div>
                            Default branch: {project.defaultBranch || "main"}
                          </div>
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
            </div>
          ) : showWorkspaceCreator ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="grid gap-4">
                <Card className="border-dashed">
                  <form onSubmit={handleCreateWorkspace}>
                    <CardHeader>
                      <CardTitle>Create a new workspace</CardTitle>
                      <CardDescription>
                        Spin up a fresh worktree and start a new chat session.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <div className="grid gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Workspace name
                        </label>
                        <Input
                          value={workspaceForm.title}
                          onChange={handleWorkspaceFormChange}
                          placeholder="e.g. Feature branch review"
                        />
                      </div>
                      {createWorkspaceError ? (
                        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {createWorkspaceError}
                        </div>
                      ) : null}
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" disabled={isCreatingWorkspace}>
                        {isCreatingWorkspace
                          ? "Creating workspace..."
                          : "Create workspace"}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
                <Card>
                  <form onSubmit={handleUpdateProjectIcon}>
                    <CardHeader>
                      <CardTitle>Project settings</CardTitle>
                      <CardDescription>
                        Update the icon that represents this project.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted text-xl">
                          {projectIconPreview}
                        </div>
                        <div className="grid flex-1 gap-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Project icon
                          </label>
                          <Input
                            value={projectIconDraft}
                            onChange={handleProjectIconChange}
                            placeholder="Short label"
                          />
                          <div className="text-xs text-muted-foreground">
                            Use an emoji or short text. Leave blank to clear.
                          </div>
                        </div>
                      </div>
                      {projectIconError ? (
                        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {projectIconError}
                        </div>
                      ) : null}
                    </CardContent>
                    <CardFooter className="flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        disabled={!projectIconDirty || isUpdatingProjectIcon}
                      >
                        {isUpdatingProjectIcon ? "Saving icon..." : "Save icon"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setProjectIconDraft(projectIconValue)}
                        disabled={!projectIconDirty || isUpdatingProjectIcon}
                      >
                        Reset
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
                <Card>
                  <form onSubmit={handleUpdateProjectRepo}>
                    <CardHeader>
                      <CardTitle>Repository settings</CardTitle>
                      <CardDescription>
                        Link this project to a GitHub or GitLab repository.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <div className="grid gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Repo URL
                        </label>
                        <Input
                          value={projectRepoForm.repoUrl}
                          onChange={handleProjectRepoFormChange("repoUrl")}
                          placeholder="https://github.com/org/repo"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Git provider
                        </label>
                        <select
                          value={projectRepoForm.gitProvider}
                          onChange={handleProjectRepoFormChange("gitProvider")}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        >
                          <option value="">Auto-detect</option>
                          <option value="github">GitHub</option>
                          <option value="gitlab">GitLab</option>
                        </select>
                      </div>
                      {projectRepoError ? (
                        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {projectRepoError}
                        </div>
                      ) : null}
                      {detectRepoError ? (
                        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {detectRepoError}
                        </div>
                      ) : null}
                    </CardContent>
                    <CardFooter className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDetectProjectRepo}
                        disabled={isDetectingRepo || isUpdatingProjectRepo}
                      >
                        {isDetectingRepo ? "Detecting..." : "Detect from package.json"}
                      </Button>
                      <Button
                        type="submit"
                        disabled={!projectRepoDirty || isUpdatingProjectRepo}
                      >
                        {isUpdatingProjectRepo ? "Saving..." : "Save repo settings"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setProjectRepoForm({
                            repoUrl: projectRepoUrlValue,
                            gitProvider: projectRepoProviderValue,
                          })
                        }
                        disabled={!projectRepoDirty || isUpdatingProjectRepo}
                      >
                        Reset
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </div>
              <div className="rounded-xl border bg-background p-6">
                <div className="text-sm font-semibold text-foreground">
                  {secondaryTitle}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {secondaryItems.length ? (
                    secondaryItems.map((item) => (
                      <div
                        key={item}
                        className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-foreground"
                      >
                        {item}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      Nothing to show yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-background p-6">
              <div className="text-sm font-semibold text-foreground">
                {secondaryTitle}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {secondaryItems.length ? (
                  secondaryItems.map((item) => (
                    <div
                      key={item}
                      className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-foreground"
                    >
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    Nothing to show yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
