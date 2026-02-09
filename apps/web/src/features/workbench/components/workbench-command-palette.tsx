import * as React from "react"
import { ArrowLeft, Plus } from "lucide-react"

import { Button } from "../../../components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../../../components/ui/command"
import { Input } from "../../../components/ui/input"
import { createProject, selectDirectory } from "../api/projects"
import {
  defaultCommandProviders,
  defaultSearchProviders,
} from "../command-palette/providers"
import type {
  CommandPaletteActions,
  CommandPaletteCommandProvider,
  CommandPaletteSearchProvider,
} from "../command-palette/types"
import { createDefaultProjectFormState } from "../project-form"
import type { ChatSession, Project, ProjectFormState, Workspace } from "../types"

type WorkbenchCommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: ChatSession | null
  onSelectProjectsView: () => void
  onSelectSettingsView: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onSelectChat: (projectId: string, workspaceId: string, chatId: string) => void
  onReloadProjects: () => Promise<void>
  commandProviders?: CommandPaletteCommandProvider[]
  searchProviders?: CommandPaletteSearchProvider[]
}

type CommandListEntry = {
  id: string
  heading: string
  label: string
  value: string
  description?: string
  shortcut?: string
  icon?: React.ComponentType<{ className?: string }>
  perform: (actions: CommandPaletteActions) => void
}

type CommandGroupEntry = {
  heading: string
  items: CommandListEntry[]
}

const CREATE_PROJECT_VIEW = "create-project"
const COMMANDS_VIEW = "commands"

const groupEntries = (entries: CommandListEntry[]): CommandGroupEntry[] => {
  const groupedEntries = new Map<string, CommandListEntry[]>()
  for (const entry of entries) {
    const groupItems = groupedEntries.get(entry.heading)
    if (groupItems) {
      groupItems.push(entry)
      continue
    }
    groupedEntries.set(entry.heading, [entry])
  }
  return Array.from(groupedEntries.entries()).map(([heading, items]) => ({
    heading,
    items,
  }))
}

