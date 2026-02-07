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
      return <>{workspace}</>
    case "chat":
      return <>{chat}</>
    case "secondary":
      return <>{secondary}</>
    default:
      return null
  }
}
