import { Folder, Layers, MessageSquare } from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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

export function NavProjects({
  projects,
  isProjectsView,
  selectedProjectId,
  selectedWorkspaceId,
  selectedChatId,
  onSelectProject,
  onSelectWorkspace,
  onSelectChat,
}: {
  projects: Project[]
  isProjectsView: boolean
  selectedProjectId: string | null
  selectedWorkspaceId: string | null
  selectedChatId: string | null
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onSelectChat: (projectId: string, workspaceId: string, chatId: string) => void
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarMenu>
        {projects.map((project) => {
          const isProjectActive = selectedProjectId === project.id
          return (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton
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
              {isProjectActive ? (
                <SidebarMenuSub>
                  {project.workspaces.map((workspace) => {
                    const isWorkspaceActive = selectedWorkspaceId === workspace.id
                    return (
                      <SidebarMenuSubItem key={workspace.id}>
                        <SidebarMenuSubButton asChild isActive={isWorkspaceActive}>
                          <button
                            type="button"
                            onClick={() => onSelectWorkspace(project.id, workspace.id)}
                          >
                            <Layers />
                            <span>{workspace.name}</span>
                          </button>
                        </SidebarMenuSubButton>
                        {isWorkspaceActive ? (
                          <SidebarMenuSub className="ml-3 border-l-0 pl-4">
                            {workspace.chats.map((chat) => (
                              <SidebarMenuSubItem key={chat.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  size="sm"
                                  isActive={selectedChatId === chat.id}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSelectChat(project.id, workspace.id, chat.id)
                                    }
                                  >
                                    <MessageSquare />
                                    <span>{chat.name}</span>
                                  </button>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        ) : null}
                      </SidebarMenuSubItem>
                    )
                  })}
                </SidebarMenuSub>
              ) : null}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
