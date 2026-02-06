import type { ModelOption } from "../../components/ai-elements/model-selector"
import type {
  ModelProvider,
  OpenPullRequest,
  Project,
  RecentSession,
  WorkspaceSummary,
} from "./types"

const toTimestamp = (value?: string): number => {
  if (!value) {
    return 0
  }
  return new Date(value).getTime() || 0
}

const sortByUpdatedDescending = <T extends { updatedAt?: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
}

export const getActiveProvider = (selectedModel?: string | null): string | null => {
  const normalized = selectedModel?.trim()
  if (!normalized) {
    return null
  }
  const [provider, modelId] = normalized.split("/")
  return modelId ? provider : null
}

export const collectSettingsModels = (providers: ModelProvider[]): string[] => {
  return providers.flatMap((provider) =>
    provider.models
      .map((model) => model.id?.trim())
      .filter(Boolean)
      .map((modelId) => (modelId.includes("/") ? modelId : `${provider.id}/${modelId}`))
  )
}

export const buildModelOptions = ({
  fallbackModel,
  availableModels,
  settingsModels,
  selectedChatModel,
  activeProvider,
}: {
  fallbackModel: string
  availableModels: string[]
  settingsModels: string[]
  selectedChatModel?: string
  activeProvider?: string | null
}): ModelOption[] => {
  const candidates = [fallbackModel, ...availableModels, ...settingsModels, selectedChatModel].filter(
    (value): value is string => Boolean(value)
  )

  const seen = new Set<string>()
  const options: ModelOption[] = []
  for (const model of candidates) {
    const normalized = model.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    const [provider, modelId] = normalized.split("/")
    if (activeProvider && modelId && provider && provider !== activeProvider) {
      continue
    }
    seen.add(normalized)
    options.push({
      id: normalized,
      label: modelId || normalized,
      description: modelId && provider ? provider : undefined,
    })
  }
  return options
}

export const collectRecentSessions = (projects: Project[], limit: number): RecentSession[] => {
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

  return sortByUpdatedDescending(sessions).slice(0, limit)
}

export const collectProjectRecentSessions = (
  project: Project | null,
  limit: number
): RecentSession[] => {
  if (!project) {
    return []
  }

  const sessions: RecentSession[] = []
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

  return sortByUpdatedDescending(sessions).slice(0, limit)
}

export const collectAllWorkspaces = (projects: Project[]): WorkspaceSummary[] => {
  const workspaces = projects.flatMap((project) =>
    project.workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      projectId: project.id,
      projectName: project.name,
      updatedAt: workspace.updatedAt ?? workspace.createdAt,
    }))
  )

  return sortByUpdatedDescending(workspaces)
}

export const sortOpenPullRequests = (items: OpenPullRequest[]): OpenPullRequest[] => {
  return sortByUpdatedDescending(items)
}

export const filterProjectPullRequests = (
  pullRequests: OpenPullRequest[],
  selectedProjectId?: string
): OpenPullRequest[] => {
  if (!selectedProjectId) {
    return []
  }
  return pullRequests.filter((item) => item.projectId === selectedProjectId)
}

export const hasProjectsWithRepos = (projects: Project[]): boolean => {
  return projects.some((project) => project.repoUrl?.trim())
}
