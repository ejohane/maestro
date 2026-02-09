import * as React from "react"

import { createProject, selectDirectory } from "../api/projects"
import { createDefaultProjectFormState } from "../project-form"
import { useWorkbench } from "../workbench-context"
import type {
  ApiSession,
  ChatSession,
  CreateConversationResponse,
  ProjectFormState,
  SessionFormState,
  SettingsFormState,
  WorkspaceFormState,
} from "../types"

type SettingsContext = {
  settingsForm: SettingsFormState
  addAvailableModel: (model: string) => void
}

type ProjectsControllerState = {
  projectForm: ProjectFormState
  isCreatingProject: boolean
  isSelectingDirectory: boolean
  createProjectError: string | null
  workspaceForm: WorkspaceFormState
  isCreatingWorkspace: boolean
  createWorkspaceError: string | null
  sessionForm: SessionFormState
  isCreatingSession: boolean
  createSessionError: string | null
  deletingSessionId: string | null
  deleteSessionError: string | null
  deletingWorkspace: Record<string, boolean>
  deleteWorkspaceErrors: Record<string, string>
  isUpdatingModel: boolean
  updateModelError: string | null
}

type ProjectsControllerActions = {
  onProjectFormChange: (
    field: keyof ProjectFormState
  ) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onWorkspaceFormChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSelectDirectory: () => Promise<void>
  onCreateProject: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onCreateWorkspace: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onDeleteWorkspace: (workspaceId: string, workspaceName?: string) => Promise<boolean>
  onConfirmDeleteWorkspace: (
    workspaceId: string,
    workspaceName?: string
  ) => Promise<boolean>
  onCreateSession: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onDeleteSession: (sessionId: string) => Promise<void>
  onUpdateSessionModel: (modelId: string) => Promise<void>
}

type ProjectsController = {
  state: ProjectsControllerState
  actions: ProjectsControllerActions
}

