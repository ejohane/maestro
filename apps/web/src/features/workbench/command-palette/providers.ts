import {
  FolderKanban,
  FolderPlus,
  FolderTree,
  Home,
  MessageSquareText,
  Search,
  Settings2,
  Wrench,
} from "lucide-react"

import type {
  CommandPaletteActions,
  CommandPaletteCommand,
  CommandPaletteCommandProvider,
  CommandPaletteContext,
  CommandPaletteSearchProvider,
  CommandPaletteSearchResult,
} from "./types"

const MAX_ITEMS_PER_GROUP = 8
const MAX_SEARCH_RESULTS = 12

type WorkspaceEntry = {
  projectId: string
  projectName: string
  workspaceId: string
  workspaceName: string
  updatedAt?: string
}

type SessionEntry = {
  projectId: string
  projectName: string
  workspaceId: string
  workspaceName: string
  chatId: string
  chatName: string
  updatedAt?: string
}

const toTimestamp = (value?: string) => {
  if (!value) {
    return 0
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const createWorkspaceEntries = (context: CommandPaletteContext): WorkspaceEntry[] =>
  context.projects
    .flatMap((project) =>
      project.workspaces.map((workspace) => ({
        projectId: project.id,
        projectName: project.name,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        updatedAt: workspace.updatedAt,
      }))
    )
    .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))

const createSessionEntries = (context: CommandPaletteContext): SessionEntry[] =>
  context.projects
    .flatMap((project) =>
      project.workspaces.flatMap((workspace) =>
        workspace.chats.map((chat) => ({
          projectId: project.id,
          projectName: project.name,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          chatId: chat.id,
          chatName: chat.name,
          updatedAt: chat.updatedAt,
        }))
      )
    )
    .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))

const includesQuery = (query: string, ...values: Array<string | undefined>) => {
  const normalizedQuery = query.toLowerCase()
  return values.some((value) => value?.toLowerCase().includes(normalizedQuery))
}

export const coreCommandProvider: CommandPaletteCommandProvider = {
  id: "core-navigation",
  getCommands: (context) => {
    const selectedProject = context.selectedProject
    const selectedWorkspace = context.selectedWorkspace
    const selectedChat = context.selectedChat

    const commands: CommandPaletteCommand[] = [
      {
        id: "go-home",
        group: "Suggestions",
        label: "Go to Home",
        value: "home projects overview",
        icon: Home,
        shortcut: "⌘1",
        perform: (actions) => actions.selectProjectsView(),
      },
      {
        id: "search-projects-workspaces",
        group: "Suggestions",
        label: "Search projects and workspaces",
        value: "search projects workspaces sessions",
        icon: Search,
        perform: (actions) => actions.selectProjectsView(),
      },
      {
        id: "create-project",
        group: "Suggestions",
        label: "Add new project",
        value: "create add project new",
        icon: FolderPlus,
        perform: (actions) => actions.openCreateProject(),
      },
      {
        id: "create-workspace",
        group: "Suggestions",
        label: "Add new workspace",
        value: "create add workspace new",
        icon: FolderTree,
        perform: (actions) => actions.openCreateWorkspace(selectedProject?.id),
      },
      {
        id: "open-settings",
        group: "Settings",
        label: "Open Settings",
        value: "settings preferences",
        icon: Settings2,
        shortcut: "⌘,",
        perform: (actions) => actions.selectSettingsView(),
      },
      {
        id: "workspace-tools",
        group: "Settings",
        label: "Workspace tools",
        value: "workspace tools sessions",
        icon: Wrench,
        perform: (actions) => actions.selectProjectsView(),
      },
    ]

    if (selectedProject) {
      commands.push({
        id: "open-selected-project",
        group: "Suggestions",
        label: `Open project: ${selectedProject.name}`,
        value: `open project ${selectedProject.name}`,
        icon: FolderKanban,
        perform: (actions) => actions.selectProject(selectedProject.id),
      })
    }

    if (selectedProject && selectedWorkspace) {
      commands.push({
        id: "open-selected-workspace",
        group: "Suggestions",
        label: `Open workspace: ${selectedWorkspace.name}`,
        value: `open workspace ${selectedWorkspace.name} ${selectedProject.name}`,
        icon: FolderTree,
        perform: (actions) => actions.selectWorkspace(selectedProject.id, selectedWorkspace.id),
      })
    }

    if (selectedProject && selectedWorkspace && selectedChat) {
      commands.push({
        id: "resume-selected-chat",
        group: "Suggestions",
        label: `Resume chat: ${selectedChat.name}`,
        value: `open chat ${selectedChat.name} ${selectedWorkspace.name}`,
        icon: MessageSquareText,
        perform: (actions) =>
          actions.selectChat(selectedProject.id, selectedWorkspace.id, selectedChat.id),
      })
    }

    return commands
  },
}

