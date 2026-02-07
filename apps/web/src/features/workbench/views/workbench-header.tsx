import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb"
import { Separator } from "../../../components/ui/separator"
import { SidebarTrigger } from "../../../components/ui/sidebar"
import type { ChatSession, Project, Workspace } from "../types"

type WorkbenchHeaderProps = {
  isSettingsView: boolean
  isLoading: boolean
  selectedProject: Project | null
  selectedWorkspace: Workspace | null
  selectedChat: ChatSession | null
  onSelectProjectsView: () => void
  onSelectProject: (projectId: string) => void
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
}

export const WorkbenchHeader = ({
  isSettingsView,
  isLoading,
  selectedProject,
  selectedWorkspace,
  selectedChat,
  onSelectProjectsView,
  onSelectProject,
  onSelectWorkspace,
}: WorkbenchHeaderProps) => {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {isSettingsView ? (
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            <>
              <BreadcrumbItem>
                {selectedProject ? (
                  <BreadcrumbLink
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      onSelectProjectsView()
                    }}
                  >
                    Home
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>Home</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {selectedProject && !isLoading ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {selectedWorkspace || selectedChat ? (
                      <BreadcrumbLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          onSelectProject(selectedProject.id)
                        }}
                      >
                        {selectedProject.name}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{selectedProject.name}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </>
              ) : null}
              {selectedWorkspace && !isLoading ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {selectedChat ? (
                      <BreadcrumbLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (!selectedProject) {
                            return
                          }
                          onSelectWorkspace(selectedProject.id, selectedWorkspace.id)
                        }}
                      >
                        {selectedWorkspace.name}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{selectedWorkspace.name}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </>
              ) : null}
              {selectedChat && !isLoading ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedChat.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
