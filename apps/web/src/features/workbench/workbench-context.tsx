import * as React from "react"

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

export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
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
    setView("projects")
    setSelectedProjectId(null)
    setSelectedWorkspaceId(null)
    setSelectedChatId(null)
  }, [])

  const selectSettingsView = React.useCallback(() => {
    setView("settings")
  }, [])

  const selectProject = React.useCallback((projectId: string) => {
    setView("workbench")
    setSelectedProjectId(projectId)
    setSelectedWorkspaceId(null)
    setSelectedChatId(null)
  }, [])

  const selectWorkspace = React.useCallback(
    (projectId: string, workspaceId: string) => {
      setView("workbench")
      setSelectedProjectId(projectId)
      setSelectedWorkspaceId(workspaceId)
      setSelectedChatId(null)
    },
    []
  )

  const selectChat = React.useCallback(
    (projectId: string, workspaceId: string, chatId: string) => {
      setView("workbench")
      setSelectedProjectId(projectId)
      setSelectedWorkspaceId(workspaceId)
      setSelectedChatId(chatId)
    },
    []
  )

  React.useEffect(() => {
    void reloadProjects()
  }, [reloadProjects])

  React.useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(null)
      setSelectedWorkspaceId(null)
      setSelectedChatId(null)
      return
    }
    if (view === "projects") {
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
  }, [projects, view])

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
