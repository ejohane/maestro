import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"

import type {
  ApiConversation,
  ApiProject,
  ApiSession,
  Project,
  Workspace,
} from "./types"

type WorkbenchView = "workbench" | "projects" | "settings"

type WorkbenchState = {
  projects: Project[]
  isLoading: boolean
  error: string | null
  view: WorkbenchView
  selectedProjectId: string | null
  selectedWorkspaceId: string | null
  selectedChatId: string | null
}

type WorkbenchActions = {
  reloadProjects: () => Promise<void>
  updateProjects: (updater: (current: Project[]) => Project[]) => void
  selectProjectsView: () => void
  selectSettingsView: () => void
  selectProject: (projectId: string) => void
  selectWorkspace: (projectId: string, workspaceId: string) => void
  selectChat: (projectId: string, workspaceId: string, chatId: string) => void
  setSelectedWorkspaceId: (workspaceId: string | null) => void
  setSelectedChatId: (chatId: string | null) => void
}

type WorkbenchMeta = {
  isProjectsView: boolean
  isSettingsView: boolean
  isProjectView: boolean
  isWorkspaceView: boolean
  isChatView: boolean
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: { id: string; name: string; model?: string } | null
}

type WorkbenchContextValue = {
  state: WorkbenchState
  actions: WorkbenchActions
  meta: WorkbenchMeta
}

const WorkbenchContext = React.createContext<WorkbenchContextValue | null>(null)

const PROJECTS_PATH = "/projects"
const SETTINGS_PATH = "/settings"

const encodeRouteSegment = (value: string) => encodeURIComponent(value)
const decodeRouteSegment = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const buildProjectPath = (projectId: string) =>
  `${PROJECTS_PATH}/${encodeRouteSegment(projectId)}`
const buildWorkspacePath = (projectId: string, workspaceId: string) =>
  `${buildProjectPath(projectId)}/workspaces/${encodeRouteSegment(workspaceId)}`
const buildChatPath = (projectId: string, workspaceId: string, chatId: string) =>
  `${buildWorkspacePath(projectId, workspaceId)}/chats/${encodeRouteSegment(chatId)}`

type RouteViewState = {
  view: WorkbenchView
  selectedProjectId: string | null
  selectedWorkspaceId: string | null
  selectedChatId: string | null
}

const parseRouteViewState = (pathname: string): RouteViewState => {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "projects")) {
    return {
      view: "projects",
      selectedProjectId: null,
      selectedWorkspaceId: null,
      selectedChatId: null,
    }
  }

  if (segments.length === 1 && segments[0] === "settings") {
    return {
      view: "settings",
      selectedProjectId: null,
      selectedWorkspaceId: null,
      selectedChatId: null,
    }
  }

  if (segments[0] === "projects" && segments[1]) {
    const projectId = decodeRouteSegment(segments[1])
    if (
      segments.length === 6 &&
      segments[2] === "workspaces" &&
      segments[3] &&
      segments[4] === "chats" &&
      segments[5]
    ) {
      return {
        view: "workbench",
        selectedProjectId: projectId,
        selectedWorkspaceId: decodeRouteSegment(segments[3]),
        selectedChatId: decodeRouteSegment(segments[5]),
      }
    }
    if (
      segments.length === 4 &&
      segments[2] === "workspaces" &&
      segments[3]
    ) {
      return {
        view: "workbench",
        selectedProjectId: projectId,
        selectedWorkspaceId: decodeRouteSegment(segments[3]),
        selectedChatId: null,
      }
    }
    if (segments.length === 2) {
      return {
        view: "workbench",
        selectedProjectId: projectId,
        selectedWorkspaceId: null,
        selectedChatId: null,
      }
    }
  }

  return {
    view: "projects",
    selectedProjectId: null,
    selectedWorkspaceId: null,
    selectedChatId: null,
  }
}

