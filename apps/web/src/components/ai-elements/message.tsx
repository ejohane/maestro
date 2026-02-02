import * as React from "react"

import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { Streamdown } from "streamdown"

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
        "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm",
        "bg-muted/50 group-data-[role=user]:bg-primary group-data-[role=user]:text-primary-foreground",
        "group-data-[role=system]:bg-muted group-data-[role=system]:text-muted-foreground",
        "group-data-[role=user]:whitespace-pre-wrap",
        className
      )}
      {...props}
    />
  )
)
MessageContent.displayName = "MessageContent"

type MessageResponseProps = React.ComponentProps<typeof Streamdown>

const MessageResponse = React.memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={{ code, mermaid, math, cjk }}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
)
MessageResponse.displayName = "MessageResponse"

export { Message, MessageContent, MessageResponse }