export const projectListCommandProvider: CommandPaletteCommandProvider = {
  id: "project-list",
  getCommands: (context) =>
    context.projects.slice(0, MAX_ITEMS_PER_GROUP).map((project) => ({
      id: `project-${project.id}`,
      group: "Projects",
      label: project.name,
      description: project.repoPath,
      value: `project ${project.name} ${project.repoPath}`,
      icon: FolderKanban,
      perform: (actions) => actions.selectProject(project.id),
    })),
}

export const workspaceListCommandProvider: CommandPaletteCommandProvider = {
  id: "workspace-list",
  getCommands: (context) =>
    createWorkspaceEntries(context)
      .slice(0, MAX_ITEMS_PER_GROUP)
      .map((workspace) => ({
        id: `workspace-${workspace.workspaceId}`,
        group: "Workspaces",
        label: workspace.workspaceName,
        description: workspace.projectName,
        value: `workspace ${workspace.workspaceName} ${workspace.projectName}`,
        icon: FolderTree,
        perform: (actions) =>
          actions.selectWorkspace(workspace.projectId, workspace.workspaceId),
      })),
}

export const sessionListCommandProvider: CommandPaletteCommandProvider = {
  id: "session-list",
  getCommands: (context) => {
    const selectedProject = context.selectedProject
    const selectedWorkspace = context.selectedWorkspace

    if (!selectedProject || !selectedWorkspace) {
      return []
    }

    return selectedWorkspace.chats.slice(0, MAX_ITEMS_PER_GROUP).map((chat) => ({
      id: `session-${chat.id}`,
      group: "Sessions",
      label: chat.name,
      description: selectedWorkspace.name,
      value: `chat ${chat.name} ${selectedWorkspace.name} ${selectedProject.name}`,
      icon: MessageSquareText,
      perform: (actions) => actions.selectChat(selectedProject.id, selectedWorkspace.id, chat.id),
    }))
  },
}

export const defaultCommandProviders: CommandPaletteCommandProvider[] = [
  coreCommandProvider,
  projectListCommandProvider,
  workspaceListCommandProvider,
  sessionListCommandProvider,
]

export const projectSearchProvider: CommandPaletteSearchProvider = {
  id: "core-project-search",
  search: (query, context) => {
    const results: CommandPaletteSearchResult[] = []
    const projectMatches = context.projects
      .filter((project) =>
        includesQuery(query, project.name, project.repoPath, project.repoUrl)
      )
      .slice(0, 4)
      .map((project) => ({
        id: `search-project-${project.id}`,
        group: "Search",
        label: `Project: ${project.name}`,
        description: project.repoUrl?.trim() || project.repoPath,
        value: `search project ${project.name} ${project.repoPath}`,
        icon: FolderKanban,
        perform: (actions: CommandPaletteActions) => actions.selectProject(project.id),
      }))

    results.push(...projectMatches)

    if (results.length < MAX_SEARCH_RESULTS) {
      const workspaceMatches = createWorkspaceEntries(context)
        .filter((workspace) =>
          includesQuery(query, workspace.workspaceName, workspace.projectName)
        )
        .slice(0, 4)
        .map((workspace) => ({
          id: `search-workspace-${workspace.workspaceId}`,
          group: "Search",
          label: `Workspace: ${workspace.workspaceName}`,
          description: workspace.projectName,
          value: `search workspace ${workspace.workspaceName} ${workspace.projectName}`,
          icon: FolderTree,
          perform: (actions: CommandPaletteActions) =>
            actions.selectWorkspace(workspace.projectId, workspace.workspaceId),
        }))

      results.push(...workspaceMatches)
    }

    if (results.length < MAX_SEARCH_RESULTS) {
      const sessionMatches = createSessionEntries(context)
        .filter((session) =>
          includesQuery(
            query,
            session.chatName,
            session.workspaceName,
            session.projectName
          )
        )
        .slice(0, 4)
        .map((session) => ({
          id: `search-session-${session.chatId}`,
          group: "Search",
          label: `Session: ${session.chatName}`,
          description: `${session.workspaceName} · ${session.projectName}`,
          value: `search session ${session.chatName} ${session.workspaceName} ${session.projectName}`,
          icon: MessageSquareText,
          perform: (actions: CommandPaletteActions) =>
            actions.selectChat(session.projectId, session.workspaceId, session.chatId),
        }))

      results.push(...sessionMatches)
    }

    return results.slice(0, MAX_SEARCH_RESULTS)
  },
}

export const defaultSearchProviders: CommandPaletteSearchProvider[] = [
  projectSearchProvider,
]
