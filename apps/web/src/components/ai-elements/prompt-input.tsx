import * as React from "react"

import { cn } from "../../lib/utils"

const PromptInput = React.forwardRef<
  HTMLFormElement,
  React.ComponentPropsWithoutRef<"form">
>(({ className, ...props }, ref) => (
  <form
    ref={ref}
    className={cn("grid gap-3 rounded-xl border bg-background p-3 shadow-sm", className)}
    {...props}
  />
))
PromptInput.displayName = "PromptInput"

const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[88px] w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background focus:border-primary focus:ring-1 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60",
      className
    )}
    {...props}
  />
))
PromptInputTextarea.displayName = "PromptInputTextarea"

const PromptInputFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    />
  )
)
PromptInputFooter.displayName = "PromptInputFooter"

const PromptInputSubmit = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60",
      className
    )}
    {...props}
  />
))
PromptInputSubmit.displayName = "PromptInputSubmit"

export { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea }
