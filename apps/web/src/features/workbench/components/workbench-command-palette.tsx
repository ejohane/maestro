import * as React from "react"
import {
  FolderKanban,
  FolderTree,
  Home,
  MessageSquareText,
  Settings2,
  Sparkles,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "../../../components/ui/command"
import type { ChatSession, Project, Workspace } from "../types"

type WorkspaceCommandEntry = {
  projectId: string
  projectName: string
  workspaceId: string
  workspaceName: string
  updatedAt?: string
}

type WorkbenchCommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: ChatSession | null
  shortcutLabel: string
  onSelectProjectsView: () => void
  onSelectSettingsView: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onSelectChat: (projectId: string, workspaceId: string, chatId: string) => void
}

const MAX_ITEMS_PER_GROUP = 8

const toTimestamp = (value?: string) => {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export const WorkbenchCommandPalette = ({
  open,
  onOpenChange,
  projects,
  selectedProject,
  selectedWorkspace,
  selectedChat,
  shortcutLabel,
  onSelectProjectsView,
  onSelectSettingsView,
  onSelectProject,
  onSelectWorkspace,
  onSelectChat,
}: WorkbenchCommandPaletteProps) => {
  const workspaceEntries = React.useMemo<WorkspaceCommandEntry[]>(
    () =>
      projects
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
        .slice(0, MAX_ITEMS_PER_GROUP),
    [projects]
  )

  const activeWorkspaceChats = React.useMemo(
    () => (selectedWorkspace?.chats ?? []).slice(0, MAX_ITEMS_PER_GROUP),
    [selectedWorkspace]
  )

  const runCommand = React.useCallback(
    (command: () => void) => {
      command()
      onOpenChange(false)
    },
    [onOpenChange]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Jump anywhere in the workbench.
      </div>
      <CommandInput
        placeholder="Search commands, projects, workspaces, or sessions..."
        className="text-sm"
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="home projects overview"
            onSelect={() => runCommand(onSelectProjectsView)}
          >
            <Home className="size-4 text-muted-foreground" />
            <span>Go to Home</span>
            <CommandShortcut>↵</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="settings preferences"
            onSelect={() => runCommand(onSelectSettingsView)}
          >
            <Settings2 className="size-4 text-muted-foreground" />
            <span>Open Settings</span>
            <CommandShortcut>↵</CommandShortcut>
          </CommandItem>
          {selectedProject ? (
            <CommandItem
              value={`open project ${selectedProject.name}`}
              onSelect={() => runCommand(() => onSelectProject(selectedProject.id))}
            >
              <FolderKanban className="size-4 text-muted-foreground" />
              <span className="truncate">Open project: {selectedProject.name}</span>
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          ) : null}
          {selectedProject && selectedWorkspace ? (
            <CommandItem
              value={`open workspace ${selectedWorkspace.name} ${selectedProject.name}`}
              onSelect={() =>
                runCommand(() =>
                  onSelectWorkspace(selectedProject.id, selectedWorkspace.id)
                )
              }
            >
              <FolderTree className="size-4 text-muted-foreground" />
              <span className="truncate">Open workspace: {selectedWorkspace.name}</span>
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          ) : null}
          {selectedProject && selectedWorkspace && selectedChat ? (
            <CommandItem
              value={`open chat ${selectedChat.name} ${selectedWorkspace.name}`}
              onSelect={() =>
                runCommand(() =>
                  onSelectChat(selectedProject.id, selectedWorkspace.id, selectedChat.id)
                )
              }
            >
              <MessageSquareText className="size-4 text-muted-foreground" />
              <span className="truncate">Resume chat: {selectedChat.name}</span>
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          ) : null}
        </CommandGroup>
        {projects.length ? (
          <CommandGroup heading="Projects">
            {projects.slice(0, MAX_ITEMS_PER_GROUP).map((project) => (
              <CommandItem
                key={project.id}
                value={`project ${project.name} ${project.repoPath}`}
                onSelect={() => runCommand(() => onSelectProject(project.id))}
              >
                <FolderKanban className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{project.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {project.repoPath}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {workspaceEntries.length ? (
          <CommandGroup heading="Workspaces">
            {workspaceEntries.map((workspace) => (
              <CommandItem
                key={workspace.workspaceId}
                value={`workspace ${workspace.workspaceName} ${workspace.projectName}`}
                onSelect={() =>
                  runCommand(() =>
                    onSelectWorkspace(workspace.projectId, workspace.workspaceId)
                  )
                }
              >
                <FolderTree className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{workspace.workspaceName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {workspace.projectName}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {selectedProject && selectedWorkspace && activeWorkspaceChats.length ? (
          <CommandGroup heading="Sessions">
            {activeWorkspaceChats.map((chat) => (
              <CommandItem
                key={chat.id}
                value={`chat ${chat.name} ${selectedWorkspace.name} ${selectedProject.name}`}
                onSelect={() =>
                  runCommand(() =>
                    onSelectChat(selectedProject.id, selectedWorkspace.id, chat.id)
                  )
                }
              >
                <Sparkles className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{chat.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {selectedWorkspace.name}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
      <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span>Use arrows to navigate and Enter to run.</span>
        <span>{shortcutLabel} to toggle</span>
      </div>
    </CommandDialog>
  )
}
