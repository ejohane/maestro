import * as React from "react"

type WorkbenchContentProps = {
  variant: "settings" | "main"
  settings: React.ReactNode
  children: React.ReactNode
}

export const WorkbenchContent = ({ variant, settings, children }: WorkbenchContentProps) => {
  if (variant === "settings") {
    return <>{settings}</>
  }

  return <div className="flex flex-1 flex-col gap-4 p-6">{children}</div>
}
