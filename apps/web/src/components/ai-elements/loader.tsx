import * as React from "react"

import { cn } from "../../lib/utils"

const Loader = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground",
        className
      )}
      {...props}
    />
  )
)
Loader.displayName = "Loader"

export { Loader }
