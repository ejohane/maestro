import * as React from "react"

import { useWorkbench } from "../workbench-context"
import type { ApiPullRequest, MergedPullRequestAction, OpenPullRequest } from "../types"

type PullRequestsControllerState = {
  openPullRequests: OpenPullRequest[]
  isLoadingPullRequests: boolean
  pullRequestsError: string | null
  mergingPullRequests: Record<string, boolean>
  mergePullRequestErrors: Record<string, string>
  mergedPullRequests: Record<string, MergedPullRequestAction>
  deletingMergeWorkspace: Record<string, boolean>
  deleteMergeWorkspaceErrors: Record<string, string>
}

type PullRequestsControllerActions = {
  getPullRequestKey: (item: OpenPullRequest) => string
  onMergePullRequest: (item: OpenPullRequest) => Promise<void>
  onDeleteMergedWorkspace: (
    pullRequestKey: string,
    workspaceId: string,
    workspaceName?: string
  ) => Promise<void>
}

type PullRequestsController = {
  state: PullRequestsControllerState
  actions: PullRequestsControllerActions
}

export const usePullRequestsController = (): PullRequestsController => {
  const { state: workbenchState, actions } = useWorkbench()
  const { projects } = workbenchState

  const [openPullRequests, setOpenPullRequests] = React.useState<OpenPullRequest[]>([])
  const [isLoadingPullRequests, setIsLoadingPullRequests] = React.useState(false)
  const [pullRequestsError, setPullRequestsError] = React.useState<string | null>(null)
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

  const onMergePullRequest = async (item: OpenPullRequest) => {
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
        const statusResponse = await fetch(`/api/conversations/${workspace.id}/status`)
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

  const onDeleteMergedWorkspace = async (
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
      await actions.reloadProjects()
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

  return {
    state: {
      openPullRequests,
      isLoadingPullRequests,
      pullRequestsError,
      mergingPullRequests,
      mergePullRequestErrors,
      mergedPullRequests,
      deletingMergeWorkspace,
      deleteMergeWorkspaceErrors,
    },
    actions: {
      getPullRequestKey,
      onMergePullRequest,
      onDeleteMergedWorkspace,
    },
  }
}