export const useProjectsController = (settings: SettingsContext): ProjectsController => {
  const { state: workbenchState, actions, meta } = useWorkbench()
  const { selectedWorkspaceId, selectedChatId } = workbenchState
  const { selectedProject, selectedWorkspace, selectedChat } = meta

  const [projectForm, setProjectForm] = React.useState<ProjectFormState>(
    createDefaultProjectFormState()
  )
  const [isCreatingProject, setIsCreatingProject] = React.useState(false)
  const [isSelectingDirectory, setIsSelectingDirectory] = React.useState(false)
  const [createProjectError, setCreateProjectError] = React.useState<string | null>(null)
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
  const [deletingWorkspace, setDeletingWorkspace] = React.useState<Record<string, boolean>>(
    {}
  )
  const [deleteWorkspaceErrors, setDeleteWorkspaceErrors] = React.useState<
    Record<string, string>
  >({})
  const [isUpdatingModel, setIsUpdatingModel] = React.useState(false)
  const [updateModelError, setUpdateModelError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (settings.settingsForm.modelProviders.length === 0) {
      return
    }
    setSessionForm((prev) => {
      const providerIds = settings.settingsForm.modelProviders.map(
        (provider) => provider.id
      )
      const resolvedProviderId = providerIds.includes(prev.providerId)
        ? prev.providerId
        : providerIds.includes(settings.settingsForm.defaultProvider)
          ? settings.settingsForm.defaultProvider
          : settings.settingsForm.modelProviders[0]?.id || ""
      const provider = settings.settingsForm.modelProviders.find(
        (item) => item.id === resolvedProviderId
      )
      const modelIds = provider?.models.map((model) => model.id) ?? []
      const resolvedModelId = modelIds.includes(prev.modelId)
        ? prev.modelId
        : modelIds.includes(settings.settingsForm.defaultModel)
          ? settings.settingsForm.defaultModel
          : provider?.models[0]?.id || ""
      if (resolvedProviderId === prev.providerId && resolvedModelId === prev.modelId) {
        return prev
      }
      return {
        ...prev,
        providerId: resolvedProviderId,
        modelId: resolvedModelId,
      }
    })
  }, [
    settings.settingsForm.modelProviders,
    settings.settingsForm.defaultProvider,
    settings.settingsForm.defaultModel,
  ])

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

  const onProjectFormChange = (field: keyof ProjectFormState) => {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value
      setProjectForm((prev) => ({ ...prev, [field]: value }))
    }
  }

  const onWorkspaceFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setWorkspaceForm({ title: value })
  }

  const onSelectDirectory = async () => {
    setIsSelectingDirectory(true)
    setCreateProjectError(null)
    try {
      const path = await selectDirectory({
        startPath: projectForm.repoPath.trim() || undefined,
      })
      if (path) {
        setProjectForm((prev) => ({ ...prev, repoPath: path }))
      }
    } catch (err) {
      setCreateProjectError(
        err instanceof Error ? err.message : "Failed to select folder."
      )
    } finally {
      setIsSelectingDirectory(false)
    }
  }

  const onCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
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
      const createdProject = await createProject({
        name,
        defaultBranch,
        repoPath: repoPath || undefined,
        gitProvider: projectForm.gitProvider || undefined,
        repoUrl: projectForm.repoUrl.trim() || undefined,
      })
      setProjectForm({ ...createDefaultProjectFormState(), defaultBranch })
      actions.selectProject(createdProject.id)
      await actions.reloadProjects()
    } catch (err) {
      setCreateProjectError(
        err instanceof Error ? err.message : "Failed to create project."
      )
    } finally {
      setIsCreatingProject(false)
    }
  }

  const onCreateWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
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
      actions.selectChat(payload.project.id, payload.conversation.id, payload.session.id)
      await actions.reloadProjects()
    } catch (err) {
      setCreateWorkspaceError(
        err instanceof Error ? err.message : "Failed to create workspace."
      )
    } finally {
      setIsCreatingWorkspace(false)
    }
  }

  const onDeleteWorkspace = async (workspaceId: string, workspaceName?: string) => {
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
        actions.setSelectedWorkspaceId(null)
        actions.setSelectedChatId(null)
      }
      await actions.reloadProjects()
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

  const onConfirmDeleteWorkspace = async (
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
    return onDeleteWorkspace(workspaceId, workspaceName)
  }

  const onCreateSession = async (event: React.FormEvent<HTMLFormElement>) => {
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
      actions.selectChat(selectedProject.id, selectedWorkspace.id, session.id)
      actions.updateProjects((current) =>
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
              const existing = workspace.chats.some((chatEntry) => chatEntry.id === session.id)
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
      await actions.reloadProjects()
    } catch (err) {
      setCreateSessionError(
        err instanceof Error ? err.message : "Failed to create session."
      )
    } finally {
      setIsCreatingSession(false)
    }
  }

  const onDeleteSession = async (sessionId: string) => {
    if (!selectedProject || !selectedWorkspace) {
      return
    }
    const sessionLabel =
      selectedWorkspace.chats.find((chatEntry) => chatEntry.id === sessionId)?.name ||
      sessionId
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
        actions.setSelectedChatId(null)
      }
      await actions.reloadProjects()
    } catch (err) {
      setDeleteSessionError(
        err instanceof Error ? err.message : "Failed to delete session."
      )
    } finally {
      setDeletingSessionId((current) => (current === sessionId ? null : current))
    }
  }

  const onUpdateSessionModel = async (modelId: string) => {
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
      actions.updateProjects((prev) =>
        prev.map((project) => ({
          ...project,
          workspaces: project.workspaces.map((workspace) => {
            if (workspace.id !== updatedSession.conversationId) {
              return workspace
            }
            return {
              ...workspace,
              chats: workspace.chats.map((chatEntry) =>
                chatEntry.id === updatedSession.id
                  ? {
                      ...chatEntry,
                      name:
                        updatedSession.title?.trim() ||
                        updatedSession.model ||
                        updatedSession.id,
                      model: updatedSession.model,
                      updatedAt: updatedSession.updatedAt,
                    }
                  : chatEntry
              ),
            }
          }),
        }))
      )
      const updatedModel = updatedSession.model?.trim()
      if (updatedModel) {
        settings.addAvailableModel(updatedModel)
      }
    } catch (err) {
      setUpdateModelError(
        err instanceof Error ? err.message : "Failed to update session model."
      )
    } finally {
      setIsUpdatingModel(false)
    }
  }

  return {
    state: {
      projectForm,
      isCreatingProject,
      isSelectingDirectory,
      createProjectError,
      workspaceForm,
      isCreatingWorkspace,
      createWorkspaceError,
      sessionForm,
      isCreatingSession,
      createSessionError,
      deletingSessionId,
      deleteSessionError,
      deletingWorkspace,
      deleteWorkspaceErrors,
      isUpdatingModel,
      updateModelError,
    },
    actions: {
      onProjectFormChange,
      onWorkspaceFormChange,
      onSelectDirectory,
      onCreateProject,
      onCreateWorkspace,
      onDeleteWorkspace,
      onConfirmDeleteWorkspace,
      onCreateSession,
      onDeleteSession,
      onUpdateSessionModel,
    },
  }
}
