import * as React from "react"

type WorkbenchContentProps = {
  variant: "settings" | "main"
  settings: React.ReactNode
  children: React.ReactNode
}

export const WorkbenchContent = ({ variant, settings, children }: WorkbenchContentProps) => {
  if (variant === "settings") {
    return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{settings}</div>
  }

  return <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">{children}</div>
}
