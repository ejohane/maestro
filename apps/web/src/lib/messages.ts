import type { Message, MessagePart, MessageRole } from "@maestro/core"
import { getTextFromParts as getCoreTextFromParts } from "@maestro/core"

export type StructuredMessagePart = MessagePart & {
  id?: string
  index?: number
  text?: string
}

export type ClientMessage = Omit<Message, "content" | "parts" | "role" | "id"> & {
  id: string
  role: MessageRole
  content: string
  parts: StructuredMessagePart[]
  metadata?: Record<string, unknown>
  isStreaming?: boolean
}

export const normalizeMessageParts = (
  content: string,
  parts?: StructuredMessagePart[]
): StructuredMessagePart[] => {
  if (Array.isArray(parts) && parts.length > 0) {
    return parts
  }
  if (content) {
    return [{ type: "text", text: content }]
  }
  return []
}

export const getTextFromParts = (parts?: StructuredMessagePart[]): string => {
  if (!parts || parts.length === 0) {
    return ""
  }
  return getCoreTextFromParts(parts as MessagePart[])
}

export const normalizeMessageContent = (
  content: string | undefined,
  parts?: StructuredMessagePart[]
): string => {
  if (typeof content === "string" && content.length > 0) {
    return content
  }
  return getTextFromParts(parts)
}

export const createClientMessage = (input: {
  id: string
  role: MessageRole
  content?: string
  parts?: StructuredMessagePart[]
  metadata?: Record<string, unknown>
  isStreaming?: boolean
}): ClientMessage => {
  const resolvedContent = normalizeMessageContent(input.content, input.parts)
  const resolvedParts = normalizeMessageParts(resolvedContent, input.parts)
  return {
    id: input.id,
    role: input.role,
    content: resolvedContent,
    parts: resolvedParts,
    metadata: input.metadata,
    isStreaming: input.isStreaming
  }
}

const getPartIndex = (parts: StructuredMessagePart[], part: StructuredMessagePart): number => {
  const partIndex = part.index
  if (typeof partIndex === "number" && partIndex >= 0) {
    return partIndex
  }
  if (typeof part.id === "string") {
    return parts.findIndex((existing) => existing.id === part.id)
  }
  return -1
}

const mergeMessagePart = (
  existing: StructuredMessagePart | undefined,
  incoming: StructuredMessagePart,
  delta: unknown
): StructuredMessagePart => {
  const merged: StructuredMessagePart = { ...(existing ?? {}), ...incoming }
  const existingText = typeof existing?.text === "string" ? existing.text : ""
  const incomingText = typeof incoming.text === "string" ? incoming.text : ""

  if (incoming.type === "text" || incoming.type === "reasoning") {
    let nextText = existingText
    if (incomingText && incomingText.startsWith(existingText)) {
      nextText = incomingText
    } else if (typeof delta === "string") {
      nextText = existingText + delta
    } else if (incomingText) {
      nextText = incomingText
    }
    merged.text = nextText
  }

  return merged
}

export const upsertMessagePart = (
  parts: StructuredMessagePart[],
  incoming: StructuredMessagePart,
  delta: unknown
): StructuredMessagePart[] => {
  const index = getPartIndex(parts, incoming)
  if (index >= 0) {
    const nextParts = parts.slice()
    nextParts[index] = mergeMessagePart(parts[index], incoming, delta)
    return nextParts
  }
  return [...parts, mergeMessagePart(undefined, incoming, delta)]
}

const updateTextPartForDelta = (
  parts: StructuredMessagePart[],
  delta: string
): StructuredMessagePart[] => {
  const index = parts.findIndex((part) => part.type === "text")
  if (index < 0) {
    return [...parts, { type: "text", text: delta }]
  }
  const existing = parts[index]
  const existingText = typeof existing.text === "string" ? existing.text : ""
  const nextParts = parts.slice()
  nextParts[index] = { ...existing, text: existingText + delta }
  return nextParts
}

export const applyMessageDelta = (
  message: ClientMessage,
  delta: string
): ClientMessage => {
  const nextContent = message.content + delta
  const nextParts = updateTextPartForDelta(message.parts, delta)
  return { ...message, content: nextContent, parts: nextParts, isStreaming: true }
}

export const applyMessagePartUpdate = (
  message: ClientMessage,
  part: StructuredMessagePart,
  delta: unknown
): ClientMessage => {
  const updatedParts = upsertMessagePart(message.parts, part, delta)
  const partsText = getTextFromParts(updatedParts)
  const nextContent =
    partsText.length >= message.content.length ? partsText : message.content
  return {
    ...message,
    parts: updatedParts,
    content: nextContent,
    isStreaming: true
  }
}

export const applyMessageEnd = (
  message: ClientMessage,
  payload: { content?: string; parts?: StructuredMessagePart[] }
): ClientMessage => {
  const resolvedContent = normalizeMessageContent(payload.content, payload.parts)
  const resolvedParts = normalizeMessageParts(resolvedContent, payload.parts)
  return {
    ...message,
    content: resolvedContent || message.content,
    parts: resolvedParts.length > 0 ? resolvedParts : message.parts,
    isStreaming: false
  }
}
