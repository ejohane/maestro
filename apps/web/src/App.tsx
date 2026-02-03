import * as React from "react"

import { AppSidebar } from "./components/app-sidebar"
import { ProjectWorkspacesTable } from "./components/project-workspaces-table"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "./components/ai-elements/conversation"
import { Loader } from "./components/ai-elements/loader"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageCheckpoint,
  MessageContent,
  MessageAttachments,
  MessageResponse,
  MessageToolbar,
} from "./components/ai-elements/message"
import {
  CitationAnchor,
  CitationProvider,
  prepareCitationMarkdown,
  SourcesList,
} from "./components/ai-elements/sources"
import { ReasoningSection } from "./components/ai-elements/reasoning"
import {
  ToolInvocationCard,
  ToolResultCard,
} from "./components/ai-elements/tool-invocation"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
  usePromptInputAttachments,
} from "./components/ai-elements/prompt-input"
import { ModelSelector, type ModelOption } from "./components/ai-elements/model-selector"
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
import type { FileReference, MessageRole, SourceCitation } from "@maestro/core"
import { Check, Copy, RotateCcw } from "lucide-react"
import {
  applyMessageDelta,
  applyMessageEnd,
  applyMessagePartUpdate,
  createClientMessage,
  getTextFromParts,
  normalizeMessageParts,
  type ClientMessage,
  type StructuredMessagePart,
} from "./lib/messages"

const PromptInputAttachmentsPreview = () => {
  const attachments = usePromptInputAttachments()

  if (!attachments.files.length) {
    return null
  }

  const items = attachments.files.map((file) => ({
    id: file.id,
    name: file.filename,
    path: file.url,
    mimeType: file.mediaType,
    size: file.size,
    source: "upload" as const,
  }))

  return (
    <PromptInputHeader className="text-foreground">
      <MessageAttachments attachments={items} onRemove={attachments.remove} />
    </PromptInputHeader>
  )
}

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
  number: string
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
  role: MessageRole
  content?: string
  parts?: StructuredMessagePart[]
  metadata?: Record<string, unknown>
}

type ApiModelsResponse = {
  defaultModel: string
  models: string[]
}

type CreateConversationResponse = {
  project: ApiProject
  conversation: ApiConversation
  session: ApiSession
}

type ChatSession = {
  id: string
  name: string
  model?: string
  createdAt?: string
  updatedAt?: string
}

