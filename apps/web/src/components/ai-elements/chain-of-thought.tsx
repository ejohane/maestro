import { BrainIcon, CheckIcon, ChevronDownIcon, CircleIcon, Loader2Icon } from "lucide-react"
import type { HTMLAttributes } from "react"
import * as React from "react"

import { cn } from "../../lib/utils"
import type { ChainOfThoughtEntry } from "../../features/workbench/types"
import { Badge } from "../ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { MessageResponse } from "./message"

export type ChainOfThoughtSectionProps = HTMLAttributes<HTMLDivElement> & {
  entry: ChainOfThoughtEntry
  isStreaming?: boolean
  defaultOpen?: boolean
}

const formatHeaderLabel = (
  stepCount: number,
  durationSeconds: number | undefined,
  isStreaming: boolean
): string => {
  if (isStreaming) {
    return "Thinking..."
  }
  if (typeof durationSeconds === "number") {
    return `Thought for ${durationSeconds}s across ${stepCount} step${stepCount === 1 ? "" : "s"}`
  }
  return `Thought through ${stepCount} step${stepCount === 1 ? "" : "s"}`
}

const statusTone = (status: "pending" | "running" | "completed" | "error"): string => {
  switch (status) {
    case "running":
      return "text-blue-500"
    case "completed":
      return "text-emerald-500"
    case "error":
      return "text-rose-500"
    default:
      return "text-amber-500"
  }
}

export const ChainOfThoughtSection = ({
  entry,
  isStreaming = false,
  defaultOpen,
  className,
  ...props
}: ChainOfThoughtSectionProps) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen ?? isStreaming)
  const wasStreamingRef = React.useRef(isStreaming)

  React.useEffect(() => {
    if (isStreaming) {
      setIsOpen(true)
    } else if (wasStreamingRef.current) {
      setIsOpen(false)
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming])

  if (entry.steps.length === 0) {
    return null
  }

  const headerLabel = formatHeaderLabel(
    entry.steps.length,
    entry.durationSeconds,
    isStreaming
  )

  return (
    <Collapsible
      className={cn("chat-session-thought rounded-xl border border-border/60", className)}
      open={isOpen}
      onOpenChange={setIsOpen}
      {...props}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <CollapsibleTrigger
          className="group flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          type="button"
        >
          <BrainIcon className="size-3.5 shrink-0" />
          <span className="truncate text-left">{headerLabel}</span>
          <ChevronDownIcon
            className="size-3.5 shrink-0 transition group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border-t border-border/50 px-3 py-3">
        <div className="grid gap-3">
          {entry.steps.map((step, index) => {
            const isLast = index === entry.steps.length - 1
            const StepIcon =
              step.status === "complete"
                ? CheckIcon
                : step.status === "active"
                  ? Loader2Icon
                  : CircleIcon
            const iconClassName =
              step.status === "complete"
                ? "text-emerald-500"
                : step.status === "active"
                  ? "animate-spin text-blue-500"
                  : "text-muted-foreground"

            return (
              <div className="chat-session-thought-step flex gap-2.5" key={step.id}>
                <div className="relative flex w-4 shrink-0 justify-center pt-0.5">
                  <StepIcon className={cn("size-3.5", iconClassName)} aria-hidden="true" />
                  {!isLast ? (
                    <div className="chat-session-thought-step-line absolute bottom-0 top-5 w-px bg-border/60" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 pb-0.5">
                  <div className="text-sm font-medium text-foreground">{step.label}</div>
                  {step.summary ? (
                    <div className="text-xs text-muted-foreground">{step.summary}</div>
                  ) : null}
                  {step.tools.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {step.tools.map((tool) => (
                        <Badge
                          key={tool.id}
                          className={cn(
                            "rounded-md border border-border/70 bg-muted/20 px-2 py-0.5 text-[11px] font-normal",
                            statusTone(tool.status)
                          )}
                          variant="secondary"
                        >
                          {tool.name}
                          <span className="ml-1 opacity-80">{tool.status}</span>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {step.reasoning ? (
                    <MessageResponse className="text-sm leading-relaxed text-muted-foreground">
                      {step.reasoning}
                    </MessageResponse>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
