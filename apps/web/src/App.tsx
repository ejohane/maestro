import * as React from "react"

import { AppSidebar } from "./components/app-sidebar"
import { ProjectWorkspacesTable } from "./components/project-workspaces-table"
import type { PromptInputMessage } from "./components/ai-elements/prompt-input"
import { SidebarInset, SidebarProvider, SidebarRail } from "./components/ui/sidebar"
import { useTheme } from "./hooks/use-theme"
import {
  applyMessageDelta,
  applyMessageEnd,
  applyMessagePartUpdate,
  createClientMessage,
  getTextFromParts,
  normalizeMessageParts,
  type StructuredMessagePart,
} from "./lib/messages"
import { extractUsageFromMetadata } from "./features/workbench/message-entries"
import {
  buildModelOptions,
  collectAllWorkspaces,
  collectProjectRecentSessions,
  collectRecentSessions,
  collectSettingsModels,
  filterProjectPullRequests,
  getActiveProvider,
  hasProjectsWithRepos,
  sortOpenPullRequests,
} from "./features/workbench/selectors"
import { formatDate, formatDateTime } from "./features/workbench/date-format"
import { ChatView } from "./features/workbench/views/chat-view"
import { ProjectsView } from "./features/workbench/views/projects-view"
import { SecondaryItemsView } from "./features/workbench/views/secondary-items-view"
import { SettingsView } from "./features/workbench/views/settings-view"
import { WorkbenchHeader } from "./features/workbench/views/workbench-header"
import { WorkbenchOverview } from "./features/workbench/views/workbench-overview"
import { WorkspaceSessionsView } from "./features/workbench/views/workspace-sessions-view"
import type {
  ApiConversation,
  ApiModelsResponse,
  ApiProject,
  ApiPullRequest,
  ApiSession,
  ApiTranscriptEntry,
  ChatSession,
  ChatMessage,
  CheckpointMarker,
  SessionFormState,
  CreateConversationResponse,
  MergedPullRequestAction,
  ModelProvider,
  OpenPullRequest,
  Project,
  ProjectFormState,
  SettingsFormState,
  WorkspaceFormState,
  Workspace,
} from "./features/workbench/types"

