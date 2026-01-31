import * as React from "react"

import { cn } from "../../lib/utils"

const Conversation = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
      {...props}
    />
  )
)
Conversation.displayName = "Conversation"

const ConversationContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto px-4 py-6", className)}
    {...props}
  />
))
ConversationContent.displayName = "ConversationContent"

const ConversationScrollButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "absolute bottom-24 right-6 rounded-full border bg-background px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/60",
      className
    )}
    {...props}
  />
))
ConversationScrollButton.displayName = "ConversationScrollButton"

export { Conversation, ConversationContent, ConversationScrollButton }