export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [projects, setProjects] = React.useState<Project[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [view, setView] = React.useState<WorkbenchView>("workbench")
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    null
  )
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string | null>(
    null
  )
  const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null)

  const reloadProjects = React.useCallback(async () => {
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
            branch: conversation.branch,
            chats: sessions.map((session) => ({
              id: session.id,
              name: session.title?.trim() || session.model || session.id,
              model: session.model,
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

  const updateProjects = React.useCallback(
    (updater: (current: Project[]) => Project[]) => {
      setProjects((current) => updater(current))
    },
    []
  )

  const selectProjectsView = React.useCallback(() => {
    navigate(PROJECTS_PATH)
  }, [navigate])

  const selectSettingsView = React.useCallback(() => {
    navigate(SETTINGS_PATH)
  }, [navigate])

  const selectProject = React.useCallback((projectId: string) => {
    navigate(buildProjectPath(projectId))
  }, [navigate])

  const selectWorkspace = React.useCallback(
    (projectId: string, workspaceId: string) => {
      navigate(buildWorkspacePath(projectId, workspaceId))
    },
    [navigate]
  )

  const selectChat = React.useCallback(
    (projectId: string, workspaceId: string, chatId: string) => {
      navigate(buildChatPath(projectId, workspaceId, chatId))
    },
    [navigate]
  )

  React.useEffect(() => {
    void reloadProjects()
  }, [reloadProjects])

  React.useEffect(() => {
    const routeViewState = parseRouteViewState(location.pathname)
    setView(routeViewState.view)
    setSelectedProjectId(routeViewState.selectedProjectId)
    setSelectedWorkspaceId(routeViewState.selectedWorkspaceId)
    setSelectedChatId(routeViewState.selectedChatId)
  }, [location.pathname])

  React.useEffect(() => {
    if (view === "settings") {
      if (location.pathname !== SETTINGS_PATH) {
        navigate(SETTINGS_PATH, { replace: true })
      }
      return
    }
    if (view === "projects") {
      if (location.pathname !== PROJECTS_PATH) {
        navigate(PROJECTS_PATH, { replace: true })
      }
      return
    }

    if (isLoading && projects.length === 0) {
      return
    }
    if (!projects.length) {
      if (location.pathname !== PROJECTS_PATH) {
        navigate(PROJECTS_PATH, { replace: true })
      }
      return
    }

    const project =
      projects.find((item) => item.id === selectedProjectId) ?? projects[0]
    const shouldSelectWorkspace = selectedWorkspaceId !== null || selectedChatId !== null
    const workspace = shouldSelectWorkspace
      ? project.workspaces.find((item) => item.id === selectedWorkspaceId) ??
        project.workspaces[0] ??
        null
      : null
    const shouldSelectChat = selectedChatId !== null
    const chat = shouldSelectChat
      ? workspace?.chats.find((item) => item.id === selectedChatId) ??
        workspace?.chats[0] ??
        null
      : null
    const canonicalPath = chat && workspace
      ? buildChatPath(project.id, workspace.id, chat.id)
      : workspace
        ? buildWorkspacePath(project.id, workspace.id)
        : buildProjectPath(project.id)
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true })
    }
  }, [
    isLoading,
    location.pathname,
    navigate,
    projects,
    selectedChatId,
    selectedProjectId,
    selectedWorkspaceId,
    view,
  ])

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

  const isProjectsView = view === "projects"
  const isSettingsView = view === "settings"
  const isProjectView = Boolean(
    !isSettingsView &&
      selectedProject &&
      !selectedWorkspace &&
      !selectedChat &&
      !isProjectsView
  )
  const isWorkspaceView = Boolean(!isSettingsView && selectedWorkspace && !selectedChat)
  const isChatView = Boolean(!isSettingsView && selectedChat)

  const state = React.useMemo<WorkbenchState>(
    () => ({
      projects,
      isLoading,
      error,
      view,
      selectedProjectId,
      selectedWorkspaceId,
      selectedChatId,
    }),
    [
      projects,
      isLoading,
      error,
      view,
      selectedProjectId,
      selectedWorkspaceId,
      selectedChatId,
    ]
  )

  const actions = React.useMemo<WorkbenchActions>(
    () => ({
      reloadProjects,
      updateProjects,
      selectProjectsView,
      selectSettingsView,
      selectProject,
      selectWorkspace,
      selectChat,
      setSelectedWorkspaceId,
      setSelectedChatId,
    }),
    [
      reloadProjects,
      updateProjects,
      selectProjectsView,
      selectSettingsView,
      selectProject,
      selectWorkspace,
      selectChat,
    ]
  )

  const meta = React.useMemo<WorkbenchMeta>(
    () => ({
      isProjectsView,
      isSettingsView,
      isProjectView,
      isWorkspaceView,
      isChatView,
      selectedProject,
      selectedWorkspace,
      selectedChat,
    }),
    [
      isProjectsView,
      isSettingsView,
      isProjectView,
      isWorkspaceView,
      isChatView,
      selectedProject,
      selectedWorkspace,
      selectedChat,
    ]
  )

  return (
    <WorkbenchContext.Provider value={{ state, actions, meta }}>
      {children}
    </WorkbenchContext.Provider>
  )
}

export function useWorkbench() {
  const context = React.useContext(WorkbenchContext)
  if (!context) {
    throw new Error("useWorkbench must be used within a WorkbenchProvider.")
  }
  return context
}
