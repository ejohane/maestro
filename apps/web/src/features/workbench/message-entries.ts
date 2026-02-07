import type { SourceCitation } from "@maestro/core"

import type { ContextUsage } from "../../components/ai-elements/context-usage"
import type { PlanStep } from "../../components/ai-elements/plan"
import type { TaskItem } from "../../components/ai-elements/task-queue"
import {
  getTextFromParts,
  normalizeMessageParts,
  type StructuredMessagePart,
} from "../../lib/messages"
import type {
  ChainOfThoughtEntry,
  ChainOfThoughtStepStatus,
  ChainOfThoughtToolStatus,
  ChatMessage,
  CheckpointMarker,
  MessageBranchEntry,
  PlanEntry,
  QueueEntry,
  TaskEntry,
} from "./types"

export const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

export const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
}

export const parsePlanStep = (
  value: unknown,
  fallbackId: string,
  index: number
): PlanStep | null => {
  if (typeof value === "string") {
    const title = value.trim()
    if (!title) {
      return null
    }
    return {
      id: `${fallbackId}-step-${index}`,
      title,
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const titleCandidate =
    toTrimmedString(record.title ?? record.label ?? record.name ?? record.step ?? record.summary) ??
    toTrimmedString(record.text)
  const descriptionCandidate = toTrimmedString(
    record.description ?? record.detail ?? record.summary ?? record.text
  )
  const bullets = toStringArray(record.items ?? record.steps ?? record.tasks ?? record.bullets)
  const status = toTrimmedString(record.status ?? record.state)
  let title = titleCandidate
  let description = descriptionCandidate
  if (!title && description) {
    title = description
    description = undefined
  }
  if (!title && bullets.length > 0) {
    title = `Step ${index + 1}`
  }
  if (!title) {
    return null
  }
  return {
    id: typeof record.id === "string" ? record.id : `${fallbackId}-step-${index}`,
    title,
    description,
    bullets: bullets.length > 0 ? bullets : undefined,
    status,
  }
}

export const parsePlanSteps = (value: unknown, fallbackId: string): PlanStep[] => {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => parsePlanStep(item, fallbackId, index))
      .filter((step): step is PlanStep => Boolean(step))
  }
  const single = parsePlanStep(value, fallbackId, 0)
  return single ? [single] : []
}

export const parseProgressNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

export const normalizePercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return value <= 1 && value >= 0 ? value * 100 : value
}

export const clampPercent = (value: number): number => {
  return Math.max(0, Math.min(100, value))
}

export const parseProgressValue = (
  value: unknown
): { value: number; label?: string } | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const current = parseProgressNumber(record.current ?? record.completed ?? record.done)
    const total = parseProgressNumber(record.total ?? record.max ?? record.goal)
    if (typeof current === "number" && typeof total === "number" && total > 0) {
      const percent = clampPercent((current / total) * 100)
      return { value: percent, label: `${current}/${total}` }
    }
    const nested = parseProgressValue(
      record.percent ?? record.percentage ?? record.progress ?? record.value
    )
    if (nested) {
      return nested
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    if (trimmed.endsWith("%")) {
      const parsed = Number.parseFloat(trimmed.slice(0, -1))
      if (Number.isFinite(parsed)) {
        return { value: clampPercent(parsed), label: trimmed }
      }
    }
    const fractionMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
    if (fractionMatch) {
      const current = Number.parseFloat(fractionMatch[1])
      const total = Number.parseFloat(fractionMatch[2])
      if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
        return { value: clampPercent((current / total) * 100), label: trimmed }
      }
    }
    const parsed = Number.parseFloat(trimmed)
    if (Number.isFinite(parsed)) {
      const percent = clampPercent(normalizePercent(parsed))
      return { value: percent, label: `${Math.round(percent)}%` }
    }
    return null
  }
  if (typeof value === "number") {
    const percent = clampPercent(normalizePercent(value))
    return { value: percent, label: `${Math.round(percent)}%` }
  }
  return null
}

