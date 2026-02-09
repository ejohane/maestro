import type { ComponentType } from "react"

import type { ChatSession, Project, Workspace } from "../types"

export type CommandPaletteIcon = ComponentType<{ className?: string }>

export type CommandPaletteContext = {
  projects: Project[]
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: ChatSession | null
}

export type CommandPaletteActions = {
  closePalette: () => void
  selectProjectsView: () => void
  selectSettingsView: () => void
  selectProject: (projectId: string) => void
  selectWorkspace: (projectId: string, workspaceId: string) => void
  selectChat: (projectId: string, workspaceId: string, chatId: string) => void
  openCreateProject: () => void
  openCreateWorkspace: (projectId?: string) => void
}

export type CommandPaletteCommand = {
  id: string
  group: string
  label: string
  value: string
  description?: string
  icon?: CommandPaletteIcon
  shortcut?: string
  perform: (actions: CommandPaletteActions) => void
}

export type CommandPaletteSearchResult = {
  id: string
  group: string
  label: string
  value: string
  description?: string
  icon?: CommandPaletteIcon
  perform: (actions: CommandPaletteActions) => void
}

export type CommandPaletteCommandProvider = {
  id: string
  getCommands: (context: CommandPaletteContext) => CommandPaletteCommand[]
}

export type CommandPaletteSearchProvider = {
  id: string
  search: (query: string, context: CommandPaletteContext) => CommandPaletteSearchResult[]
}