type Workspace = {
  id: string
  name: string
  branch?: string
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

type MergedPullRequestAction = {
  workspaceId?: string
  workspaceName?: string
  workspaceDeleted?: boolean
}
type ChatMessage = ClientMessage
type ModelProviderModel = {
  id: string
  name?: string
}

type ModelProvider = {
  id: string
  name?: string
  models: ModelProviderModel[]
}

type CheckpointMarker = {
  id: string
  label: string
  description?: string
  status?: string
  timestamp?: string
}

type MessageBranchEntry = {
  id: string
  content: string
  parts: StructuredMessagePart[]
  sources: SourceCitation[]
  label?: string
}

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
  const [sessionForm, setSessionForm] = React.useState({
    title: "",
    providerId: "",
    modelId: "",
  })
  const [isCreatingSession, setIsCreatingSession] = React.useState(false)
  const [createSessionError, setCreateSessionError] = React.useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = React.useState<string | null>(null)
  const [deleteSessionError, setDeleteSessionError] = React.useState<string | null>(null)
  const [isDeletingWorkspace, setIsDeletingWorkspace] = React.useState(false)
  const [deleteWorkspaceError, setDeleteWorkspaceError] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null)
  const [chatStatus, setChatStatus] = React.useState<"idle" | "streaming" | "error">(
    "idle"
  )
  const [chatError, setChatError] = React.useState<string | null>(null)
  const [promptValue, setPromptValue] = React.useState("")
  const [isTranscriptLoading, setIsTranscriptLoading] = React.useState(false)
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = React.useState(false)
  const streamAbortRef = React.useRef<AbortController | null>(null)
  const transcriptAbortRef = React.useRef<AbortController | null>(null)
  const copyTimeoutRef = React.useRef<number | null>(null)
  const [openPullRequests, setOpenPullRequests] = React.useState<OpenPullRequest[]>([])
  const [isLoadingPullRequests, setIsLoadingPullRequests] = React.useState(false)
  const [pullRequestsError, setPullRequestsError] = React.useState<string | null>(null)
  const [settingsForm, setSettingsForm] = React.useState({
    githubToken: "",
    gotlandToken: "",
    modelProviders: [] as ModelProvider[],
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
  const modelOptions = React.useMemo(() => {
    const candidates = [fallbackModel, ...availableModels, selectedChat?.model].filter(
      (value): value is string => Boolean(value)
    )
    const seen = new Set<string>()
    const options: ModelOption[] = []
    for (const model of candidates) {
      const normalized = model.trim()
      if (!normalized || seen.has(normalized)) {
        continue
      }
      seen.add(normalized)
      const [provider, modelId] = normalized.split("/")
      const label = modelId ? modelId : normalized
      const description = modelId && provider ? provider : undefined
      options.push({ id: normalized, label, description })
    }
    return options
  }, [availableModels, fallbackModel, selectedChat?.model])
  const selectedModel = selectedChat?.model ?? fallbackModel

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

  const getSourcesFromParts = (parts: StructuredMessagePart[]): SourceCitation[] => {
    return parts
      .filter(
        (
          part
        ): part is StructuredMessagePart & {
          type: "sources"
          sources: SourceCitation[]
        } => part.type === "sources"
      )
      .flatMap((part) => part.sources)
      .filter((source): source is SourceCitation => Boolean(source))
  }

  const getCheckpointMarkers = (
    parts: StructuredMessagePart[],
    messageId: string
  ): CheckpointMarker[] => {
    return parts
      .filter(
        (
          part
        ): part is StructuredMessagePart & { type: "data-checkpoint"; data?: unknown } =>
          part.type === "data-checkpoint"
      )
      .map((part, index) => {
        const data =
          part.data && typeof part.data === "object" ? (part.data as Record<string, unknown>) : {}
        const labelCandidate =
          typeof part.label === "string"
            ? part.label
            : typeof data.label === "string"
              ? data.label
              : typeof data.name === "string"
                ? data.name
                : undefined
        const label = labelCandidate?.trim() || `Checkpoint ${index + 1}`
        const description =
          typeof data.description === "string"
            ? data.description
            : typeof data.detail === "string"
              ? data.detail
              : undefined
        const status = typeof data.status === "string" ? data.status : undefined
        const timestamp =
          typeof data.timestamp === "string"
            ? data.timestamp
            : typeof data.ts === "string"
              ? data.ts
              : undefined
        return {
          id: part.id ?? `${messageId}-checkpoint-${index}`,
          label,
          description,
          status,
          timestamp,
        }
      })
  }

  const parseBranchEntries = (
    value: unknown,
    messageId: string
  ): MessageBranchEntry[] => {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((branch, index) => {
        if (typeof branch === "string") {
          const content = branch.trim()
          if (!content) {
            return null
          }
          const parts = normalizeMessageParts(content)
          return {
            id: `${messageId}-branch-${index}`,
            content,
            parts,
            sources: getSourcesFromParts(parts),
          }
        }

        if (branch && typeof branch === "object") {
          const record = branch as Record<string, unknown>
          const contentValue =
            typeof record.content === "string"
              ? record.content
              : typeof record.text === "string"
                ? record.text
                : ""
          const partsValue = Array.isArray(record.parts)
            ? (record.parts as StructuredMessagePart[])
            : normalizeMessageParts(contentValue)
          const sourcesValue = Array.isArray(record.sources)
            ? (record.sources as SourceCitation[]).filter(Boolean)
            : getSourcesFromParts(partsValue)
          const content = contentValue || getTextFromParts(partsValue)
          if (!content.trim()) {
            return null
          }
          const label = typeof record.label === "string" ? record.label : undefined
          return {
            id:
              typeof record.id === "string"
                ? record.id
                : `${messageId}-branch-${index}`,
            content,
            parts: partsValue,
            sources: sourcesValue,
            label,
          }
        }

        return null
      })
      .filter((branch): branch is MessageBranchEntry => Boolean(branch))
  }

  const getMessageBranches = (
    message: ChatMessage,
    baseText: string,
    baseSources: SourceCitation[]
  ) => {
    const metadata =
      message.metadata && typeof message.metadata === "object"
        ? (message.metadata as Record<string, unknown>)
        : undefined
    const metadataBranches = metadata?.branches
    const dataBranchParts = message.parts.filter(
      (part) => part.type === "data-branch" || part.type === "data-branches"
    ) as Array<StructuredMessagePart & { data?: unknown }>
    const parsedBranches = [
      ...parseBranchEntries(metadataBranches, message.id),
      ...dataBranchParts.flatMap((part) => {
        if (Array.isArray(part.data)) {
          return parseBranchEntries(part.data, message.id)
        }
        if (part.data && typeof part.data === "object") {
          const record = part.data as Record<string, unknown>
          if (Array.isArray(record.branches)) {
            return parseBranchEntries(record.branches, message.id)
          }
        }
        return []
      }),
    ]

    const normalizedBase = baseText.trim()
    const uniqueBranches = parsedBranches.filter(
      (branch) => branch.content.trim() && branch.content.trim() !== normalizedBase
    )
    const baseBranch = normalizedBase
      ? [
          {
            id: `${message.id}-branch-base`,
            content: baseText,
            parts: message.parts,
            sources: baseSources,
          },
        ]
      : []
    const branches = [...baseBranch, ...uniqueBranches]
    const metadataBranchIndex =
      typeof metadata?.branchIndex === "number" ? metadata.branchIndex : undefined
    const defaultBranch =
      typeof metadataBranchIndex === "number" &&
      metadataBranchIndex >= 0 &&
      metadataBranchIndex < branches.length
        ? metadataBranchIndex
        : 0

    return { branches, defaultBranch }
  }

  React.useEffect(() => {
    streamAbortRef.current?.abort()
    transcriptAbortRef.current?.abort()
    setMessages([])
    setPromptValue("")
    setChatStatus("idle")
    setChatError(null)
    setIsAwaitingFirstToken(false)
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
    setDeleteWorkspaceError(null)
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

  const handleSessionFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSessionForm((prev) => ({ ...prev, title: value }))
  }

  const handleSessionProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSessionForm((prev) => {
      const provider = settingsForm.modelProviders.find((item) => item.id === value)
      const modelId = provider?.models[0]?.id ?? ""
      return { ...prev, providerId: value, modelId }
    })
  }

  const handleSessionModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSessionForm((prev) => ({ ...prev, modelId: value }))
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
      setSessionForm((prev) => ({ ...prev, title: "" }))
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

  const handleToolApproval = (
    messageId: string,
    callId: string,
    status: "approved" | "rejected"
  ) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) {
          return message
        }
        const nextParts = message.parts.map((part) => {
          if (part.type !== "tool" || part.callId !== callId) {
            return part
          }
          return {
            ...part,
            approval: {
              ...(part.approval ?? {}),
              status,
            },
          }
        })
        return { ...message, parts: nextParts }
      })
    )
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
    !isSettingsView &&
      selectedProject &&
      !selectedWorkspace &&
      !selectedChat &&
      !isProjectsView
  )
  const isWorkspaceView = Boolean(!isSettingsView && selectedWorkspace && !selectedChat)
  const isChatView = Boolean(!isSettingsView && selectedChat)
  const sessionProvider = settingsForm.modelProviders.find(
    (provider) => provider.id === sessionForm.providerId
  )
  const sessionModels = sessionProvider?.models ?? []
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
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {isSettingsView ? (
                <BreadcrumbItem>
                  <BreadcrumbPage>Settings</BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                <>
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
                              handleSelectWorkspace(
                                selectedProject.id,
                                selectedWorkspace.id
                              )
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
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        {isSettingsView ? (
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Settings
              </div>
              <div className="mt-3 text-2xl font-semibold text-foreground">
                Maestro preferences
              </div>
              <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Manage access tokens and appearance for this device.
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
              <Card>
                <form onSubmit={handleSettingsSubmit}>
                  <CardHeader>
                    <CardTitle>Access tokens</CardTitle>
                    <CardDescription>
                      Keep your GitHub and Gotland integrations up to date.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        GitHub token
                      </label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={settingsForm.githubToken}
                        onChange={handleSettingsChange("githubToken")}
                        placeholder="ghp_..."
                      />
                      <div className="text-xs text-muted-foreground">
                        Leave blank to clear. Environment variable GITHUB_TOKEN
                        overrides this value.
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Gotland token
                      </label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={settingsForm.gotlandToken}
                        onChange={handleSettingsChange("gotlandToken")}
                        placeholder="gotland_..."
                      />
                      <div className="text-xs text-muted-foreground">
                        Stored locally in ~/.maestro/settings.json.
                      </div>
                    </div>
                    <div className="h-px w-full bg-border/60" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Model providers
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Seeded from OpenCode, fully editable.
                        </div>
                      </div>
                      <Button type="button" variant="outline" onClick={handleAddProvider}>
                        Add provider
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Default provider
                        </label>
                        <select
                          value={settingsForm.defaultProvider}
                          onChange={handleDefaultProviderChange}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        >
                          {settingsForm.modelProviders.length ? (
                            settingsForm.modelProviders.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name?.trim() || provider.id}
                              </option>
                            ))
                          ) : (
                            <option value="">No providers available</option>
                          )}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Default model
                        </label>
                        <select
                          value={settingsForm.defaultModel}
                          onChange={handleDefaultModelChange}
                          disabled={!settingsDefaultModels.length}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        >
                          {settingsDefaultModels.length ? (
                            settingsDefaultModels.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name?.trim() || model.id}
                              </option>
                            ))
                          ) : (
                            <option value="">No models available</option>
                          )}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {settingsForm.modelProviders.length ? (
                        settingsForm.modelProviders.map((provider, providerIndex) => (
                          <div
                            key={`${provider.id}-${providerIndex}`}
                            className="rounded-lg border bg-muted/20 p-4"
                          >
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                              <div className="grid gap-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Provider name
                                </label>
                                <Input
                                  value={provider.name ?? ""}
                                  onChange={(event) =>
                                    updateModelProvider(providerIndex, (current) => ({
                                      ...current,
                                      name: event.target.value,
                                    }))
                                  }
                                  placeholder="OpenAI"
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Provider id
                                </label>
                                <Input
                                  value={provider.id}
                                  onChange={(event) =>
                                    updateModelProvider(providerIndex, (current) => ({
                                      ...current,
                                      id: event.target.value,
                                    }))
                                  }
                                  placeholder="openai"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleRemoveProvider(providerIndex)}
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="mt-4 grid gap-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-foreground">Models</div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddModel(providerIndex)}
                                >
                                  Add model
                                </Button>
                              </div>
                              {provider.models.length ? (
                                provider.models.map((model, modelIndex) => (
                                  <div
                                    key={`${model.id}-${modelIndex}`}
                                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                                  >
                                    <div className="grid gap-2">
                                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Model name
                                      </label>
                                      <Input
                                        value={model.name ?? ""}
                                        onChange={(event) =>
                                          updateModelProvider(providerIndex, (current) => ({
                                            ...current,
                                            models: current.models.map((item, index) =>
                                              index === modelIndex
                                                ? { ...item, name: event.target.value }
                                                : item
                                            ),
                                          }))
                                        }
                                        placeholder="GPT-5.2 Codex"
                                      />
                                    </div>
                                    <div className="grid gap-2">
                                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Model id
                                      </label>
                                      <Input
                                        value={model.id}
                                        onChange={(event) =>
                                          updateModelProvider(providerIndex, (current) => ({
                                            ...current,
                                            models: current.models.map((item, index) =>
                                              index === modelIndex
                                                ? { ...item, id: event.target.value }
                                                : item
                                            ),
                                          }))
                                        }
                                        placeholder="gpt-5.2-codex"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() =>
                                        handleRemoveModel(providerIndex, modelIndex)
                                      }
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                  No models yet. Add one to enable selection.
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                          No providers yet. Add one or check OpenCode connection.
                        </div>
                      )}
                    </div>
                    {settingsError ? (
                      <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {settingsError}
                      </div>
                    ) : null}
                    {settingsSavedMessage ? (
                      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                        {settingsSavedMessage}
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isSavingSettings}>
                      {isSavingSettings ? "Saving..." : "Save settings"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>
                      Choose the theme that feels best for long sessions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Theme</div>
                        <div className="text-xs text-muted-foreground">
                          Currently set to {theme === "dark" ? "dark" : "light"} mode.
                        </div>
                      </div>
                      <Button type="button" variant="outline" onClick={toggleTheme}>
                        Switch to {nextThemeLabel}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>
                      Tokens stay on this machine unless you export them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Maestro uses environment variables first, then falls back to your local
                    settings file if needed.
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
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
                getPullRequestKey={getPullRequestKey}
              />
            ) : null
          ) : isWorkspaceView ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card className="border-dashed">
                <form onSubmit={handleCreateSession}>
                  <CardHeader>
                    <CardTitle>Create a new session</CardTitle>
                    <CardDescription>
                      Start a focused chat within this workspace. OpenCode will name it.
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
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Provider
                      </label>
                      <select
                        value={sessionForm.providerId}
                        onChange={handleSessionProviderChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      >
                        {settingsForm.modelProviders.length ? (
                          settingsForm.modelProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name?.trim() || provider.id}
                            </option>
                          ))
                        ) : (
                          <option value="">No providers available</option>
                        )}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Model
                      </label>
                      <select
                        value={sessionForm.modelId}
                        onChange={handleSessionModelChange}
                        disabled={!sessionModels.length}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      >
                        {sessionModels.length ? (
                          sessionModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name?.trim() || model.id}
                            </option>
                          ))
                        ) : (
                          <option value="">No models available</option>
                        )}
                      </select>
                      <div className="text-xs text-muted-foreground">
                        Manage providers and models from Settings.
                      </div>
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
            <Conversation className="min-h-[520px] rounded-xl border bg-card shadow-sm">
              <ConversationContent className="gap-4">
                {isTranscriptLoading ? (
                  <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                    <Loader className="mr-2" /> Loading transcript...
                  </div>
                ) : messages.length ? (
                  messages.map((message, messageIndex) => {
                    const attachmentParts = message.parts.filter(
                      (part): part is StructuredMessagePart & {
                        type: "file"
                        file: FileReference
                      } => part.type === "file"
                    )
                    const attachments = attachmentParts.map((part, index) => {
                      const file = part.file
                      return {
                        id: file.id || part.id || `attachment-${message.id}-${index}`,
                        name: file.name,
                        path: file.path,
                        mimeType: file.mimeType,
                        size: file.size,
                        source: file.source,
                      }
                    })
                    const reasoningParts = message.parts.filter(
                      (part): part is StructuredMessagePart & { type: "reasoning" } =>
                        part.type === "reasoning"
                    )
                    const reasoningText = reasoningParts
                      .map((part) => part.text)
                      .filter(
                        (text): text is string =>
                          typeof text === "string" && text.trim().length > 0
                      )
                      .join("\n\n")
                    const toolParts = message.parts.filter(
                      (
                        part
                      ): part is StructuredMessagePart & {
                        type: "tool" | "tool_result"
                      } => part.type === "tool" || part.type === "tool_result"
                    )
                    const sources = getSourcesFromParts(message.parts)
                    const messageText = getTextFromParts(message.parts) || message.content || ""
                    const hasMessageText = Boolean(messageText)
                    const messageMarkdown = prepareCitationMarkdown(messageText, sources)
                    const showReasoning = message.role === "assistant" && Boolean(reasoningText)
                    const checkpointMarkers = getCheckpointMarkers(message.parts, message.id)
                    const { branches: messageBranches, defaultBranch } = getMessageBranches(
                      message,
                      messageText,
                      sources
                    )
                    const hasBranches = messageBranches.length > 1
                    const isCopied = copiedMessageId === message.id
                    const lastUserMessageText =
                      message.role === "assistant"
                        ? (() => {
                            for (let index = messageIndex; index >= 0; index -= 1) {
                              const candidate = messages[index]
                              if (candidate?.role !== "user") {
                                continue
                              }
                              const candidateText =
                                getTextFromParts(candidate.parts) ||
                                candidate.content ||
                                ""
                              if (candidateText.trim()) {
                                return candidateText
                              }
                            }
                            return ""
                          })()
                        : ""
                    const canRetry =
                      message.role === "assistant" &&
                      !message.isStreaming &&
                      !isChatStreaming &&
                      Boolean(lastUserMessageText.trim())
                    const canCopy = Boolean(messageText.trim())
                    const showActions = canCopy || canRetry
                    const showToolbar = showActions || hasBranches
                    const toolbarClassName = hasBranches ? undefined : "justify-end"
                    const actionButtons = showActions ? (
                      <MessageActions>
                        {canCopy ? (
                          <MessageAction
                            aria-label={isCopied ? "Copied" : "Copy message"}
                            label={isCopied ? "Copied" : "Copy message"}
                            onClick={() => void handleCopyMessage(message.id, messageText)}
                            tooltip={isCopied ? "Copied" : "Copy"}
                          >
                            {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          </MessageAction>
                        ) : null}
                        {canRetry ? (
                          <MessageAction
                            aria-label="Retry"
                            label="Retry"
                            onClick={() => handleRetryMessage(messageIndex)}
                            tooltip="Retry"
                          >
                            <RotateCcw className="size-3.5" />
                          </MessageAction>
                        ) : null}
                      </MessageActions>
                    ) : null

                    return (
                      <Message key={message.id} from={message.role}>
                        <MessageContent>
                          {attachments.length ? (
                            <MessageAttachments attachments={attachments} />
                          ) : null}
                          {checkpointMarkers.length ? (
                            <div className="flex flex-wrap gap-2">
                              {checkpointMarkers.map((checkpoint) => (
                                <MessageCheckpoint
                                  key={checkpoint.id}
                                  label={checkpoint.label}
                                  description={checkpoint.description}
                                  status={checkpoint.status}
                                  timestamp={checkpoint.timestamp}
                                />
                              ))}
                            </div>
                          ) : null}
                          {message.role === "assistant" ? (
                            <>
                              {showReasoning ? (
                                <ReasoningSection
                                  text={reasoningText}
                                  isStreaming={message.isStreaming}
                                />
                              ) : null}
                              {toolParts.length ? (
                                <div className="grid gap-2">
                                  {toolParts.map((part, index) =>
                                    part.type === "tool" ? (
                                      <ToolInvocationCard
                                        key={part.id ?? `${message.id}-tool-${index}`}
                                        call={part}
                                        isStreaming={message.isStreaming}
                                        onApprove={
                                          part.approval?.status === "pending"
                                            ? () =>
                                                handleToolApproval(
                                                  message.id,
                                                  part.callId,
                                                  "approved"
                                                )
                                            : undefined
                                        }
                                        onReject={
                                          part.approval?.status === "pending"
                                            ? () =>
                                                handleToolApproval(
                                                  message.id,
                                                  part.callId,
                                                  "rejected"
                                                )
                                            : undefined
                                        }
                                      />
                                    ) : (
                                      <ToolResultCard
                                        key={part.id ?? `${message.id}-tool-result-${index}`}
                                        result={part}
                                      />
                                    )
                                  )}
                                </div>
                              ) : null}
                              {hasBranches ? (
                                <MessageBranch defaultBranch={defaultBranch}>
                                  <MessageBranchContent>
                                    {messageBranches.map((branch) => {
                                      const branchMarkdown = prepareCitationMarkdown(
                                        branch.content,
                                        branch.sources
                                      )

                                      return (
                                        <div className="grid gap-2" key={branch.id}>
                                          <CitationProvider sources={branch.sources}>
                                            <MessageResponse components={{ a: CitationAnchor }}>
                                              {branchMarkdown}
                                            </MessageResponse>
                                          </CitationProvider>
                                          {branch.sources.length ? (
                                            <SourcesList sources={branch.sources} />
                                          ) : null}
                                        </div>
                                      )
                                    })}
                                  </MessageBranchContent>
                                  {showToolbar ? (
                                    <MessageToolbar className={toolbarClassName}>
                                      {actionButtons}
                                      <MessageBranchSelector from={message.role}>
                                        <MessageBranchPrevious />
                                        <MessageBranchPage />
                                        <MessageBranchNext />
                                      </MessageBranchSelector>
                                    </MessageToolbar>
                                  ) : null}
                                </MessageBranch>
                              ) : hasMessageText ? (
                                <>
                                  <CitationProvider sources={sources}>
                                    <MessageResponse components={{ a: CitationAnchor }}>
                                      {messageMarkdown}
                                    </MessageResponse>
                                  </CitationProvider>
                                  {sources.length ? <SourcesList sources={sources} /> : null}
                                  {showToolbar ? (
                                    <MessageToolbar className={toolbarClassName}>
                                      {actionButtons}
                                    </MessageToolbar>
                                  ) : null}
                                </>
                              ) : showToolbar ? (
                                <MessageToolbar className={toolbarClassName}>
                                  {actionButtons}
                                </MessageToolbar>
                              ) : null}
                              {message.isStreaming && !hasMessageText && isAwaitingFirstToken ? (
                                <span className="inline-flex items-center gap-2 text-muted-foreground">
                                  <Loader /> Waiting for response...
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <CitationProvider sources={sources}>
                                <MessageResponse components={{ a: CitationAnchor }}>
                                  {messageMarkdown}
                                </MessageResponse>
                              </CitationProvider>
                              {showToolbar ? (
                                <MessageToolbar className={toolbarClassName}>
                                  {actionButtons}
                                </MessageToolbar>
                              ) : null}
                            </>
                          )}
                        </MessageContent>
                      </Message>
                    )
                  })
                ) : (
                  <ConversationEmptyState
                    className="min-h-[320px]"
                  >
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium">No messages yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Ask a question to start the session.
                        </p>
                      </div>
                      <div className="flex w-full max-w-xl flex-wrap justify-center gap-2">
                        {emptyStateSuggestions.map((suggestion) => (
                          <Button
                            key={suggestion}
                            className="rounded-full text-xs"
                            disabled={promptDisabled}
                            onClick={() => handleSuggestionClick(suggestion)}
                            size="xs"
                            type="button"
                            variant="outline"
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </ConversationEmptyState>
                )}
              </ConversationContent>
              <ConversationScrollButton />
              <div className="border-t bg-background/80 p-4">
                <PromptInput multiple onSubmit={handlePromptSubmit}>
                  <PromptInputAttachmentsPreview />
                  <PromptInputTextarea
                    value={promptValue}
                    onChange={handlePromptChange}
                    placeholder="Ask for a review, summary, or next steps..."
                    disabled={promptDisabled}
                  />
                  <PromptInputFooter>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <PromptInputTools>
                        <ModelSelector
                          models={modelOptions}
                          value={selectedModel}
                          disabled={promptDisabled || isUpdatingModel}
                          onSelect={handleUpdateSessionModel}
                        />
                        <PromptInputActionMenu>
                          <PromptInputActionMenuTrigger
                            aria-label="Prompt actions"
                            disabled={promptDisabled}
                          />
                          <PromptInputActionMenuContent>
                            <PromptInputActionAddAttachments disabled={promptDisabled} />
                          </PromptInputActionMenuContent>
                        </PromptInputActionMenu>
                      </PromptInputTools>
                      <span>Shift + Enter for a new line</span>
                    </div>
                    <PromptInputSubmit
                      type="submit"
                      disabled={promptDisabled || !promptValue.trim()}
                    >
                      {isChatStreaming ? "Streaming..." : "Send"}
                    </PromptInputSubmit>
                  </PromptInputFooter>
                </PromptInput>
                {updateModelError ? (
                  <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {updateModelError}
                  </div>
                ) : null}
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
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
