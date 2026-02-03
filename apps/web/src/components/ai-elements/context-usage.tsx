import { Badge } from "../ui/badge"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card"
import { cn } from "../../lib/utils"

export type ContextUsageSource = "api" | "metadata" | "stub"

export type ContextUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costUsd?: number
  model?: string
  source?: ContextUsageSource
}

export type ContextUsageIndicatorProps = {
  usage: ContextUsage
  className?: string
}

const formatCompactNumber = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—"
  }
  if (value >= 1_000_000) {
    const scaled = value / 1_000_000
    const digits = scaled >= 10 ? 0 : 1
    return `${scaled.toFixed(digits)}m`
  }
  if (value >= 1_000) {
    const scaled = value / 1_000
    const digits = scaled >= 10 ? 0 : 1
    return `${scaled.toFixed(digits)}k`
  }
  return value.toLocaleString("en-US")
}

const formatNumber = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—"
  }
  return value.toLocaleString("en-US")
}

const formatCurrency = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—"
  }
  const decimals = value > 0 && value < 0.01 ? 4 : 2
  return `$${value.toFixed(decimals)}`
}

export const ContextUsageIndicator = ({ usage, className }: ContextUsageIndicatorProps) => {
  const inputTokens = usage.inputTokens
  const outputTokens = usage.outputTokens
  const totalTokens =
    usage.totalTokens ??
    (typeof inputTokens === "number" && typeof outputTokens === "number"
      ? inputTokens + outputTokens
      : undefined)
  const cost = usage.costUsd
  const isStub = usage.source === "stub"
  const tokenLabel = totalTokens ?? inputTokens ?? outputTokens

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          aria-label="Context usage details"
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-transparent",
            "px-2 py-1 text-xs text-muted-foreground",
            "transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <span className="font-medium text-foreground">Context</span>
          <span>{tokenLabel ? `${formatCompactNumber(tokenLabel)} tokens` : "—"}</span>
          <span>{formatCurrency(cost)}</span>
          {isStub ? (
            <Badge className="rounded-full border border-dashed px-2 py-0 text-[10px]" variant="outline">
              Sample
            </Badge>
          ) : null}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">Context usage</div>
            {usage.model ? (
              <div className="text-xs text-muted-foreground">Model: {usage.model}</div>
            ) : null}
          </div>
          {isStub ? (
            <Badge className="rounded-full border border-dashed text-[10px]" variant="outline">
              Sample data
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 grid gap-1 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Input tokens</span>
            <span className="font-medium text-foreground">{formatNumber(inputTokens)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Output tokens</span>
            <span className="font-medium text-foreground">{formatNumber(outputTokens)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Total tokens</span>
            <span className="font-medium text-foreground">{formatNumber(totalTokens)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Estimated cost</span>
            <span className="font-medium text-foreground">{formatCurrency(cost)}</span>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Source: {isStub ? "Sample data" : "Session usage"}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
