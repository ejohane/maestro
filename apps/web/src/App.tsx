import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { AppSidebar } from "./components/app-sidebar"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./components/ai-elements/conversation"
import { Loader } from "./components/ai-elements/loader"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "./components/ai-elements/message"
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./components/ai-elements/prompt-input"
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

type ApiPullRequest = {
  id: string
  title: string
  url: string
  author?: string
  sourceBranch?: string
  targetBranch?: string
  updatedAt?: string
  provider: GitProvider
  repo: string
}

type ApiTranscriptEntry = {
  role: "user" | "assistant" | "system"
  content: string
}

type CreateConversationResponse = {
  project: ApiProject
  conversation: ApiConversation
  session: ApiSession
}

type ChatSession = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

type Workspace = {
  id: string
  name: string
  chats: ChatSession[]
  createdAt?: string
  updatedAt?: string
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

type RecentSession = {
  id: string
  name: string
  projectId: string
  projectName: string
  workspaceId: string
  workspaceName: string
  updatedAt?: string
}

type OpenPullRequest = ApiPullRequest & {
  projectId: string
  projectName: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  isStreaming?: boolean
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
  const [sessionForm, setSessionForm] = React.useState({ title: "" })
  const [isCreatingSession, setIsCreatingSession] = React.useState(false)
  const [createSessionError, setCreateSessionError] = React.useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = React.useState<string | null>(null)
  const [deleteSessionError, setDeleteSessionError] = React.useState<string | null>(null)
  const [isDeletingWorkspace, setIsDeletingWorkspace] = React.useState(false)
  const [deleteWorkspaceError, setDeleteWorkspaceError] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [chatStatus, setChatStatus] = React.useState<"idle" | "streaming" | "error">(
    "idle"
  )
  const [chatError, setChatError] = React.useState<string | null>(null)
  const [promptValue, setPromptValue] = React.useState("")
  const [isTranscriptLoading, setIsTranscriptLoading] = React.useState(false)
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = React.useState(false)
  const [showScrollButton, setShowScrollButton] = React.useState(false)
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
  const streamAbortRef = React.useRef<AbortController | null>(null)
  const transcriptAbortRef = React.useRef<AbortController | null>(null)
  const autoScrollRef = React.useRef(true)
  const [openPullRequests, setOpenPullRequests] = React.useState<OpenPullRequest[]>([])
  const [isLoadingPullRequests, setIsLoadingPullRequests] = React.useState(false)
  const [pullRequestsError, setPullRequestsError] = React.useState<string | null>(null)
  const recentSessionsLimit = 6

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
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
            })),
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
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

  const recentSessions = React.useMemo(() => {
    const sessions: RecentSession[] = []
    projects.forEach((project) => {
      project.workspaces.forEach((workspace) => {
        workspace.chats.forEach((chat) => {
          sessions.push({
            id: chat.id,
            name: chat.name,
            projectId: project.id,
            projectName: project.name,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            updatedAt: chat.updatedAt ?? chat.createdAt,
          })
        })
      })
    })
    return sessions
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
      .slice(0, recentSessionsLimit)
  }, [projects, recentSessionsLimit])

  const projectRecentSessions = React.useMemo(() => {
    if (!selectedProject) {
      return [] as RecentSession[]
    }
    const sessions: RecentSession[] = []
    selectedProject.workspaces.forEach((workspace) => {
      workspace.chats.forEach((chat) => {
        sessions.push({
          id: chat.id,
          name: chat.name,
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          updatedAt: chat.updatedAt ?? chat.createdAt,
        })
      })
    })
    return sessions
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
      .slice(0, recentSessionsLimit)
  }, [selectedProject, recentSessionsLimit])

  const allWorkspaces = React.useMemo(() => {
    return projects
      .flatMap((project) =>
        project.workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          projectId: project.id,
          projectName: project.name,
          updatedAt: workspace.updatedAt ?? workspace.createdAt,
        }))
      )
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
  }, [projects])

  const sortedPullRequests = React.useMemo(() => {
    return [...openPullRequests].sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bTime - aTime
    })
  }, [openPullRequests])

  const projectPullRequests = React.useMemo(() => {
    if (!selectedProject) {
      return [] as OpenPullRequest[]
    }
    return sortedPullRequests.filter((item) => item.projectId === selectedProject.id)
  }, [sortedPullRequests, selectedProject])

  const hasRepoProjects = React.useMemo(
    () => projects.some((project) => project.repoUrl?.trim()),
    [projects]
  )
  const hasRepoProject = Boolean(selectedProject?.repoUrl?.trim())
  const createLocalMessageId = React.useCallback(() => {
    return `m_${Math.random().toString(36).slice(2, 10)}`
  }, [])

  const scrollToBottom = React.useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }
    container.scrollTop = container.scrollHeight
  }, [])

  const handleScroll = React.useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    const shouldAutoScroll = distanceFromBottom < 32
    autoScrollRef.current = shouldAutoScroll
    setShowScrollButton(!shouldAutoScroll)
  }, [])

  React.useEffect(() => {
    streamAbortRef.current?.abort()
    transcriptAbortRef.current?.abort()
    setMessages([])
    setPromptValue("")
    setChatStatus("idle")
    setChatError(null)
    setIsAwaitingFirstToken(false)
    setShowScrollButton(false)
    autoScrollRef.current = true
    const conversationId = selectedWorkspace?.id
    const sessionId = selectedChat?.id
    if (!conversationId || !sessionId) {
      setIsTranscriptLoading(false)
      return
    }
    const controller = new AbortController()
    transcriptAbortRef.current = controller
    setIsTranscriptLoading(true)
    fetch(`/api/conversations/${conversationId}/sessions/${sessionId}/transcript`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load transcript.")
        }
        const transcript = (await response.json()) as ApiTranscriptEntry[]
        setMessages(
          transcript.map((entry) => ({
            id: createLocalMessageId(),
            role: entry.role,
            content: entry.content,
          }))
        )
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return
        }
        setChatError(err instanceof Error ? err.message : "Failed to load transcript.")
        setMessages([])
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsTranscriptLoading(false)
        }
      })
  }, [selectedWorkspace?.id, selectedChat?.id, createLocalMessageId])

  React.useEffect(() => {
    if (autoScrollRef.current) {
      scrollToBottom()
    }
  }, [messages, isTranscriptLoading, scrollToBottom])

  React.useEffect(() => {
    setDeleteWorkspaceError(null)
  }, [selectedWorkspaceId])

  React.useEffect(() => {
    setDeleteSessionError(null)
  }, [selectedWorkspaceId])

  React.useEffect(() => {
    if (!projects.length) {
      setOpenPullRequests([])
      setPullRequestsError(null)
      return
    }
    let isActive = true
    const loadPullRequests = async () => {
      const targets = projects.filter((project) => project.repoUrl?.trim())
      if (!targets.length) {
        if (isActive) {
          setOpenPullRequests([])
          setPullRequestsError(null)
          setIsLoadingPullRequests(false)
        }
        return
      }
      setIsLoadingPullRequests(true)
      setPullRequestsError(null)
      const errors: string[] = []
      const results = await Promise.all(
        targets.map(async (project) => {
          try {
            const response = await fetch(
              `/api/projects/${project.id}/pull-requests?limit=10`
            )
            if (!response.ok) {
              let message = `Failed to load pull requests for ${project.name}.`
              try {
                const payload = (await response.json()) as { error?: string }
                if (payload.error) {
                  message = payload.error
                }
              } catch {
                // Ignore parsing errors
              }
              errors.push(message)
              return [] as OpenPullRequest[]
            }
            const payload = (await response.json()) as ApiPullRequest[]
            return payload.map((item) => ({
              ...item,
              projectId: project.id,
              projectName: project.name,
            }))
          } catch (err) {
            errors.push(
              err instanceof Error
                ? err.message
                : `Failed to load pull requests for ${project.name}.`
            )
            return [] as OpenPullRequest[]
          }
        })
      )
      if (!isActive) {
        return
      }
      const flattened = results.flat()
      setOpenPullRequests(flattened)
      setPullRequestsError(flattened.length ? null : errors[0] ?? null)
      setIsLoadingPullRequests(false)
    }
    void loadPullRequests()
    return () => {
      isActive = false
    }
  }, [projects])

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

  const handleWorkspaceFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setWorkspaceForm({ title: value })
  }

  const handleSessionFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSessionForm({ title: value })
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

  const handleCreateSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProject || !selectedWorkspace) {
      return
    }
    const title = sessionForm.title.trim()
    setIsCreatingSession(true)
    setCreateSessionError(null)
    try {
      const response = await fetch(
        `/api/conversations/${selectedWorkspace.id}/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || undefined }),
        }
      )
      if (!response.ok) {
        let message = "Failed to create session."
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
      const session = (await response.json()) as ApiSession
      setSessionForm({ title: "" })
      setIsProjectsView(false)
      setSelectedProjectId(selectedProject.id)
      setSelectedWorkspaceId(selectedWorkspace.id)
      setSelectedChatId(session.id)
      await loadProjects()
    } catch (err) {
      setCreateSessionError(
        err instanceof Error ? err.message : "Failed to create session."
      )
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!selectedProject || !selectedWorkspace) {
      return
    }
    const sessionLabel =
      selectedWorkspace.chats.find((chat) => chat.id === sessionId)?.name || sessionId
    const confirmed = window.confirm(`Delete session "${sessionLabel}"?`)
    if (!confirmed) {
      return
    }
    setDeletingSessionId(sessionId)
    setDeleteSessionError(null)
    try {
      const response = await fetch(
        `/api/conversations/${selectedWorkspace.id}/sessions/${sessionId}?confirm=true`,
        {
          method: "DELETE",
        }
      )
      if (!response.ok) {
        let message = "Failed to delete session."
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
      if (selectedChatId === sessionId) {
        setSelectedChatId(null)
      }
      await loadProjects()
    } catch (err) {
      setDeleteSessionError(
        err instanceof Error ? err.message : "Failed to delete session."
      )
    } finally {
      setDeletingSessionId((current) => (current === sessionId ? null : current))
    }
  }

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPromptValue(event.target.value)
  }

  const handlePromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handlePromptSubmit(event)
    }
  }

  const handlePromptSubmit = async (
    event: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    event.preventDefault()
    if (!selectedWorkspace || !selectedChat) {
      return
    }
    if (chatStatus === "streaming") {
      return
    }
    const content = promptValue.trim()
    if (!content) {
      return
    }

    const conversationId = selectedWorkspace.id
    const sessionId = selectedChat.id
    const userMessageId = createLocalMessageId()
    const assistantMessageId = createLocalMessageId()

    setPromptValue("")
    setChatError(null)
    setIsAwaitingFirstToken(true)
    autoScrollRef.current = true
    setChatStatus("streaming")
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content },
      { id: assistantMessageId, role: "assistant", content: "", isStreaming: true },
    ])

    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/sessions/${sessionId}/chat/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
          signal: controller.signal,
        }
      )
      if (!response.ok || !response.body) {
        throw new Error("Failed to start streaming response.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""

        for (const part of parts) {
          const lines = part.split("\n").filter(Boolean)
          if (!lines.length) {
            continue
          }
          let eventName = "message"
          const dataLines: string[] = []
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.replace(/^event:\s*/, "")
            } else if (line.startsWith("data:")) {
              dataLines.push(line.replace(/^data:\s*/, ""))
            }
          }
          const rawData = dataLines.join("\n")
          let data: any = rawData
          if (rawData) {
            try {
              data = JSON.parse(rawData)
            } catch {
              data = rawData
            }
          }

          if (eventName === "message_delta" && typeof data?.delta === "string") {
            setIsAwaitingFirstToken(false)
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      content: message.content + data.delta,
                      isStreaming: true,
                    }
                  : message
              )
            )
            continue
          }

          if (eventName === "message_end") {
            setIsAwaitingFirstToken(false)
            setChatStatus("idle")
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      content:
                        typeof data?.content === "string" ? data.content : message.content,
                      isStreaming: false,
                    }
                  : message
              )
            )
            continue
          }

          if (eventName === "error") {
            setIsAwaitingFirstToken(false)
            setChatStatus("error")
            setChatError(
              typeof data?.message === "string"
                ? data.message
                : "Streaming failed."
            )
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, isStreaming: false }
                  : message
              )
            )
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return
      }
      setIsAwaitingFirstToken(false)
      setChatStatus("error")
      setChatError(err instanceof Error ? err.message : "Streaming failed.")
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? { ...message, isStreaming: false }
            : message
        )
      )
    } finally {
      if (!controller.signal.aborted) {
        setIsAwaitingFirstToken(false)
        setChatStatus((status) => (status === "streaming" ? "idle" : status))
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, isStreaming: false }
              : message
          )
        )
      }
      streamAbortRef.current = null
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

  const formatDateTime = (value?: string) => {
    if (!value) {
      return "Unknown"
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return "Unknown"
    }
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  }

  const isProjectView = Boolean(
    selectedProject && !selectedWorkspace && !selectedChat && !isProjectsView
  )
  const isWorkspaceView = Boolean(selectedWorkspace && !selectedChat)
  const isChatView = Boolean(selectedChat)
  const isChatStreaming = chatStatus === "streaming"
  const projectIconValue = selectedProject?.icon?.trim() ?? ""
  const promptDisabled =
    isChatStreaming || !selectedWorkspace || !selectedChat || isTranscriptLoading

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
  const recentSessionsForView = isProjectView ? projectRecentSessions : recentSessions
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
          <div className="rounded-xl border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">Recent sessions</div>
                <div className="text-xs text-muted-foreground">
                  {isProjectView
                    ? `Last ${recentSessionsLimit} sessions in this project.`
                    : `Last ${recentSessionsLimit} sessions across your workspaces.`}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {recentSessionsForView.length ? (
                recentSessionsForView.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() =>
                      handleSelectChat(
                        session.projectId,
                        session.workspaceId,
                        session.id
                      )
                    }
                    className="min-w-[220px] rounded-lg border bg-muted/20 px-4 py-3 text-left transition hover:border-primary/60 hover:bg-muted/40"
                  >
                    <div className="text-sm font-semibold text-foreground">
                      {session.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {session.projectName} · {session.workspaceName}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Updated {formatDateTime(session.updatedAt)}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  No sessions yet. Create a workspace to start chatting.
                </div>
              )}
            </div>
          </div>
          {isProjectsView ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="grid gap-4">
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
                          onClick={() =>
                            handleSelectWorkspace(workspace.projectId, workspace.id)
                          }
                          className="rounded-lg border bg-muted/20 px-4 py-3 text-left transition hover:border-primary/60 hover:bg-muted/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-foreground">
                                {workspace.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {workspace.projectName}
                              </div>
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
                            <div className="text-sm font-semibold text-foreground">
                              {item.title}
                            </div>
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
          ) : showWorkspaceCreator ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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
                  <CardHeader>
                    <CardTitle>Workspaces</CardTitle>
                    <CardDescription>Active workspaces for this project.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {selectedProject?.workspaces.length ? (
                      selectedProject.workspaces.map((workspace) => (
                        <button
                          key={workspace.id}
                          type="button"
                          onClick={() =>
                            handleSelectWorkspace(selectedProject.id, workspace.id)
                          }
                          className="rounded-lg border bg-muted/20 px-4 py-3 text-left transition hover:border-primary/60 hover:bg-muted/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-foreground">
                                {workspace.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {selectedProject.name}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Updated {formatDateTime(workspace.updatedAt ?? workspace.createdAt)}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                        No workspaces yet. Create your first one.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4">
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
                    ) : projectPullRequests.length ? (
                      projectPullRequests.map((item) => (
                        <a
                          key={`${item.projectId}-${item.id}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border bg-muted/20 px-4 py-3 transition hover:border-primary/60 hover:bg-muted/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-foreground">
                              {item.title}
                            </div>
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
                              ? `${item.sourceBranch} -> ${item.targetBranch}`
                              : null}
                            <span>Updated {formatDateTime(item.updatedAt)}</span>
                          </div>
                        </a>
                      ))
                    ) : hasRepoProject ? (
                      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                        No open pull requests right now.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                        Add a repo URL to this project to see open PRs or MRs here.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : isWorkspaceView ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card className="border-dashed">
                <form onSubmit={handleCreateSession}>
                  <CardHeader>
                    <CardTitle>Create a new session</CardTitle>
                    <CardDescription>
                      Start a focused chat within this workspace.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Session name
                      </label>
                      <Input
                        value={sessionForm.title}
                        onChange={handleSessionFormChange}
                        placeholder="e.g. Bug bash follow-up"
                      />
                    </div>
                    {createSessionError ? (
                      <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {createSessionError}
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isCreatingSession}>
                      {isCreatingSession ? "Creating session..." : "Create session"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Chat sessions</CardTitle>
                  <CardDescription>Jump back into any active thread.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {selectedWorkspace?.chats.length ? (
                    selectedWorkspace.chats.map((chat) => {
                      const isDeleting = deletingSessionId === chat.id
                      return (
                        <div
                          key={chat.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-foreground">
                              {chat.name}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!selectedProject || !selectedWorkspace) {
                                  return
                                }
                                handleSelectChat(selectedProject.id, selectedWorkspace.id, chat.id)
                              }}
                            >
                              Open
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSession(chat.id)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      No sessions yet. Create your first one.
                    </div>
                  )}
                  {deleteSessionError ? (
                    <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {deleteSessionError}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : isChatView ? (
            <Conversation className="min-h-[520px]">
              <ConversationContent
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="space-y-4"
              >
                {isTranscriptLoading ? (
                  <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                    <Loader className="mr-2" /> Loading transcript...
                  </div>
                ) : messages.length ? (
                  messages.map((message) => (
                    <Message key={message.id} role={message.role}>
                      <MessageContent>
                        {message.role === "assistant" ? (
                          <MessageResponse>
                            {message.content}
                            {message.isStreaming && message.content ? (
                              <span className="ml-1 inline-block h-3 w-1 animate-pulse rounded-sm bg-muted-foreground/60" />
                            ) : null}
                            {message.isStreaming && !message.content && isAwaitingFirstToken ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader /> Waiting for response...
                              </span>
                            ) : null}
                          </MessageResponse>
                        ) : (
                          message.content
                        )}
                      </MessageContent>
                    </Message>
                  ))
                ) : (
                  <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                    Ask a question to start the session.
                  </div>
                )}
              </ConversationContent>
              {showScrollButton ? (
                <ConversationScrollButton onClick={scrollToBottom}>
                  Jump to latest
                </ConversationScrollButton>
              ) : null}
              <div className="border-t bg-background/80 p-4">
                <PromptInput onSubmit={handlePromptSubmit}>
                  <PromptInputTextarea
                    value={promptValue}
                    onChange={handlePromptChange}
                    onKeyDown={handlePromptKeyDown}
                    placeholder="Ask for a review, summary, or next steps..."
                    disabled={promptDisabled}
                  />
                  <PromptInputFooter>
                    <div className="text-xs text-muted-foreground">
                      Shift + Enter for a new line
                    </div>
                    <PromptInputSubmit
                      type="submit"
                      disabled={promptDisabled || !promptValue.trim()}
                    >
                      {isChatStreaming ? "Streaming..." : "Send"}
                    </PromptInputSubmit>
                  </PromptInputFooter>
                </PromptInput>
                {chatError ? (
                  <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {chatError}
                  </div>
                ) : null}
              </div>
            </Conversation>
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
