import { ChevronDownIcon } from "lucide-react"
import type { HTMLAttributes } from "react"

import { cn } from "../../lib/utils"
import { Badge } from "../ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { Shimmer } from "../ui/shimmer"

export type TaskItem = {
  id: string
  title: string
  description?: string
  status?: string
  progress?: number
  progressLabel?: string
}

export type TaskListSectionProps = HTMLAttributes<HTMLDivElement> & {
  title?: string
  summary?: string
  items: TaskItem[]
  isStreaming?: boolean
  defaultOpen?: boolean
}

export type QueueSectionProps = TaskListSectionProps & {
  totalCount?: number
}

const ItemStatusBadge = ({ status }: { status: string }) => (
  <Badge className="border border-transparent text-[10px] uppercase">{status}</Badge>
)

const SectionShimmer = () => (
  <div className="grid gap-2 rounded-lg border border-dashed bg-muted/10 p-3">
    <Shimmer className="h-3 w-28" />
    <Shimmer className="h-3 w-4/5" />
    <Shimmer className="h-3 w-2/3" />
  </div>
)

const ProgressBar = ({ value }: { value: number }) => {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className="h-1.5 w-full rounded-full bg-muted/40"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <div
        className="h-full rounded-full bg-emerald-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

const TaskQueueSection = ({
  title,
  summary,
  items,
  isStreaming,
  defaultOpen = true,
  className,
  children,
  ...props
}: TaskListSectionProps) => {
  const statusLabel = isStreaming ? "Streaming" : "Updated"
  const statusTone = isStreaming ? "bg-amber-500" : "bg-emerald-500"
  const statusText = isStreaming ? "text-amber-600" : "text-emerald-600"
  const countLabel = `${items.length} item${items.length === 1 ? "" : "s"}`

  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("rounded-xl border", className)}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <CollapsibleTrigger
          className="group flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          type="button"
        >
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              statusTone,
              isStreaming ? "animate-pulse" : "opacity-80"
            )}
            aria-hidden="true"
          />
          <span className="truncate">{title}</span>
          <span className="text-[11px] font-medium normal-case text-muted-foreground/70">
            {countLabel}
          </span>
          <ChevronDownIcon
            className="ml-auto h-3 w-3 shrink-0 transition group-data-[state=open]:rotate-180"
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
        {items.length ? (
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 rounded-lg border bg-background/50 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="truncate">{item.title}</span>
                  {item.status ? <ItemStatusBadge status={item.status} /> : null}
                </div>
                {item.description ? (
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                ) : null}
                {typeof item.progress === "number" ? (
                  <div className="grid gap-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Progress</span>
                      <span>{item.progressLabel ?? `${Math.round(item.progress)}%`}</span>
                    </div>
                    <ProgressBar value={item.progress} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {isStreaming ? <SectionShimmer /> : null}
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export const TaskListSection = (props: TaskListSectionProps) => (
  <TaskQueueSection title={props.title ?? "Tasks"} {...props} />
)

export const QueueSection = ({ totalCount, ...props }: QueueSectionProps) => {
  const countLabel =
    typeof totalCount === "number"
      ? `${totalCount} item${totalCount === 1 ? "" : "s"}`
      : undefined

  return (
    <TaskQueueSection title={props.title ?? "Queue"} {...props}>
      {countLabel ? (
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Total {countLabel}
        </div>
      ) : null}
    </TaskQueueSection>
  )
}
