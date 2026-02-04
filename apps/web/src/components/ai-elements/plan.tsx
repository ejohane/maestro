import { ChevronDownIcon } from "lucide-react"
import type { HTMLAttributes } from "react"

import { cn } from "../../lib/utils"
import { Badge } from "../ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { Shimmer } from "../ui/shimmer"

export type PlanStep = {
  id: string
  title: string
  description?: string
  bullets?: string[]
  status?: string
}

export type PlanSectionProps = HTMLAttributes<HTMLDivElement> & {
  title?: string
  summary?: string
  steps: PlanStep[]
  isStreaming?: boolean
  defaultOpen?: boolean
}

const StepStatusBadge = ({ status }: { status: string }) => (
  <Badge className="border border-transparent text-[10px] uppercase">{status}</Badge>
)

const PlanShimmer = () => (
  <div className="grid gap-2 rounded-lg border border-dashed bg-muted/10 p-3">
    <Shimmer className="h-3 w-24" />
    <Shimmer className="h-3 w-5/6" />
    <Shimmer className="h-3 w-2/3" />
  </div>
)

export const PlanSection = ({
  title,
  summary,
  steps,
  isStreaming,
  defaultOpen = true,
  className,
  ...props
}: PlanSectionProps) => {
  const statusLabel = isStreaming ? "Streaming" : "Complete"
  const statusTone = isStreaming ? "bg-amber-500" : "bg-emerald-500"
  const statusText = isStreaming ? "text-amber-600" : "text-emerald-600"

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
          Plan
          {title ? <span className="text-[11px] font-medium normal-case">{title}</span> : null}
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
        className="grid gap-3 border-t bg-muted/20 px-3 py-3 text-xs text-muted-foreground"
        {...props}
      >
        {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
        {steps.length ? (
          <div className="grid gap-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="grid gap-2 rounded-lg border bg-background/50 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Step {index + 1}</span>
                  {step.status ? <StepStatusBadge status={step.status} /> : null}
                </div>
                <div className="text-sm font-medium text-foreground">{step.title}</div>
                {step.description ? (
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                ) : null}
                {step.bullets?.length ? (
                  <ul className="grid gap-1 text-xs text-muted-foreground">
                    {step.bullets.map((bullet, bulletIndex) => (
                      <li key={`${step.id}-bullet-${bulletIndex}`} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                          aria-hidden="true"
                        />
                        <span className="flex-1">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {isStreaming ? <PlanShimmer /> : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