export const parseTaskItem = (
  value: unknown,
  fallbackId: string,
  index: number
): TaskItem | null => {
  if (typeof value === "string") {
    const title = value.trim()
    if (!title) {
      return null
    }
    return { id: `${fallbackId}-item-${index}`, title }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const titleCandidate =
    toTrimmedString(
      record.title ?? record.label ?? record.name ?? record.task ?? record.item ?? record.summary
    ) ?? toTrimmedString(record.text)
  const descriptionCandidate = toTrimmedString(
    record.description ?? record.detail ?? record.summary ?? record.text
  )
  const statusCandidate = toTrimmedString(record.status ?? record.state ?? record.phase)
  const progressCandidate = parseProgressValue(
    record.progress ?? record.percent ?? record.percentage ?? record.completion
  )
  const isDone =
    typeof record.done === "boolean"
      ? record.done
      : typeof record.completed === "boolean"
        ? record.completed
        : typeof record.isDone === "boolean"
          ? record.isDone
          : undefined
  let title = titleCandidate
  let description = descriptionCandidate
  if (!title && description) {
    title = description
    description = undefined
  }
  if (!title) {
    return null
  }
  const status = statusCandidate ?? (isDone ? "Done" : undefined)
  return {
    id: typeof record.id === "string" ? record.id : `${fallbackId}-item-${index}`,
    title,
    description,
    status,
    progress: progressCandidate?.value,
    progressLabel: progressCandidate?.label,
  }
}

export const parseTaskItems = (value: unknown, fallbackId: string): TaskItem[] => {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => parseTaskItem(item, fallbackId, index))
      .filter((item): item is TaskItem => Boolean(item))
  }
  const single = parseTaskItem(value, fallbackId, 0)
  return single ? [single] : []
}

export const parseUsageNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

export const extractUsageFromMetadata = (
  metadata?: Record<string, unknown>
): ContextUsage | null => {
  if (!metadata) {
    return null
  }
  const usageCandidate =
    (metadata.usage ??
      metadata.usageSummary ??
      metadata.usage_summary ??
      metadata.tokenUsage ??
      metadata.tokens) as Record<string, unknown> | undefined
  if (!usageCandidate || typeof usageCandidate !== "object" || Array.isArray(usageCandidate)) {
    return null
  }
  const record = usageCandidate as Record<string, unknown>
  const inputTokens = parseUsageNumber(
    record.inputTokens ?? record.promptTokens ?? record.input_tokens ?? record.prompt_tokens
  )
  const outputTokens = parseUsageNumber(
    record.outputTokens ??
      record.completionTokens ??
      record.output_tokens ??
      record.completion_tokens
  )
  const totalTokens = parseUsageNumber(
    record.totalTokens ?? record.total_tokens ?? record.total
  )
  const costUsd = parseUsageNumber(
    record.costUsd ?? record.cost_usd ?? record.cost ?? record.totalCostUsd ?? record.total_cost_usd
  )
  const model = typeof record.model === "string" ? record.model : undefined
  if (
    typeof inputTokens !== "number" &&
    typeof outputTokens !== "number" &&
    typeof totalTokens !== "number" &&
    typeof costUsd !== "number"
  ) {
    return null
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    model,
    source: "metadata",
  }
}

export const getSourcesFromParts = (parts: StructuredMessagePart[]): SourceCitation[] => {
  return parts
    .filter(
      (
        part
      ): part is StructuredMessagePart & {
        type: "sources"
        sources: SourceCitation[]
      } => part.type === "sources"
    )
    .flatMap((part) => part.sources)
    .filter((source): source is SourceCitation => Boolean(source))
}

type ThoughtStepAccumulator = {
  id: string
  label?: string
  summary?: string
  reasoningChunks: string[]
  tools: ChainOfThoughtEntry["steps"][number]["tools"]
  status: ChainOfThoughtStepStatus
  hasStart: boolean
  hasFinish: boolean
}

const parseToolStatus = (value: string | undefined): ChainOfThoughtToolStatus => {
  switch (value) {
    case "running":
      return "running"
    case "completed":
      return "completed"
    case "error":
      return "error"
    default:
      return "pending"
  }
}

const parseTimeBounds = (
  value: unknown
): { start?: number; end?: number } => {
  const record = toRecord(value)
  if (!record) {
    return {}
  }
  const start = parseUsageNumber(record.start)
  const end = parseUsageNumber(record.end)
  return { start, end }
}

