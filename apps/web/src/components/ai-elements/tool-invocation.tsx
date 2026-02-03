import type { HTMLAttributes } from "react"
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  XCircleIcon,
} from "lucide-react"

import type { ToolApprovalStatus, ToolCallPart, ToolResultPart } from "@maestro/core"

import { cn } from "../../lib/utils"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card"

const formatPayload = (payload: unknown): string => {
  if (payload === undefined || payload === null) {
    return ""
  }
  if (typeof payload === "string") {
    return payload
  }
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

const ApprovalBadge = ({ status }: { status: ToolApprovalStatus }) => {
  const tone =
    status === "approved"
      ? "bg-emerald-500/15 text-emerald-700"
      : status === "rejected"
        ? "bg-rose-500/15 text-rose-700"
        : "bg-amber-500/15 text-amber-700"

  return (
    <Badge className={cn("border border-transparent text-[11px] uppercase", tone)}>
      {status}
    </Badge>
  )
}

const ToolStatusBadge = ({ status }: { status: NonNullable<ToolCallPart["status"]> }) => {
  const config =
    status === "completed"
      ? {
          label: "Completed",
          className: "bg-emerald-500/15 text-emerald-700",
          icon: CheckCircleIcon,
        }
      : status === "error"
        ? {
            label: "Error",
            className: "bg-rose-500/15 text-rose-700",
            icon: XCircleIcon,
          }
        : status === "running"
          ? {
              label: "Running",
              className: "bg-sky-500/15 text-sky-700",
              icon: PlayIcon,
            }
          : {
              label: "Pending",
              className: "bg-amber-500/15 text-amber-700",
              icon: ClockIcon,
            }

  const Icon = config.icon

  return (
    <Badge className={cn("border border-transparent text-[11px] uppercase", config.className)}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  )
}

const PayloadBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="grid gap-2">
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </div>
    {value ? (
      <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-foreground">
        {value}
      </pre>
    ) : (
      <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
        No {label.toLowerCase()} available.
      </div>
    )}
  </div>
)

export type ToolInvocationCardProps = HTMLAttributes<HTMLDivElement> & {
  call: ToolCallPart
  isStreaming?: boolean
  onApprove?: () => void
  onReject?: () => void
}

export const ToolInvocationCard = ({
  call,
  isStreaming,
  onApprove,
  onReject,
  className,
  ...props
}: ToolInvocationCardProps) => {
  const status: NonNullable<ToolCallPart["status"]> =
    call.status ?? (isStreaming ? "running" : "pending")
  const approvalStatus = call.approval?.status
  const inputText = formatPayload(call.input)

  return (
    <Card className={cn("border-dashed bg-muted/10", className)} {...props}>
      <CardHeader className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Tool call: {call.name}
          </CardTitle>
          <ToolStatusBadge status={status} />
        </div>
        <div className="text-xs text-muted-foreground">Call ID: {call.callId}</div>
      </CardHeader>
      <CardContent className="grid gap-3 px-4 pb-4">
        <PayloadBlock label="Input" value={inputText} />
        {approvalStatus ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Approval</span>
            <ApprovalBadge status={approvalStatus} />
          </div>
        ) : null}
      </CardContent>
      {approvalStatus === "pending" ? (
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 pt-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangleIcon className="h-4 w-4" aria-hidden="true" />
            Approval required to proceed
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={onReject}
              disabled={!onReject}
            >
              Reject
            </Button>
            <Button size="sm" type="button" onClick={onApprove} disabled={!onApprove}>
              Approve
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export type ToolResultCardProps = HTMLAttributes<HTMLDivElement> & {
  result: ToolResultPart
}

export const ToolResultCard = ({ result, className, ...props }: ToolResultCardProps) => {
  const outputText = formatPayload(result.output)
  const statusLabel = result.isError ? "Error" : "Completed"
  const statusTone = result.isError
    ? "bg-rose-500/15 text-rose-700"
    : "bg-emerald-500/15 text-emerald-700"

  return (
    <Card className={cn("border-muted bg-muted/5", className)} {...props}>
      <CardHeader className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Tool result: {result.name}
          </CardTitle>
          <Badge className={cn("border border-transparent text-[11px] uppercase", statusTone)}>
            {statusLabel}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">Call ID: {result.callId}</div>
      </CardHeader>
      <CardContent className="grid gap-3 px-4 pb-4">
        <PayloadBlock label="Output" value={outputText} />
      </CardContent>
    </Card>
  )
}
