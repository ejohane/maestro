import type { MessageRole, SourceCitation } from "@maestro/core"

import type { PlanStep } from "../../components/ai-elements/plan"
import type { TaskItem } from "../../components/ai-elements/task-queue"
import type { ClientMessage, StructuredMessagePart } from "../../lib/messages"

export type GitProvider = "github" | "gitlab"

export type ApiProject = {
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

export type ApiConversation = {
  id: string
  projectId: string
  title?: string
  branch: string
  workspacePath: string
  createdAt: string
  updatedAt: string
}

export type ApiSession = {
  id: string
  conversationId: string
  title?: string
  model?: string
  createdAt: string
  updatedAt: string
}

export type ApiPullRequest = {
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

export type ApiTranscriptEntry = {
  role: MessageRole
  content?: string
  parts?: StructuredMessagePart[]
  metadata?: Record<string, unknown>
}

export type ApiModelsResponse = {
  defaultModel: string
  models: string[]
}

export type CreateConversationResponse = {
  project: ApiProject
  conversation: ApiConversation
  session: ApiSession
}

export type ChatSession = {
  id: string
  name: string
  model?: string
  createdAt?: string
  updatedAt?: string
}

export type Workspace = {
  id: string
  name: string
  branch?: string
  chats: ChatSession[]
  createdAt?: string
  updatedAt?: string
}

export type Project = {
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

export type RecentSession = {
  id: string
  name: string
  projectId: string
  projectName: string
  workspaceId: string
  workspaceName: string
  updatedAt?: string
}

export type OpenPullRequest = ApiPullRequest & {
  projectId: string
  projectName: string
}

export type MergedPullRequestAction = {
  workspaceId?: string
  workspaceName?: string
  workspaceDeleted?: boolean
}

export type ChatMessage = ClientMessage

export type ModelProviderModel = {
  id: string
  name?: string
}

export type ModelProvider = {
  id: string
  name?: string
  models: ModelProviderModel[]
}

export type ProjectFormState = {
  name: string
  repoPath: string
  defaultBranch: string
  gitProvider: string
  repoUrl: string
}

export type WorkspaceFormState = {
  title: string
}

export type SessionFormState = {
  providerId: string
  modelId: string
}

export type SettingsFormState = {
  githubToken: string
  gotlandToken: string
  modelProviders: ModelProvider[]
  defaultProvider: string
  defaultModel: string
}

export type CheckpointRestore = {
  messageId?: string
  partId?: string
  url?: string
  method?: string
  payload?: unknown
  label?: string
}

export type CheckpointMarker = {
  id: string
  label: string
  description?: string
  status?: string
  timestamp?: string
  restore?: CheckpointRestore
}

export type PlanEntry = {
  id: string
  title?: string
  summary?: string
  steps: PlanStep[]
  isStreaming?: boolean
}

export type TaskEntry = {
  id: string
  title?: string
  summary?: string
  items: TaskItem[]
  isStreaming?: boolean
}

export type QueueEntry = TaskEntry & {
  totalCount?: number
}

export type MessageBranchEntry = {
  id: string
  content: string
  parts: StructuredMessagePart[]
  sources: SourceCitation[]
  label?: string
}

export type WorkspaceSummary = {
  id: string
  name: string
  projectId: string
  projectName: string
  updatedAt?: string
}