const normalizeThoughtLabel = (
  label: string | undefined,
  summary: string | undefined,
  toolName: string | undefined,
  reasoning: string | undefined,
  index: number
): string => {
  if (label) {
    return label
  }
  if (summary) {
    return summary
  }
  if (toolName) {
    return `Using ${toolName}`
  }
  if (reasoning) {
    const firstLine = reasoning.split("\n")[0]?.trim()
    if (firstLine) {
      return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine
    }
  }
  return `Step ${index + 1}`
}

export const getChainOfThoughtEntry = (
  parts: StructuredMessagePart[],
  messageId: string,
  isStreaming = false
): ChainOfThoughtEntry | null => {
  const thoughtParts = parts.filter(
    (part) =>
      part.type === "reasoning" ||
      part.type === "tool" ||
      part.type === "step-start" ||
      part.type === "step-finish"
  )

  if (thoughtParts.length === 0) {
    return null
  }

  const steps: ThoughtStepAccumulator[] = []
  let activeStepIndex: number | null = null
  let implicitCount = 0
  let minStart: number | undefined
  let maxEnd: number | undefined

  const updateDurationBounds = (start?: number, end?: number) => {
    if (typeof start === "number") {
      minStart = typeof minStart === "number" ? Math.min(minStart, start) : start
      const effectiveEnd = typeof end === "number" ? end : start
      maxEnd = typeof maxEnd === "number" ? Math.max(maxEnd, effectiveEnd) : effectiveEnd
    } else if (typeof end === "number") {
      maxEnd = typeof maxEnd === "number" ? Math.max(maxEnd, end) : end
    }
  }

  const createStep = (seed?: Partial<ThoughtStepAccumulator>): number => {
    const index = steps.length
    steps.push({
      id: seed?.id ?? `${messageId}-thought-step-${index}`,
      label: seed?.label,
      summary: seed?.summary,
      reasoningChunks: seed?.reasoningChunks ?? [],
      tools: seed?.tools ?? [],
      status: seed?.status ?? (isStreaming ? "active" : "complete"),
      hasStart: seed?.hasStart ?? false,
      hasFinish: seed?.hasFinish ?? false,
    })
    return index
  }

  const getCurrentStepIndex = (label?: string): number => {
    if (typeof activeStepIndex === "number") {
      return activeStepIndex
    }
    const lastIndex = steps.length - 1
    if (lastIndex >= 0 && !steps[lastIndex]?.hasFinish) {
      return lastIndex
    }
    implicitCount += 1
    return createStep({
      id: `${messageId}-thought-implicit-${implicitCount}`,
      label,
      status: isStreaming ? "active" : "complete",
    })
  }

  thoughtParts.forEach((part, index) => {
    if (part.type === "step-start") {
      const partRecord = toRecord(part)
      const snapshot = toTrimmedString(partRecord?.snapshot)
      const nextStepIndex = createStep({
        id:
          typeof part.id === "string"
            ? part.id
            : `${messageId}-thought-step-start-${index}`,
        label: snapshot,
        status: isStreaming ? "active" : "pending",
        hasStart: true,
      })
      activeStepIndex = nextStepIndex
      return
    }

    if (part.type === "step-finish") {
      const stepIndex = getCurrentStepIndex()
      const step = steps[stepIndex]
      if (!step) {
        return
      }
      const partRecord = toRecord(part)
      const finishReason = toTrimmedString(partRecord?.reason)
      const snapshot = toTrimmedString(partRecord?.snapshot)
      step.summary = finishReason ?? step.summary
      step.label = step.label ?? snapshot
      step.status = "complete"
      step.hasFinish = true
      activeStepIndex = null
      return
    }

    if (part.type === "reasoning") {
      const partRecord = toRecord(part)
      const text = toTrimmedString(part.text ?? partRecord?.text)
      const { start, end } = parseTimeBounds(partRecord?.time)
      updateDurationBounds(start, end)
      if (!text) {
        return
      }
      const stepIndex = getCurrentStepIndex("Reasoning")
      const step = steps[stepIndex]
      if (!step) {
        return
      }
      step.reasoningChunks.push(text)
      if (step.status === "pending") {
        step.status = isStreaming ? "active" : "complete"
      }
      return
    }

    if (part.type === "tool") {
      const partRecord = toRecord(part)
      const stateRecord = toRecord(partRecord?.state)
      const status = parseToolStatus(
        toTrimmedString(stateRecord?.status ?? partRecord?.status)?.toLowerCase()
      )
      const name =
        toTrimmedString(partRecord?.tool ?? partRecord?.name) ?? "Tool call"
      const callId = toTrimmedString(partRecord?.callID ?? partRecord?.callId)
      const { start, end } = parseTimeBounds(stateRecord?.time)
      updateDurationBounds(start, end)
      const stepIndex = getCurrentStepIndex(name)
      const step = steps[stepIndex]
      if (!step) {
        return
      }
      step.tools.push({
        id:
          typeof part.id === "string"
            ? part.id
            : `${messageId}-thought-tool-${index}`,
        name,
        callId,
        status,
      })
      if (!step.label) {
        step.label = `Using ${name}`
      }
      if (status === "running" || status === "pending") {
        step.status = "active"
      }
    }
  })

  const finalizedSteps = steps.map((step, index) => {
    const reasoning = step.reasoningChunks.join("\n\n").trim()
    const firstTool = step.tools[0]?.name
    const hasRunningTool = step.tools.some((tool) => tool.status === "running")
    const hasPendingTool = step.tools.some((tool) => tool.status === "pending")
    const status: ChainOfThoughtStepStatus = step.hasFinish
      ? "complete"
      : hasRunningTool || (isStreaming && index === steps.length - 1)
        ? "active"
        : hasPendingTool
          ? "pending"
          : step.status === "pending" && !reasoning && step.tools.length === 0
            ? "pending"
            : "complete"

    return {
      id: step.id,
      label: normalizeThoughtLabel(step.label, step.summary, firstTool, reasoning, index),
      summary: step.summary,
      reasoning: reasoning || undefined,
      tools: step.tools,
      status,
    }
  })

  if (finalizedSteps.length === 0) {
    return null
  }

  const durationSeconds =
    typeof minStart === "number" &&
    typeof maxEnd === "number" &&
    maxEnd >= minStart
      ? Math.max(1, Math.ceil((maxEnd - minStart) / 1000))
      : undefined

  return { steps: finalizedSteps, durationSeconds }
}

