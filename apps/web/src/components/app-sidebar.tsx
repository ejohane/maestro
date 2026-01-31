import * as React from "react"
import { LifeBuoy, Send, Workflow } from "lucide-react"

import { NavProjects } from "./nav-projects"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar"

type ChatSession = {
  id: string
  name: string
}

type Workspace = {
  id: string
  name: string
  chats: ChatSession[]
}

type Project = {
  id: string
  name: string
  icon?: string
  description?: string
  workspaces: Workspace[]
}

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ],
}

export function AppSidebar({
  projects,
  isProjectsView,
  selectedProjectId,
  selectedWorkspaceId,
  selectedChatId,
  onSelectProjects,
  onSelectProject,
  onSelectWorkspace,
  onSelectChat,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  projects: Project[]
  isProjectsView: boolean
  selectedProjectId: string | null
  selectedWorkspaceId: string | null
  selectedChatId: string | null
  onSelectProjects: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onSelectChat: (projectId: string, workspaceId: string, chatId: string) => void
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
          selectedChatId={selectedChatId}
          onSelectProject={onSelectProject}
          onSelectWorkspace={onSelectWorkspace}
          onSelectChat={onSelectChat}
        />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