const dedupeById = <Entry extends { id: string }>(items: Entry[]) => {
  const seen = new Set<string>()
  const uniqueItems: Entry[] = []
  for (const item of items) {
    if (seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    uniqueItems.push(item)
  }
  return uniqueItems
}

export const WorkbenchCommandPalette = ({
  open,
  onOpenChange,
  projects,
  selectedProject,
  selectedWorkspace,
  selectedChat,
  onSelectProjectsView,
  onSelectSettingsView,
  onSelectProject,
  onSelectWorkspace,
  onSelectChat,
  onReloadProjects,
  commandProviders = [],
  searchProviders = [],
}: WorkbenchCommandPaletteProps) => {
  const [activeView, setActiveView] = React.useState(COMMANDS_VIEW)
  const [query, setQuery] = React.useState("")
  const [projectForm, setProjectForm] = React.useState<ProjectFormState>(
    createDefaultProjectFormState()
  )
  const [isCreatingProject, setIsCreatingProject] = React.useState(false)
  const [isSelectingDirectory, setIsSelectingDirectory] = React.useState(false)
  const [createProjectError, setCreateProjectError] = React.useState<string | null>(null)
  const projectNameInputRef = React.useRef<HTMLInputElement | null>(null)

  const allCommandProviders = React.useMemo(
    () => [...defaultCommandProviders, ...commandProviders],
    [commandProviders]
  )

  const allSearchProviders = React.useMemo(
    () => [...defaultSearchProviders, ...searchProviders],
    [searchProviders]
  )

  const commandContext = React.useMemo(
    () => ({
      projects,
      selectedProject,
      selectedWorkspace,
      selectedChat,
    }),
    [projects, selectedProject, selectedWorkspace, selectedChat]
  )

  const openCreateProject = React.useCallback(() => {
    setActiveView(CREATE_PROJECT_VIEW)
    setCreateProjectError(null)
    setQuery("")
  }, [])

  const closePalette = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const commandActions = React.useMemo<CommandPaletteActions>(
    () => ({
      closePalette,
      selectProjectsView: () => {
        onSelectProjectsView()
        closePalette()
      },
      selectSettingsView: () => {
        onSelectSettingsView()
        closePalette()
      },
      selectProject: (projectId: string) => {
        onSelectProject(projectId)
        closePalette()
      },
      selectWorkspace: (projectId: string, workspaceId: string) => {
        onSelectWorkspace(projectId, workspaceId)
        closePalette()
      },
      selectChat: (projectId: string, workspaceId: string, chatId: string) => {
        onSelectChat(projectId, workspaceId, chatId)
        closePalette()
      },
      openCreateProject,
    }),
    [
      closePalette,
      onSelectProjectsView,
      onSelectSettingsView,
      onSelectProject,
      onSelectWorkspace,
      onSelectChat,
      openCreateProject,
    ]
  )

  const commandGroups = React.useMemo(() => {
    const commands = dedupeById(
      allCommandProviders.flatMap((provider) => provider.getCommands(commandContext))
    )
    const commandEntries: CommandListEntry[] = commands.map((command) => ({
      id: command.id,
      heading: command.group,
      label: command.label,
      value: command.value,
      description: command.description,
      shortcut: command.shortcut,
      icon: command.icon,
      perform: command.perform,
    }))
    return groupEntries(commandEntries)
  }, [allCommandProviders, commandContext])

  const searchGroups = React.useMemo(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      return [] as CommandGroupEntry[]
    }

    const results = dedupeById(
      allSearchProviders.flatMap((provider) =>
        provider.search(trimmedQuery, commandContext)
      )
    )
    const searchEntries: CommandListEntry[] = results.map((result) => ({
      id: result.id,
      heading: result.group,
      label: result.label,
      value: result.value,
      description: result.description,
      icon: result.icon,
      perform: result.perform,
    }))

    return groupEntries(searchEntries)
  }, [allSearchProviders, commandContext, query])

  React.useEffect(() => {
    if (!open) {
      setActiveView(COMMANDS_VIEW)
      setQuery("")
      setProjectForm(createDefaultProjectFormState())
      setIsCreatingProject(false)
      setIsSelectingDirectory(false)
      setCreateProjectError(null)
      return
    }
    if (activeView === CREATE_PROJECT_VIEW) {
      const timeoutId = window.setTimeout(() => {
        projectNameInputRef.current?.focus()
      }, 30)
      return () => window.clearTimeout(timeoutId)
    }
  }, [activeView, open])

  const onProjectFormChange = (field: keyof ProjectFormState) => {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value
      setProjectForm((prev) => ({ ...prev, [field]: value }))
      setCreateProjectError(null)
    }
  }

  const onSelectProjectDirectory = async () => {
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

  const onCreateProjectFromPalette = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
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
      await onReloadProjects()
      onSelectProject(createdProject.id)
      onOpenChange(false)
      setActiveView(COMMANDS_VIEW)
      setProjectForm({ ...createDefaultProjectFormState(), defaultBranch })
      setQuery("")
    } catch (err) {
      setCreateProjectError(
        err instanceof Error ? err.message : "Failed to create project."
      )
    } finally {
      setIsCreatingProject(false)
    }
  }

  const onBackToCommands = React.useCallback(() => {
    setActiveView(COMMANDS_VIEW)
    setCreateProjectError(null)
  }, [])

  const visibleGroups = React.useMemo(
    () => [...searchGroups, ...commandGroups].filter((group) => group.items.length > 0),
    [searchGroups, commandGroups]
  )

  const renderCommandItem = (item: CommandListEntry) => {
    const Icon = item.icon
    return (
      <CommandItem
        key={item.id}
        value={item.value}
        onSelect={() => item.perform(commandActions)}
      >
        {Icon ? <Icon /> : null}
        <div className="min-w-0 flex-1">
          <div className="truncate">{item.label}</div>
          {item.description ? (
            <div className="truncate text-xs text-muted-foreground">{item.description}</div>
          ) : null}
        </div>
        {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
      </CommandItem>
    )
  }

  if (activeView === CREATE_PROJECT_VIEW) {
    return (
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <div className="border-b p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2"
            onClick={onBackToCommands}
          >
            <ArrowLeft className="size-4" />
            Back to commands
          </Button>
        </div>
        <form onSubmit={onCreateProjectFromPalette} className="grid gap-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Create a new project</h3>
            <p className="text-xs text-muted-foreground">
              Finish the full add-project workflow directly in the command palette.
            </p>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Project name
            </label>
            <Input
              ref={projectNameInputRef}
              value={projectForm.name}
              onChange={onProjectFormChange("name")}
              placeholder="e.g. Marketing site"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Repo path
            </label>
            <Input
              value={projectForm.repoPath}
              onChange={onProjectFormChange("repoPath")}
              placeholder="/path/to/repo (optional)"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Repo URL
            </label>
            <Input
              value={projectForm.repoUrl}
              onChange={onProjectFormChange("repoUrl")}
              placeholder="https://github.com/org/repo (optional)"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Git provider
            </label>
            <select
              value={projectForm.gitProvider}
              onChange={onProjectFormChange("gitProvider")}
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
              onChange={onProjectFormChange("defaultBranch")}
              placeholder="main"
            />
          </div>
          {createProjectError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {createProjectError}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => void onSelectProjectDirectory()}
              disabled={isSelectingDirectory}
            >
              {isSelectingDirectory ? "Selecting folder..." : "Select folder"}
            </Button>
            <Button type="submit" disabled={!projectForm.name.trim() || isCreatingProject}>
              <Plus className="size-4" />
              {isCreatingProject ? "Creating project..." : "Create project"}
            </Button>
          </div>
        </form>
      </CommandDialog>
    )
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Type a command or search..."
      />
      <CommandList className="max-h-[430px]">
        <CommandEmpty>No results found.</CommandEmpty>
        {visibleGroups.map((group, index) => (
          <React.Fragment key={`${group.heading}-${index}`}>
            {index > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={group.heading}>
              {group.items.map(renderCommandItem)}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
