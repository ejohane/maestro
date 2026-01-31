import * as React from "react"

import { cn } from "../../lib/utils"

type MessageProps = React.HTMLAttributes<HTMLDivElement> & {
  role?: "user" | "assistant" | "system"
}

const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, role = "assistant", ...props }, ref) => (
    <div
      ref={ref}
      data-role={role}
      className={cn(
        "group flex w-full",
        role === "user" ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    />
  )
)
Message.displayName = "Message"

const MessageContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm",
        "bg-muted/50 group-data-[role=user]:bg-primary group-data-[role=user]:text-primary-foreground",
        "group-data-[role=system]:bg-muted group-data-[role=system]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
)
MessageContent.displayName = "MessageContent"

const MessageResponse = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props} />
  )
)
MessageResponse.displayName = "MessageResponse"

export { Message, MessageContent, MessageResponse }