export const getCheckpointMarkers = (
  parts: StructuredMessagePart[],
  messageId: string
): CheckpointMarker[] => {
  return parts
    .filter(
      (
        part
      ): part is StructuredMessagePart & { type: "data-checkpoint"; data?: unknown } =>
        part.type === "data-checkpoint"
    )
    .map((part, index) => {
      const data = toRecord(part.data) ?? {}
      const labelCandidate =
        typeof part.label === "string"
          ? part.label
          : typeof data.label === "string"
            ? data.label
            : typeof data.name === "string"
              ? data.name
              : undefined
      const label = labelCandidate?.trim() || `Checkpoint ${index + 1}`
      const description =
        typeof data.description === "string"
          ? data.description
          : typeof data.detail === "string"
            ? data.detail
            : undefined
      const status = typeof data.status === "string" ? data.status : undefined
      const timestamp =
        typeof data.timestamp === "string"
          ? data.timestamp
          : typeof data.ts === "string"
            ? data.ts
            : undefined
      const restoreSource = toRecord(data.restore) ?? toRecord(data)
      const restoreAvailable =
        typeof restoreSource?.available === "boolean"
          ? restoreSource.available
          : typeof restoreSource?.enabled === "boolean"
            ? restoreSource.enabled
            : true
      const messageIdCandidate = toTrimmedString(
        restoreSource?.messageId ??
          restoreSource?.messageID ??
          restoreSource?.message_id ??
          restoreSource?.message
      )
      const partIdCandidate = toTrimmedString(
        restoreSource?.partId ??
          restoreSource?.partID ??
          restoreSource?.part_id ??
          restoreSource?.part
      )
      const urlCandidate = toTrimmedString(
        restoreSource?.url ??
          restoreSource?.href ??
          restoreSource?.restoreUrl ??
          restoreSource?.restore_url
      )
      const methodCandidate = toTrimmedString(
        restoreSource?.method ?? restoreSource?.httpMethod ?? restoreSource?.http_method
      )
      const restoreLabel = toTrimmedString(
        restoreSource?.label ??
          restoreSource?.actionLabel ??
          restoreSource?.action_label ??
          restoreSource?.title
      )
      const restorePayload = restoreSource?.payload ?? restoreSource?.body
      const fallbackPartId = typeof part.id === "string" ? part.id : undefined
      const restore =
        restoreAvailable && (messageIdCandidate || urlCandidate)
          ? {
              messageId: messageIdCandidate,
              partId: partIdCandidate ?? fallbackPartId,
              url: urlCandidate,
              method: methodCandidate,
              payload: restorePayload,
              label: restoreLabel,
            }
          : undefined
      return {
        id: part.id ?? `${messageId}-checkpoint-${index}`,
        label,
        description,
        status,
        timestamp,
        restore,
      }
    })
}

