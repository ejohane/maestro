import * as React from "react"
import { Settings, Workflow } from "lucide-react"

import { NavProjects } from "./nav-projects"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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

export function AppSidebar({
  projects,
  isProjectsView,
  isSettingsView,
  selectedProjectId,
  selectedWorkspaceId,
  onSelectProjects,
  onSelectSettings,
  onSelectProject,
  onSelectWorkspace,
  onCreateProject,
  onCreateWorkspace,
  activeWorkspaceIds = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  projects: Project[]
  isProjectsView: boolean
  isSettingsView: boolean
  selectedProjectId: string | null
  selectedWorkspaceId: string | null
  onSelectProjects: () => void
  onSelectSettings: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onCreateProject: () => void
  onCreateWorkspace: (projectId: string) => void
  activeWorkspaceIds?: string[]
}) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  onSelectProjects()
                }}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Workflow className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Maestro</span>
                  <span className="truncate text-xs">Workspace</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavProjects
          projects={projects}
          isProjectsView={isProjectsView}
          selectedProjectId={selectedProjectId}
          selectedWorkspaceId={selectedWorkspaceId}
          onSelectProject={onSelectProject}
          onSelectWorkspace={onSelectWorkspace}
          onCreateProject={onCreateProject}
          onCreateWorkspace={onCreateWorkspace}
          activeWorkspaceIds={activeWorkspaceIds}
        />
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isSettingsView}
                  onClick={(event) => {
                    event.preventDefault()
                    onSelectSettings()
                  }}
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
