import * as React from "react"

import type { Project, RecentSession, Workspace } from "../types"

type WorkbenchViewModelInput = {
  projects: Project[]
  isLoading: boolean
  error: string | null
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: { id: string; name: string } | null
  isProjectsView: boolean
  isSettingsView: boolean
  isProjectView: boolean
  isWorkspaceView: boolean
  isChatView: boolean
  recentSessions: RecentSession[]
  projectRecentSessions: RecentSession[]
}

type WorkbenchMainView = "projects" | "project" | "workspace" | "chat" | "secondary"
type WorkbenchContentVariant = "settings" | "main"

type WorkbenchViewModel = {
  viewLabel: string
  viewTitle: string
  viewDescription: string
  secondaryTitle: string
  secondaryItems: string[]
  projectRepoLabel: string | undefined
  projectRepoHref: string | null
  recentSessionsForView: RecentSession[]
  mainView: WorkbenchMainView
  contentVariant: WorkbenchContentVariant
}

export const useWorkbenchViewModel = ({
  projects,
  isLoading,
  error,
  selectedProject,
  selectedWorkspace,
  selectedChat,
  isProjectsView,
  isSettingsView,
  isProjectView,
  isWorkspaceView,
  isChatView,
  recentSessions,
  projectRecentSessions,
}: WorkbenchViewModelInput): WorkbenchViewModel => {
  return React.useMemo(() => {
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
          ? [selectedProject?.name ?? "", selectedWorkspace?.name ?? ""].filter(Boolean)
          : isWorkspaceView
            ? selectedWorkspace?.chats.map((chatEntry) => chatEntry.name) ?? []
            : isProjectView
              ? selectedProject?.workspaces.map((workspace) => workspace.name) ?? []
              : projects.map((project) => project.name)

    const projectRepoLabel = selectedProject?.repoUrl?.trim() || selectedProject?.repoPath
    const projectRepoHref =
      selectedProject?.repoUrl?.trim() && selectedProject.repoUrl.trim().startsWith("http")
        ? selectedProject.repoUrl.trim()
        : null
    const recentSessionsForView = isProjectView ? projectRecentSessions : recentSessions
    const mainView = isProjectsView
      ? "projects"
      : isProjectView
        ? "project"
        : isWorkspaceView
          ? "workspace"
          : isChatView
            ? "chat"
            : "secondary"
    const contentVariant = isSettingsView ? "settings" : "main"

    return {
      viewLabel,
      viewTitle,
      viewDescription,
      secondaryTitle,
      secondaryItems,
      projectRepoLabel,
      projectRepoHref,
      recentSessionsForView,
      mainView,
      contentVariant,
    }
  }, [
    projects,
    isLoading,
    error,
    selectedProject,
    selectedWorkspace,
    selectedChat,
    isProjectsView,
    isSettingsView,
    isProjectView,
    isWorkspaceView,
    isChatView,
    recentSessions,
    projectRecentSessions,
  ])
}