export const getPlanEntries = (
  parts: StructuredMessagePart[],
  messageId: string
): PlanEntry[] => {
  const planParts = parts.filter(
    (
      part
    ): part is StructuredMessagePart & { type: "data-plan" | "data-plans"; data?: unknown } =>
      part.type === "data-plan" || part.type === "data-plans"
  )

  return planParts
    .map((part, index) => {
      const planId = part.id ?? `${messageId}-plan-${index}`
      const data = part.data
      const record =
        data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : undefined
      const title =
        toTrimmedString(part.label) ??
        toTrimmedString(record?.title ?? record?.label ?? record?.name)
      const summary = toTrimmedString(
        record?.summary ?? record?.description ?? record?.detail ?? record?.overview
      )
      const stepsSource =
        record?.steps ??
        record?.items ??
        record?.plan ??
        record?.tasks ??
        record?.phases ??
        record?.checklist
      const steps =
        stepsSource !== undefined ? parsePlanSteps(stepsSource, planId) : parsePlanSteps(data, planId)
      const statusValue = toTrimmedString(record?.status ?? record?.state)
      const statusStreaming =
        typeof statusValue === "string" &&
        ["streaming", "in_progress", "running", "pending"].includes(statusValue.toLowerCase())
      const streamingFlag =
        typeof record?.isStreaming === "boolean"
          ? record.isStreaming
          : typeof record?.streaming === "boolean"
            ? record.streaming
            : undefined

      return {
        id: planId,
        title,
        summary,
        steps,
        isStreaming: streamingFlag ?? statusStreaming,
      }
    })
    .filter((entry) => entry.steps.length > 0 || entry.title || entry.summary || entry.isStreaming)
}

export const getTaskEntries = (
  parts: StructuredMessagePart[],
  messageId: string
): TaskEntry[] => {
  const taskParts = parts.filter(
    (
      part
    ): part is StructuredMessagePart & { type: "data-task" | "data-tasks"; data?: unknown } =>
      part.type === "data-task" || part.type === "data-tasks"
  )

  return taskParts
    .map((part, index) => {
      const taskId = part.id ?? `${messageId}-task-${index}`
      const data = part.data
      const record =
        data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : undefined
      const title =
        toTrimmedString(part.label) ??
        toTrimmedString(record?.title ?? record?.label ?? record?.name ?? record?.task)
      const summary = toTrimmedString(
        record?.summary ?? record?.description ?? record?.detail ?? record?.overview
      )
      const itemsSource =
        record?.items ?? record?.tasks ?? record?.steps ?? record?.list ?? record?.queue
      const items =
        itemsSource !== undefined
          ? parseTaskItems(itemsSource, taskId)
          : parseTaskItems(data, taskId)
      const statusValue = toTrimmedString(record?.status ?? record?.state)
      const isStreaming =
        typeof record?.isStreaming === "boolean"
          ? record.isStreaming
          : typeof record?.streaming === "boolean"
            ? record.streaming
            : typeof statusValue === "string" &&
                ["streaming", "running", "in_progress", "pending"].includes(
                  statusValue.toLowerCase()
                )

      return {
        id: taskId,
        title,
        summary,
        items,
        isStreaming,
      }
    })
    .filter((entry) => entry.items.length > 0 || entry.title || entry.summary || entry.isStreaming)
}