const App = () => {
  const { theme, toggleTheme } = useTheme()
  const [projects, setProjects] = React.useState<Project[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isProjectsView, setIsProjectsView] = React.useState(false)
  const [isSettingsView, setIsSettingsView] = React.useState(false)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    null
  )
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string | null>(
    null
  )
  const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null)
  const [projectForm, setProjectForm] = React.useState<ProjectFormState>({
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
  const [workspaceForm, setWorkspaceForm] = React.useState<WorkspaceFormState>({
    title: "",
  })
  const [isCreatingWorkspace, setIsCreatingWorkspace] = React.useState(false)
  const [createWorkspaceError, setCreateWorkspaceError] = React.useState<string | null>(
    null
  )
  const [sessionForm, setSessionForm] = React.useState<SessionFormState>({
    providerId: "",
    modelId: "",
  })
  const [isCreatingSession, setIsCreatingSession] = React.useState(false)
  const [createSessionError, setCreateSessionError] = React.useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = React.useState<string | null>(null)
  const [deleteSessionError, setDeleteSessionError] = React.useState<string | null>(null)
  const [deletingWorkspace, setDeletingWorkspace] = React.useState<
    Record<string, boolean>
  >({})
  const [deleteWorkspaceErrors, setDeleteWorkspaceErrors] = React.useState<
    Record<string, string>
  >({})
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null)
  const [chatStatus, setChatStatus] = React.useState<"idle" | "streaming" | "error">(
    "idle"
  )
  const [chatError, setChatError] = React.useState<string | null>(null)
  const [restoreCheckpointError, setRestoreCheckpointError] = React.useState<
    string | null
  >(null)
  const [restoringCheckpoints, setRestoringCheckpoints] = React.useState<
    Record<string, boolean>
  >({})
  const [promptValue, setPromptValue] = React.useState("")
  const [isTranscriptLoading, setIsTranscriptLoading] = React.useState(false)
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = React.useState(false)
  const streamAbortRef = React.useRef<AbortController | null>(null)
  const transcriptAbortRef = React.useRef<AbortController | null>(null)
  const copyTimeoutRef = React.useRef<number | null>(null)
  const [openPullRequests, setOpenPullRequests] = React.useState<OpenPullRequest[]>([])
  const [isLoadingPullRequests, setIsLoadingPullRequests] = React.useState(false)
  const [pullRequestsError, setPullRequestsError] = React.useState<string | null>(null)
  const [settingsForm, setSettingsForm] = React.useState<SettingsFormState>({
    githubToken: "",
    gotlandToken: "",
    modelProviders: [],
    defaultProvider: "",
    defaultModel: "",
  })
  const [settingsError, setSettingsError] = React.useState<string | null>(null)
  const [settingsSavedMessage, setSettingsSavedMessage] = React.useState<string | null>(
    null
  )
  const [isSavingSettings, setIsSavingSettings] = React.useState(false)
  const [defaultModel, setDefaultModel] = React.useState<string | null>(null)
  const [availableModels, setAvailableModels] = React.useState<string[]>([])
  const [isUpdatingModel, setIsUpdatingModel] = React.useState(false)
  const [updateModelError, setUpdateModelError] = React.useState<string | null>(null)
  const [mergingPullRequests, setMergingPullRequests] = React.useState<
    Record<string, boolean>
  >({})
  const [mergePullRequestErrors, setMergePullRequestErrors] = React.useState<
    Record<string, string>
  >({})
  const [mergedPullRequests, setMergedPullRequests] = React.useState<
    Record<string, MergedPullRequestAction>
  >({})
  const [deletingMergeWorkspace, setDeletingMergeWorkspace] = React.useState<
    Record<string, boolean>
  >({})
  const [deleteMergeWorkspaceErrors, setDeleteMergeWorkspaceErrors] = React.useState<
    Record<string, string>
  >({})
  const recentSessionsLimit = 6
  const emptyStateSuggestions = [
    "Summarize the repo focus",
    "List key files to review",
    "Draft next steps for this task",
    "Explain the current workspace",
  ]

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

  const loadSettings = React.useCallback(async () => {
    setSettingsError(null)
    try {
      const response = await fetch("/api/settings")
      if (!response.ok) {
        throw new Error("Failed to load settings.")
      }
      const payload = (await response.json()) as {
        githubToken?: string
        gotlandToken?: string
        modelProviders?: ModelProvider[]
        defaultProvider?: string
        defaultModel?: string
      }
      setSettingsForm({
        githubToken: payload.githubToken ?? "",
        gotlandToken: payload.gotlandToken ?? "",
        modelProviders: payload.modelProviders ?? [],
        defaultProvider: payload.defaultProvider ?? "",
        defaultModel: payload.defaultModel ?? "",
      })
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Failed to load settings."
      )
    }
  }, [])

  const loadModels = React.useCallback(async () => {
    try {
      const response = await fetch("/api/models")
      if (!response.ok) {
        return
      }
      const payload = (await response.json()) as ApiModelsResponse
      const modelValues = Array.isArray(payload.models)
        ? payload.models.map((model) => model.trim()).filter(Boolean)
        : []
      setDefaultModel(payload.defaultModel?.trim() || null)
      setAvailableModels(Array.from(new Set(modelValues)))
    } catch {
      // Ignore model load errors and fall back to defaults
    }
  }, [])

  React.useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  React.useEffect(() => {
    if (settingsForm.modelProviders.length === 0) {
      return
    }
    setSessionForm((prev) => {
      const providerIds = settingsForm.modelProviders.map((provider) => provider.id)
      const resolvedProviderId = providerIds.includes(prev.providerId)
        ? prev.providerId
        : providerIds.includes(settingsForm.defaultProvider)
          ? settingsForm.defaultProvider
          : settingsForm.modelProviders[0]?.id || ""
      const provider = settingsForm.modelProviders.find(
        (item) => item.id === resolvedProviderId
      )
      const modelIds = provider?.models.map((model) => model.id) ?? []
      const resolvedModelId = modelIds.includes(prev.modelId)
        ? prev.modelId
        : modelIds.includes(settingsForm.defaultModel)
          ? settingsForm.defaultModel
          : provider?.models[0]?.id || ""
      if (
        resolvedProviderId === prev.providerId &&
        resolvedModelId === prev.modelId
      ) {
        return prev
      }
      return {
        ...prev,
        providerId: resolvedProviderId,
        modelId: resolvedModelId,
      }
    })
  }, [
    settingsForm.modelProviders,
    settingsForm.defaultProvider,
    settingsForm.defaultModel,
  ])

  React.useEffect(() => {
    if (settingsForm.modelProviders.length === 0) {
      return
    }
    setSettingsForm((prev) => {
      const providerIds = prev.modelProviders.map((provider) => provider.id)
      const resolvedProviderId = providerIds.includes(prev.defaultProvider)
        ? prev.defaultProvider
        : prev.modelProviders[0]?.id || ""
      const provider = prev.modelProviders.find(
        (item) => item.id === resolvedProviderId
      )
      const modelIds = provider?.models.map((model) => model.id) ?? []
      const resolvedModelId = modelIds.includes(prev.defaultModel)
        ? prev.defaultModel
        : provider?.models[0]?.id || ""
      if (
        resolvedProviderId === prev.defaultProvider &&
        resolvedModelId === prev.defaultModel
      ) {
        return prev
      }
      return {
        ...prev,
        defaultProvider: resolvedProviderId,
        defaultModel: resolvedModelId,
      }
    })
  }, [settingsForm.modelProviders])

  React.useEffect(() => {
    void loadModels()
  }, [loadModels])

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

  const fallbackModel = defaultModel?.trim() || "openai/gpt-5.2-codex"
  const selectedModel = selectedChat?.model ?? fallbackModel
  const activeProvider = React.useMemo(() => getActiveProvider(selectedModel), [selectedModel])
  const settingsModels = React.useMemo(
    () => collectSettingsModels(settingsForm.modelProviders),
    [settingsForm.modelProviders]
  )
  const modelOptions = React.useMemo(
    () =>
      buildModelOptions({
        fallbackModel,
        availableModels,
        settingsModels,
        selectedChatModel: selectedChat?.model,
        activeProvider,
      }),
    [activeProvider, availableModels, fallbackModel, selectedChat?.model, settingsModels]
  )
  const usageFromMessages = React.useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const usage = extractUsageFromMetadata(messages[index]?.metadata)
      if (usage) {
        return usage
      }
    }
    return null
  }, [messages])
  const contextUsage = usageFromMessages ?? undefined

  const recentSessions = React.useMemo(
    () => collectRecentSessions(projects, recentSessionsLimit),
    [projects, recentSessionsLimit]
  )

  const projectRecentSessions = React.useMemo(
    () => collectProjectRecentSessions(selectedProject, recentSessionsLimit),
    [selectedProject, recentSessionsLimit]
  )

  const allWorkspaces = React.useMemo(() => collectAllWorkspaces(projects), [projects])

  const sortedPullRequests = React.useMemo(
    () => sortOpenPullRequests(openPullRequests),
    [openPullRequests]
  )

  const projectPullRequests = React.useMemo(
    () => filterProjectPullRequests(sortedPullRequests, selectedProject?.id),
    [sortedPullRequests, selectedProject?.id]
  )

  const hasRepoProjects = React.useMemo(() => hasProjectsWithRepos(projects), [projects])
  const getPullRequestKey = React.useCallback((item: OpenPullRequest) => {
    return `${item.projectId}:${item.number}`
  }, [])
  const findWorkspaceForPullRequest = React.useCallback(
    (item: OpenPullRequest) => {
      const sourceBranch = item.sourceBranch?.trim().toLowerCase()
      if (!sourceBranch) {
        return undefined
      }
      const project = projects.find((entry) => entry.id === item.projectId)
      if (!project) {
        return undefined
      }
      return project.workspaces.find((workspace) => {
        const branch = workspace.branch?.trim().toLowerCase()
        return branch && branch === sourceBranch
      })
    },
    [projects]
  )
  const createLocalMessageId = React.useCallback(() => {
    return `m_${Math.random().toString(36).slice(2, 10)}`
  }, [])
  const createLocalFileId = React.useCallback(() => {
    return `f_${Math.random().toString(36).slice(2, 10)}`
  }, [])

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const fetchTranscript = React.useCallback(
    async (conversationId: string, sessionId: string, signal: AbortSignal) => {
      const response = await fetch(
        `/api/conversations/${conversationId}/sessions/${sessionId}/transcript`,
        { signal }
      )
      if (!response.ok) {
        throw new Error("Failed to load transcript.")
      }
      const transcript = (await response.json()) as ApiTranscriptEntry[]
      setMessages(
        transcript.map((entry) =>
          createClientMessage({
            id: createLocalMessageId(),
            role: entry.role,
            content: entry.content,
            parts: entry.parts,
            metadata: entry.metadata,
          })
        )
      )
    },
    [createLocalMessageId]
  )

  const loadTranscript = React.useCallback(
    async (resetPrompt: boolean) => {
      streamAbortRef.current?.abort()
      transcriptAbortRef.current?.abort()
      if (resetPrompt) {
        setMessages([])
        setPromptValue("")
        setChatStatus("idle")
        setChatError(null)
        setRestoreCheckpointError(null)
        setIsAwaitingFirstToken(false)
      }
      const conversationId = selectedWorkspace?.id
      const sessionId = selectedChat?.id
      if (!conversationId || !sessionId) {
        setIsTranscriptLoading(false)
        return
      }
      const controller = new AbortController()
      transcriptAbortRef.current = controller
      setIsTranscriptLoading(true)
      try {
        await fetchTranscript(conversationId, sessionId, controller.signal)
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }
        setChatError(err instanceof Error ? err.message : "Failed to load transcript.")
        setMessages([])
      } finally {
        if (!controller.signal.aborted) {
          setIsTranscriptLoading(false)
        }
      }
    },
    [selectedWorkspace?.id, selectedChat?.id, fetchTranscript]
  )

  React.useEffect(() => {
    void loadTranscript(true)
  }, [selectedWorkspace?.id, selectedChat?.id, loadTranscript])

  React.useEffect(() => {
    if (!selectedWorkspaceId) {
      return
    }
    setDeleteWorkspaceErrors((prev) => {
      const next = { ...prev }
      delete next[selectedWorkspaceId]
      return next
    })
  }, [selectedWorkspaceId])

  React.useEffect(() => {
    setDeleteSessionError(null)
  }, [selectedWorkspaceId])

  React.useEffect(() => {
    setUpdateModelError(null)
  }, [selectedChatId])

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
    setIsSettingsView(false)
    setSelectedProjectId(null)
    setSelectedWorkspaceId(null)
    setSelectedChatId(null)
  }

  const handleSelectSettingsView = () => {
    setIsSettingsView(true)
    setIsProjectsView(false)
  }

  const handleSelectProject = (projectId: string) => {
    setIsProjectsView(false)
    setIsSettingsView(false)
    setSelectedProjectId(projectId)
    setSelectedWorkspaceId(null)
    setSelectedChatId(null)
  }

  const handleSelectWorkspace = (projectId: string, workspaceId: string) => {
    setIsProjectsView(false)
    setIsSettingsView(false)
    setSelectedProjectId(projectId)
    setSelectedWorkspaceId(workspaceId)
    setSelectedChatId(null)
  }

  const handleMergePullRequest = async (item: OpenPullRequest) => {
    const key = getPullRequestKey(item)
    if (mergingPullRequests[key]) {
      return
    }
    const workspace = findWorkspaceForPullRequest(item)
    setMergingPullRequests((prev) => ({ ...prev, [key]: true }))
    setMergePullRequestErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      if (workspace) {
        const statusResponse = await fetch(
          `/api/conversations/${workspace.id}/status`
        )
        if (!statusResponse.ok) {
          if (statusResponse.status !== 404) {
            let message = "Failed to check workspace status."
            try {
              const payload = (await statusResponse.json()) as { error?: string }
              if (payload.error) {
                message = payload.error
              }
            } catch {
              // Ignore parsing errors
            }
            throw new Error(message)
          }
        } else {
          const payload = (await statusResponse.json()) as { dirty?: boolean }
          if (payload.dirty) {
            const confirmed = window.confirm(
              `Workspace "${workspace.name}" has uncommitted changes. Merge anyway?`
            )
            if (!confirmed) {
              return
            }
          }
        }
      }
      const response = await fetch(
        `/api/projects/${item.projectId}/pull-requests/${item.number}/merge`,
        { method: "POST" }
      )
      if (!response.ok) {
        let message = "Failed to merge pull request."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        if (response.status === 404 && message === "Not Found") {
          message =
            "Merge endpoint not found. Restart the CLI server to pick up the merge API."
        }
        throw new Error(message)
      }
      setMergedPullRequests((prev) => ({
        ...prev,
        [key]: {
          workspaceId: workspace?.id,
          workspaceName: workspace?.name,
        },
      }))
    } catch (err) {
      setMergePullRequestErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Failed to merge pull request.",
      }))
    } finally {
      setMergingPullRequests((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleDeleteMergedWorkspace = async (
    pullRequestKey: string,
    workspaceId: string,
    workspaceName?: string
  ) => {
    const label = workspaceName || workspaceId
    const confirmed = window.confirm(
      `Delete workspace "${label}"? This removes the worktree and all sessions.`
    )
    if (!confirmed) {
      return
    }
    setDeletingMergeWorkspace((prev) => ({ ...prev, [workspaceId]: true }))
    setDeleteMergeWorkspaceErrors((prev) => {
      const next = { ...prev }
      delete next[workspaceId]
      return next
    })
    try {
      const response = await fetch(`/api/conversations/${workspaceId}?confirm=true`, {
        method: "DELETE",
      })
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
      await loadProjects()
      setMergedPullRequests((prev) => ({
        ...prev,
        [pullRequestKey]: {
          ...prev[pullRequestKey],
          workspaceDeleted: true,
        },
      }))
    } catch (err) {
      setDeleteMergeWorkspaceErrors((prev) => ({
        ...prev,
        [workspaceId]:
          err instanceof Error ? err.message : "Failed to delete workspace.",
      }))
    } finally {
      setDeletingMergeWorkspace((prev) => ({ ...prev, [workspaceId]: false }))
    }
  }

  const handleSelectChat = (
    projectId: string,
    workspaceId: string,
    chatId: string
  ) => {
    setIsProjectsView(false)
    setIsSettingsView(false)
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

  const handleSettingsChange = (field: "githubToken" | "gotlandToken") => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setSettingsForm((prev) => ({ ...prev, [field]: value }))
      setSettingsSavedMessage(null)
    }
  }

  const handleWorkspaceFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setWorkspaceForm({ title: value })
  }

  const updateModelProvider = (
    index: number,
    updater: (provider: ModelProvider) => ModelProvider
  ) => {
    setSettingsForm((prev) => {
      const nextProviders = prev.modelProviders.map((provider, providerIndex) =>
        providerIndex === index ? updater(provider) : provider
      )
      return { ...prev, modelProviders: nextProviders }
    })
    setSettingsSavedMessage(null)
  }

  const handleAddProvider = () => {
    setSettingsForm((prev) => ({
      ...prev,
      modelProviders: [
        ...prev.modelProviders,
        { id: "", name: "", models: [] },
      ],
    }))
    setSettingsSavedMessage(null)
  }

  const handleRemoveProvider = (index: number) => {
    setSettingsForm((prev) => ({
      ...prev,
      modelProviders: prev.modelProviders.filter((_, providerIndex) => providerIndex !== index),
    }))
    setSettingsSavedMessage(null)
  }

  const handleAddModel = (providerIndex: number) => {
    updateModelProvider(providerIndex, (provider) => ({
      ...provider,
      models: [...provider.models, { id: "", name: "" }],
    }))
  }

  const handleRemoveModel = (providerIndex: number, modelIndex: number) => {
    updateModelProvider(providerIndex, (provider) => ({
      ...provider,
      models: provider.models.filter((_, index) => index !== modelIndex),
    }))
  }

  const handleDefaultProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSettingsForm((prev) => {
      const provider = prev.modelProviders.find((item) => item.id === value)
      const modelId =
        provider?.models.find((model) => model.id === prev.defaultModel)?.id ??
        provider?.models[0]?.id ??
        ""
      return { ...prev, defaultProvider: value, defaultModel: modelId }
    })
    setSettingsSavedMessage(null)
  }

  const handleDefaultModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSettingsForm((prev) => ({ ...prev, defaultModel: value }))
    setSettingsSavedMessage(null)
  }
  const handleSettingsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingSettings(true)
    setSettingsError(null)
    setSettingsSavedMessage(null)
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubToken: settingsForm.githubToken.trim() || null,
          gotlandToken: settingsForm.gotlandToken.trim() || null,
          modelProviders: settingsForm.modelProviders,
          defaultProvider: settingsForm.defaultProvider.trim() || null,
          defaultModel: settingsForm.defaultModel.trim() || null,
        }),
      })
      if (!response.ok) {
        let message = "Failed to save settings."
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
      const payload = (await response.json()) as {
        githubToken?: string
        gotlandToken?: string
        modelProviders?: ModelProvider[]
        defaultProvider?: string
        defaultModel?: string
      }
      setSettingsForm({
        githubToken: payload.githubToken ?? "",
        gotlandToken: payload.gotlandToken ?? "",
        modelProviders: payload.modelProviders ?? [],
        defaultProvider: payload.defaultProvider ?? "",
        defaultModel: payload.defaultModel ?? "",
      })
      setSettingsSavedMessage("Settings saved.")
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Failed to save settings."
      )
    } finally {
      setIsSavingSettings(false)
    }
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

  const handleDeleteWorkspace = async (workspaceId: string, workspaceName?: string) => {
    setDeletingWorkspace((prev) => ({ ...prev, [workspaceId]: true }))
    setDeleteWorkspaceErrors((prev) => {
      const next = { ...prev }
      delete next[workspaceId]
      return next
    })
    try {
      const response = await fetch(`/api/conversations/${workspaceId}?confirm=true`, {
        method: "DELETE",
      })
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
      if (selectedWorkspace?.id === workspaceId) {
        setSelectedWorkspaceId(null)
        setSelectedChatId(null)
      }
      await loadProjects()
      return true
    } catch (err) {
      setDeleteWorkspaceErrors((prev) => ({
        ...prev,
        [workspaceId]:
          err instanceof Error ? err.message : "Failed to delete workspace.",
      }))
      return false
    } finally {
      setDeletingWorkspace((prev) => ({ ...prev, [workspaceId]: false }))
    }
  }

  const handleConfirmDeleteWorkspace = async (
    workspaceId: string,
    workspaceName?: string
  ) => {
    const workspaceLabel = workspaceName || workspaceId
    const confirmed = window.confirm(
      `Delete workspace "${workspaceLabel}"? This removes the worktree and all sessions.`
    )
    if (!confirmed) {
      return false
    }
    return handleDeleteWorkspace(workspaceId, workspaceName)
  }

  const handleCreateSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProject || !selectedWorkspace) {
      return
    }
    const title = ""
    const providerId = sessionForm.providerId.trim()
    const modelId = sessionForm.modelId.trim()
    const model = providerId && modelId ? `${providerId}/${modelId}` : undefined
    setIsCreatingSession(true)
    setCreateSessionError(null)
    try {
      const response = await fetch(
        `/api/conversations/${selectedWorkspace.id}/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || undefined, model }),
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
      const nextChat: ChatSession = {
        id: session.id,
        name: session.title?.trim() || session.model || session.id,
        model: session.model,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }
      setIsProjectsView(false)
      setSelectedProjectId(selectedProject.id)
      setSelectedWorkspaceId(selectedWorkspace.id)
      setSelectedChatId(session.id)
      setProjects((current) =>
        current.map((project) => {
          if (project.id !== selectedProject.id) {
            return project
          }
          return {
            ...project,
            workspaces: project.workspaces.map((workspace) => {
              if (workspace.id !== selectedWorkspace.id) {
                return workspace
              }
              const existing = workspace.chats.some((chat) => chat.id === session.id)
              if (existing) {
                return workspace
              }
              return {
                ...workspace,
                chats: [nextChat, ...workspace.chats],
              }
            }),
          }
        })
      )
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

  const handleUpdateSessionModel = async (modelId: string) => {
    if (!selectedWorkspace || !selectedChat) {
      return
    }
    if (selectedChat.model === modelId) {
      return
    }
    setIsUpdatingModel(true)
    setUpdateModelError(null)
    try {
      const response = await fetch(
        `/api/conversations/${selectedWorkspace.id}/sessions/${selectedChat.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelId }),
        }
      )
      if (!response.ok) {
        let message = "Failed to update session model."
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
      const updatedSession = (await response.json()) as ApiSession
      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          workspaces: project.workspaces.map((workspace) => {
            if (workspace.id !== updatedSession.conversationId) {
              return workspace
            }
            return {
              ...workspace,
              chats: workspace.chats.map((chat) =>
                chat.id === updatedSession.id
                  ? {
                      ...chat,
                      name:
                        updatedSession.title?.trim() ||
                        updatedSession.model ||
                        updatedSession.id,
                      model: updatedSession.model,
                      updatedAt: updatedSession.updatedAt,
                    }
                  : chat
              ),
            }
          }),
        }))
      )
      const updatedModel = updatedSession.model?.trim()
      if (updatedModel) {
        setAvailableModels((prev) =>
          prev.includes(updatedModel) ? prev : [...prev, updatedModel]
        )
      }
    } catch (err) {
      setUpdateModelError(
        err instanceof Error ? err.message : "Failed to update session model."
      )
    } finally {
      setIsUpdatingModel(false)
    }
  }

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPromptValue(event.target.value)
  }

  const handleSuggestionClick = React.useCallback((suggestion: string) => {
    setPromptValue(suggestion)
    if (typeof document === "undefined") {
      return
    }
    window.requestAnimationFrame(() => {
      const textarea = document.querySelector(
        'textarea[name="message"]'
      ) as HTMLTextAreaElement | null
      if (!textarea) {
        return
      }
      textarea.focus()
      textarea.setSelectionRange(suggestion.length, suggestion.length)
    })
  }, [])

  const handlePromptSubmit = async (message: PromptInputMessage) => {
    if (!selectedWorkspace || !selectedChat) {
      return
    }
    if (chatStatus === "streaming") {
      return
    }
    const content = message.text.trim()
    if (!content) {
      return
    }

    const conversationId = selectedWorkspace.id
    const sessionId = selectedChat.id
    const userMessageId = createLocalMessageId()
    const assistantMessageId = createLocalMessageId()
    const attachmentParts: StructuredMessagePart[] = message.files.map((file) => {
      const attachmentId = createLocalFileId()
      return {
        type: "file",
        id: attachmentId,
        file: {
          id: attachmentId,
          name: file.filename,
          path: file.url,
          mimeType: file.mediaType,
          size: file.size,
          source: "upload",
        },
      }
    })
    const userParts = normalizeMessageParts(content, [
      { type: "text", text: content },
      ...attachmentParts,
    ])

    setPromptValue("")
    setChatError(null)
    setIsAwaitingFirstToken(true)
    setChatStatus("streaming")
    setMessages((prev) => [
      ...prev,
      createClientMessage({ id: userMessageId, role: "user", content, parts: userParts }),
      createClientMessage({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        parts: [],
        isStreaming: true,
      }),
    ])

    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/sessions/${sessionId}/chat/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, parts: userParts }),
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
                  ? applyMessageDelta(message, data.delta)
                  : message
              )
            )
            continue
          }

          if (eventName === "message_part_updated" || eventName === "message.part.updated") {
            const incomingPart = data?.part
            if (incomingPart && typeof incomingPart.type === "string") {
              setIsAwaitingFirstToken(false)
              setMessages((prev) =>
                prev.map((message) => {
                  if (message.id !== assistantMessageId) {
                    return message
                  }
                  return applyMessagePartUpdate(
                    message,
                    incomingPart as StructuredMessagePart,
                    data?.delta
                  )
                })
              )
            }
            continue
          }

          if (eventName === "message_end") {
            setIsAwaitingFirstToken(false)
            setChatStatus("idle")
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? applyMessageEnd(message, {
                      content: typeof data?.content === "string" ? data.content : undefined,
                      parts: Array.isArray(data?.parts) ? data.parts : undefined,
                    })
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

  const handleCopyMessage = React.useCallback(
    async (messageId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) {
        return
      }

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(trimmed)
        } else {
          const textarea = document.createElement("textarea")
          textarea.value = trimmed
          textarea.style.position = "fixed"
          textarea.style.opacity = "0"
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand("copy")
          document.body.removeChild(textarea)
        }
      } catch {
        return
      }

      setCopiedMessageId(messageId)
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current))
      }, 2000)
    },
    [setCopiedMessageId]
  )

  const handleRetryMessage = React.useCallback(
    (messageIndex: number) => {
      if (chatStatus === "streaming") {
        return
      }

      for (let index = messageIndex; index >= 0; index -= 1) {
        const candidate = messages[index]
        if (candidate?.role !== "user") {
          continue
        }
        const candidateText =
          getTextFromParts(candidate.parts) || candidate.content || ""
        if (candidateText.trim()) {
          void handlePromptSubmit({ text: candidateText, files: [] })
          return
        }
      }
    },
    [chatStatus, messages, handlePromptSubmit]
  )

  const handleRestoreCheckpoint = React.useCallback(
    async (checkpoint: CheckpointMarker) => {
      if (!selectedWorkspace || !selectedChat) {
        return
      }
      if (!checkpoint.restore) {
        return
      }
      if (restoringCheckpoints[checkpoint.id]) {
        return
      }
      setRestoreCheckpointError(null)
      setRestoringCheckpoints((prev) => ({ ...prev, [checkpoint.id]: true }))
      try {
        let response: Response
        if (checkpoint.restore.url) {
          const method = (checkpoint.restore.method ?? "POST").toUpperCase()
          const hasBody = checkpoint.restore.payload !== undefined && method !== "GET"
          response = await fetch(checkpoint.restore.url, {
            method,
            headers: hasBody ? { "Content-Type": "application/json" } : undefined,
            body: hasBody ? JSON.stringify(checkpoint.restore.payload) : undefined,
          })
        } else {
          if (!checkpoint.restore.messageId) {
            throw new Error("Checkpoint restore is missing a message id.")
          }
          response = await fetch(
            `/api/conversations/${selectedWorkspace.id}/sessions/${selectedChat.id}/checkpoints/restore`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messageId: checkpoint.restore.messageId,
                partId: checkpoint.restore.partId,
              }),
            }
          )
        }
        if (!response.ok) {
          let message = "Failed to restore checkpoint."
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
        await loadTranscript(false)
      } catch (err) {
        setRestoreCheckpointError(
          err instanceof Error ? err.message : "Failed to restore checkpoint."
        )
      } finally {
        setRestoringCheckpoints((prev) => {
          const next = { ...prev }
          delete next[checkpoint.id]
          return next
        })
      }
    },
    [
      selectedWorkspace,
      selectedChat,
      restoringCheckpoints,
      loadTranscript,
      setRestoreCheckpointError,
    ]
  )

  const isProjectView = Boolean(
    !isSettingsView &&
      selectedProject &&
      !selectedWorkspace &&
      !selectedChat &&
      !isProjectsView
  )
  const isWorkspaceView = Boolean(!isSettingsView && selectedWorkspace && !selectedChat)
  const isChatView = Boolean(!isSettingsView && selectedChat)
  const settingsDefaultProvider = settingsForm.modelProviders.find(
    (provider) => provider.id === settingsForm.defaultProvider
  )
  const settingsDefaultModels = settingsDefaultProvider?.models ?? []
  const isChatStreaming = chatStatus === "streaming"
  const projectIconValue = selectedProject?.icon?.trim() ?? ""
  const promptDisabled =
    isChatStreaming || !selectedWorkspace || !selectedChat || isTranscriptLoading
  const nextThemeLabel = theme === "dark" ? "Light" : "Dark"

  const viewLabel = isSettingsView
    ? "Settings"
    : isChatView
      ? "Chat Session"
      : isWorkspaceView
        ? "Workspace"
        : isProjectView
          ? "Project"
          : "Home"
  const viewTitle = isSettingsView
    ? "Settings"
    : isProjectsView
      ? "Home"
      : selectedChat?.name ??
        selectedWorkspace?.name ??
        selectedProject?.name ??
        (isLoading ? "Syncing projects" : "Choose a project")
  const viewDescription = isSettingsView
    ? "Manage access tokens and appearance for Maestro."
    : isProjectsView
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
          isSettingsView={isSettingsView}
          selectedProjectId={selectedProjectId}
          selectedWorkspaceId={selectedWorkspaceId}
          selectedChatId={selectedChatId}
          onSelectProjects={handleSelectProjectsView}
          onSelectSettings={handleSelectSettingsView}
          onSelectProject={handleSelectProject}
          onSelectWorkspace={handleSelectWorkspace}
          onSelectChat={handleSelectChat}
        />
      <SidebarRail />
      <SidebarInset>
        <WorkbenchHeader
          isSettingsView={isSettingsView}
          isLoading={isLoading}
          selectedProject={selectedProject}
          selectedWorkspace={selectedWorkspace}
          selectedChat={selectedChat}
          onSelectProjectsView={handleSelectProjectsView}
          onSelectProject={handleSelectProject}
          onSelectWorkspace={handleSelectWorkspace}
        />
        {isSettingsView ? (
          <SettingsView
            settingsForm={settingsForm}
            settingsDefaultModels={settingsDefaultModels}
            settingsError={settingsError}
            settingsSavedMessage={settingsSavedMessage}
            isSavingSettings={isSavingSettings}
            theme={theme}
            nextThemeLabel={nextThemeLabel}
            onToggleTheme={toggleTheme}
            onSettingsSubmit={handleSettingsSubmit}
            onSettingsChange={handleSettingsChange}
            updateModelProvider={updateModelProvider}
            onAddProvider={handleAddProvider}
            onRemoveProvider={handleRemoveProvider}
            onAddModel={handleAddModel}
            onRemoveModel={handleRemoveModel}
            onDefaultProviderChange={handleDefaultProviderChange}
            onDefaultModelChange={handleDefaultModelChange}
          />
        ) : (
          <div className="flex flex-1 flex-col gap-4 p-6">
            <WorkbenchOverview
              isProjectView={isProjectView}
              isWorkspaceView={isWorkspaceView}
              selectedProject={selectedProject}
              selectedWorkspace={selectedWorkspace}
              projectIconValue={projectIconValue}
              viewLabel={viewLabel}
              viewTitle={viewTitle}
              viewDescription={viewDescription}
              projectRepoLabel={projectRepoLabel}
              projectRepoHref={projectRepoHref}
              deletingWorkspace={deletingWorkspace}
              deleteWorkspaceErrors={deleteWorkspaceErrors}
              recentSessionsLimit={recentSessionsLimit}
              recentSessionsForView={recentSessionsForView}
              formatDateTime={formatDateTime}
              onDeleteWorkspace={(workspaceId, workspaceName) =>
                void handleConfirmDeleteWorkspace(workspaceId, workspaceName)
              }
              onSelectChat={handleSelectChat}
            />
            {isProjectsView ? (
              <ProjectsView
                projectForm={projectForm}
                createProjectError={createProjectError}
                isCreatingProject={isCreatingProject}
                isSelectingDirectory={isSelectingDirectory}
                allWorkspaces={allWorkspaces}
                projects={projects}
                isLoading={isLoading}
                error={error}
                sortedPullRequests={sortedPullRequests}
                hasRepoProjects={hasRepoProjects}
                isLoadingPullRequests={isLoadingPullRequests}
                pullRequestsError={pullRequestsError}
                formatDate={formatDate}
                formatDateTime={formatDateTime}
                onCreateProject={handleCreateProject}
                onProjectFormChange={handleProjectFormChange}
                onSelectDirectory={() => void handleSelectDirectory()}
                onSelectWorkspace={handleSelectWorkspace}
                onSelectProject={handleSelectProject}
              />
            ) : showWorkspaceCreator ? (
              selectedProject ? (
                <ProjectWorkspacesTable
                  projectId={selectedProject.id}
                  projectName={selectedProject.name}
                  workspaces={selectedProject.workspaces}
                  pullRequests={projectPullRequests}
                  isLoadingPullRequests={isLoadingPullRequests}
                  pullRequestsError={pullRequestsError}
                  onSelectWorkspace={handleSelectWorkspace}
                  onCreateWorkspace={handleCreateWorkspace}
                  workspaceTitle={workspaceForm.title}
                  onWorkspaceTitleChange={handleWorkspaceFormChange}
                  isCreatingWorkspace={isCreatingWorkspace}
                  createWorkspaceError={createWorkspaceError}
                  formatDateTime={formatDateTime}
                  onMergePullRequest={handleMergePullRequest}
                  mergedPullRequests={mergedPullRequests}
                  mergingPullRequests={mergingPullRequests}
                  mergePullRequestErrors={mergePullRequestErrors}
                  onDeleteMergedWorkspace={handleDeleteMergedWorkspace}
                  deletingMergeWorkspace={deletingMergeWorkspace}
                  deleteMergeWorkspaceErrors={deleteMergeWorkspaceErrors}
                  onDeleteWorkspace={handleDeleteWorkspace}
                  deletingWorkspace={deletingWorkspace}
                  deleteWorkspaceErrors={deleteWorkspaceErrors}
                  getPullRequestKey={getPullRequestKey}
                />
              ) : null
            ) : isWorkspaceView ? (
              <WorkspaceSessionsView
                selectedProject={selectedProject}
                selectedWorkspace={selectedWorkspace}
                createSessionError={createSessionError}
                isCreatingSession={isCreatingSession}
                deletingSessionId={deletingSessionId}
                deleteSessionError={deleteSessionError}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onSelectChat={handleSelectChat}
              />
            ) : isChatView ? (
              <ChatView
                isTranscriptLoading={isTranscriptLoading}
                messages={messages}
                copiedMessageId={copiedMessageId}
                isChatStreaming={isChatStreaming}
                isAwaitingFirstToken={isAwaitingFirstToken}
                restoringCheckpoints={restoringCheckpoints}
                emptyStateSuggestions={emptyStateSuggestions}
                promptDisabled={promptDisabled}
                promptValue={promptValue}
                modelOptions={modelOptions}
                selectedModel={selectedModel}
                isUpdatingModel={isUpdatingModel}
                contextUsage={contextUsage}
                updateModelError={updateModelError}
                chatError={chatError}
                restoreCheckpointError={restoreCheckpointError}
                onSuggestionClick={handleSuggestionClick}
                onPromptSubmit={handlePromptSubmit}
                onPromptChange={handlePromptChange}
                onUpdateSessionModel={handleUpdateSessionModel}
                onCopyMessage={handleCopyMessage}
                onRetryMessage={handleRetryMessage}
                onRestoreCheckpoint={handleRestoreCheckpoint}
              />
            ) : (
              <SecondaryItemsView
                title={secondaryTitle}
                items={secondaryItems}
              />
            )}
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
