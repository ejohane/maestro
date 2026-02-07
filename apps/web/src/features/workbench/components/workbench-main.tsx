import * as React from "react"

type WorkbenchMainView = "projects" | "project" | "workspace" | "chat" | "secondary"

type WorkbenchMainProps = {
  view: WorkbenchMainView
  projects: React.ReactNode
  project: React.ReactNode
  workspace: React.ReactNode
  chat: React.ReactNode
  secondary: React.ReactNode
}

export const WorkbenchMain = ({
  view,
  projects,
  project,
  workspace,
  chat,
  secondary,
}: WorkbenchMainProps) => {
  switch (view) {
    case "projects":
      return <>{projects}</>
    case "project":
      return <>{project}</>
    case "workspace":
      return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{workspace}</div>
    case "chat":
      return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{chat}</div>
    case "secondary":
      return <>{secondary}</>
    default:
      return null
  }
}