export const getQueueEntries = (
  parts: StructuredMessagePart[],
  messageId: string
): QueueEntry[] => {
  const queueParts = parts.filter(
    (
      part
    ): part is StructuredMessagePart & { type: "data-queue" | "data-queues"; data?: unknown } =>
      part.type === "data-queue" || part.type === "data-queues"
  )

  return queueParts
    .map((part, index) => {
      const queueId = part.id ?? `${messageId}-queue-${index}`
      const data = part.data
      const record =
        data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : undefined
      const title =
        toTrimmedString(part.label) ??
        toTrimmedString(record?.title ?? record?.label ?? record?.name ?? record?.queue)
      const summary = toTrimmedString(
        record?.summary ?? record?.description ?? record?.detail ?? record?.overview
      )
      const itemsSource =
        record?.items ?? record?.queue ?? record?.tasks ?? record?.entries ?? record?.list
      const items =
        itemsSource !== undefined
          ? parseTaskItems(itemsSource, queueId)
          : parseTaskItems(data, queueId)
      const totalCount = parseProgressNumber(
        record?.total ?? record?.count ?? record?.size ?? record?.length
      )
      const statusValue = toTrimmedString(record?.status ?? record?.state)
      const isStreaming =
        typeof record?.isStreaming === "boolean"
          ? record.isStreaming
          : typeof record?.streaming === "boolean"
            ? record.streaming
            : typeof statusValue === "string" &&
                ["streaming", "running", "in_progress", "pending"].includes(
                  statusValue.toLowerCase()
                )

      return {
        id: queueId,
        title,
        summary,
        items,
        totalCount,
        isStreaming,
      }
    })
    .filter((entry) => entry.items.length > 0 || entry.title || entry.summary || entry.isStreaming)
}

export const parseBranchEntries = (
  value: unknown,
  messageId: string
): MessageBranchEntry[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((branch, index) => {
      if (typeof branch === "string") {
        const content = branch.trim()
        if (!content) {
          return null
        }
        const parts = normalizeMessageParts(content)
        return {
          id: `${messageId}-branch-${index}`,
          content,
          parts,
          sources: getSourcesFromParts(parts),
        }
      }

      if (branch && typeof branch === "object") {
        const record = branch as Record<string, unknown>
        const contentValue =
          typeof record.content === "string"
            ? record.content
            : typeof record.text === "string"
              ? record.text
              : ""
        const partsValue = Array.isArray(record.parts)
          ? (record.parts as StructuredMessagePart[])
          : normalizeMessageParts(contentValue)
        const sourcesValue = Array.isArray(record.sources)
          ? (record.sources as SourceCitation[]).filter(Boolean)
          : getSourcesFromParts(partsValue)
        const content = contentValue || getTextFromParts(partsValue)
        if (!content.trim()) {
          return null
        }
        const label = typeof record.label === "string" ? record.label : undefined
        return {
          id:
            typeof record.id === "string"
              ? record.id
              : `${messageId}-branch-${index}`,
          content,
          parts: partsValue,
          sources: sourcesValue,
          label,
        }
      }

      return null
    })
    .filter((branch): branch is MessageBranchEntry => Boolean(branch))
}

export const getMessageBranches = (
  message: ChatMessage,
  baseText: string,
  baseSources: SourceCitation[]
) => {
  const metadata =
    message.metadata && typeof message.metadata === "object"
      ? (message.metadata as Record<string, unknown>)
      : undefined
  const metadataBranches = metadata?.branches
  const dataBranchParts = message.parts.filter(
    (part) => part.type === "data-branch" || part.type === "data-branches"
  ) as Array<StructuredMessagePart & { data?: unknown }>
  const parsedBranches = [
    ...parseBranchEntries(metadataBranches, message.id),
    ...dataBranchParts.flatMap((part) => {
      if (Array.isArray(part.data)) {
        return parseBranchEntries(part.data, message.id)
      }
      if (part.data && typeof part.data === "object") {
        const record = part.data as Record<string, unknown>
        if (Array.isArray(record.branches)) {
          return parseBranchEntries(record.branches, message.id)
        }
      }
      return []
    }),
  ]

  const normalizedBase = baseText.trim()
  const uniqueBranches = parsedBranches.filter(
    (branch) => branch.content.trim() && branch.content.trim() !== normalizedBase
  )
  const baseBranch = normalizedBase
    ? [
        {
          id: `${message.id}-branch-base`,
          content: baseText,
          parts: message.parts,
          sources: baseSources,
        },
      ]
    : []
  const branches = [...baseBranch, ...uniqueBranches]
  const metadataBranchIndex =
    typeof metadata?.branchIndex === "number" ? metadata.branchIndex : undefined
  const defaultBranch =
    typeof metadataBranchIndex === "number" &&
    metadataBranchIndex >= 0 &&
    metadataBranchIndex < branches.length
      ? metadataBranchIndex
      : 0

  return { branches, defaultBranch }
}
