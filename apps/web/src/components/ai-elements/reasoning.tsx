import { ChevronDownIcon } from "lucide-react"
import type { HTMLAttributes } from "react"
import { useMemo } from "react"

import { cn } from "../../lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { Badge } from "../ui/badge"
import { MessageResponse } from "./message"

export type ReasoningSectionProps = HTMLAttributes<HTMLDivElement> & {
  text: string
  isStreaming?: boolean
  defaultOpen?: boolean
}

export const ReasoningSection = ({
  text,
  isStreaming,
  defaultOpen = false,
  className,
  ...props
}: ReasoningSectionProps) => {
  const statusLabel = isStreaming ? "Streaming" : "Complete"
  const statusTone = isStreaming ? "bg-amber-500" : "bg-emerald-500"
  const statusText = isStreaming ? "text-amber-600" : "text-emerald-600"
  const formattedText = useMemo(() => text.trim(), [text])

  if (!formattedText) {
    return null
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("rounded-xl border", className)}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <CollapsibleTrigger
          className="group flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          type="button"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              statusTone,
              isStreaming ? "animate-pulse" : "opacity-80"
            )}
            aria-hidden="true"
          />
          Reasoning
          <ChevronDownIcon
            className="h-3 w-3 transition group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <Badge variant="secondary" className={cn("text-[10px] uppercase", statusText)}>
          {statusLabel}
        </Badge>
      </div>
      <CollapsibleContent
        className="border-t bg-muted/20 px-3 py-3 text-xs text-muted-foreground"
        {...props}
      >
        <MessageResponse className="text-xs leading-relaxed">
          {formattedText}
        </MessageResponse>
      </CollapsibleContent>
    </Collapsible>
  )
}
