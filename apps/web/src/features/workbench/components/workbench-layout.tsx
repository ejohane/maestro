import * as React from "react"

import { SidebarInset, SidebarProvider, SidebarRail } from "../../../components/ui/sidebar"

type WorkbenchLayoutProps = {
  sidebar: React.ReactNode
  header: React.ReactNode
  children: React.ReactNode
}

export const WorkbenchLayout = ({ sidebar, header, children }: WorkbenchLayoutProps) => {
  return (
    <SidebarProvider>
      {sidebar}
      <SidebarRail />
      <SidebarInset>
        {header}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
