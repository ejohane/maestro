import * as React from "react"
import { ChevronRight, Folder, Layers, Plus } from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"
import { Spinner } from "./ui/spinner"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./ui/sidebar"

type ChatSession = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

type Workspace = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
  chats: ChatSession[]
}

type Project = {
  id: string
  name: string
  icon?: string
  description?: string
  workspaces: Workspace[]
}

const getTimestamp = (value?: string) => {
  if (!value) {
    return 0
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const getWorkspaceActivityTimestamp = (workspace: Workspace) => {
  const workspaceTimestamp = Math.max(
    getTimestamp(workspace.updatedAt),
    getTimestamp(workspace.createdAt)
  )
  const chatTimestamp = workspace.chats.reduce((latest, chat) => {
    return Math.max(latest, getTimestamp(chat.updatedAt), getTimestamp(chat.createdAt))
  }, 0)
  return Math.max(workspaceTimestamp, chatTimestamp)
}

export function NavProjects({
  projects,
  isProjectsView,
  selectedProjectId,
  selectedWorkspaceId,
  onSelectProject,
  onSelectWorkspace,
  onCreateProject,
  onCreateWorkspace,
  activeWorkspaceIds = [],
}: {
  projects: Project[]
  isProjectsView: boolean
  selectedProjectId: string | null
  selectedWorkspaceId: string | null
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onCreateProject: () => void
  onCreateWorkspace: (projectId: string) => void
  activeWorkspaceIds?: string[]
}) {
  const activeWorkspaceIdSet = React.useMemo(
    () => new Set(activeWorkspaceIds),
    [activeWorkspaceIds]
  )

  return (
    <SidebarGroup className="group/sidebar-projects group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarGroupAction
        aria-label="Add project"
        title="Add project"
        onClick={onCreateProject}
        className="opacity-0 transition-opacity group-hover/sidebar-projects:opacity-100 group-focus-within/sidebar-projects:opacity-100"
      >
        <Plus />
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {projects.map((project) => {
            const isProjectActive = selectedProjectId === project.id
            const sortedWorkspaces = [...project.workspaces].sort((a, b) => {
              return getWorkspaceActivityTimestamp(b) - getWorkspaceActivityTimestamp(a)
            })

            return (
              <Collapsible key={project.id} asChild defaultOpen>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    aria-label={`Open project ${project.name}`}
                    isActive={isProjectActive && !isProjectsView}
                    onClick={() => onSelectProject(project.id)}
                  >
                    {project.icon ? (
                      <span className="flex size-4 items-center justify-center text-sm leading-none">
                        {project.icon}
                      </span>
                    ) : (
                      <Folder />
                    )}
                    <span>{project.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    className="right-7"
                    aria-label={`Add workspace to ${project.name}`}
                    title={`Add workspace to ${project.name}`}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onCreateWorkspace(project.id)
                    }}
                  >
                    <Plus />
                  </SidebarMenuAction>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction
                      showOnHover
                      aria-label={`Toggle ${project.name} workspaces`}
                      title={`Toggle ${project.name} workspaces`}
                      className="data-[state=open]:rotate-90"
                    >
                      <ChevronRight />
                      <span className="sr-only">Toggle {project.name} workspaces</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <li className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                        Workspaces
                      </li>
                      {sortedWorkspaces.length ? (
                        sortedWorkspaces.map((workspace) => {
                          const isWorkspaceActive = selectedWorkspaceId === workspace.id
                          const isWorkspaceRunning = activeWorkspaceIdSet.has(workspace.id)
                          return (
                            <SidebarMenuSubItem key={workspace.id}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isWorkspaceActive}
                                className="pr-2"
                              >
                                <button
                                  type="button"
                                  aria-label={`Open workspace ${workspace.name}`}
                                  onClick={() =>
                                    onSelectWorkspace(project.id, workspace.id)
                                  }
                                  className="flex w-full items-center gap-2"
                                >
                                  <Layers className="size-3.5 shrink-0" />
                                  <span>{workspace.name}</span>
                                  {isWorkspaceRunning ? (
                                    <Spinner
                                      className="ml-auto size-3.5 text-emerald-500"
                                      aria-label={`Active conversation in ${workspace.name}`}
                                    />
                                  ) : null}
                                </button>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })
                      ) : (
                        <SidebarMenuSubItem>
                          <div className="px-2 py-1 text-xs text-sidebar-foreground/60">
                            No workspaces yet.
                          </div>
                        </SidebarMenuSubItem>
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
