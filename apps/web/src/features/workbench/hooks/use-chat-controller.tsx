import * as React from "react"

import type { PromptInputMessage } from "../../../components/ai-elements/prompt-input"
import {
  applyMessageDelta,
  applyMessageEnd,
  applyMessagePartUpdate,
  createClientMessage,
  getTextFromParts,
  normalizeMessageParts,
  type StructuredMessagePart,
} from "../../../lib/messages"
import { extractUsageFromMetadata } from "../message-entries"
import type { ChatMessage, ChatSession, CheckpointMarker } from "../types"
import { useWorkbench } from "../workbench-context"

type ChatController = {
  activeChat: ChatSession | null
  messages: ChatMessage[]
  copiedMessageId: string | null
  chatStatus: "idle" | "streaming" | "error"
  chatError: string | null
  restoreCheckpointError: string | null
  restoringCheckpoints: Record<string, boolean>
  promptValue: string
  isTranscriptLoading: boolean
  isAwaitingFirstToken: boolean
  isChatStreaming: boolean
  contextUsage: NonNullable<ReturnType<typeof extractUsageFromMetadata>> | undefined
  promptDisabled: boolean
  onPromptChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSuggestionClick: (suggestion: string) => void
  onPromptSubmit: (message: PromptInputMessage) => Promise<void>
  onCopyMessage: (messageId: string, text: string) => Promise<void>
  onRetryMessage: (messageIndex: number) => void
  onRestoreCheckpoint: (checkpoint: CheckpointMarker) => Promise<void>
}

type ChatControllerOptions = {
  workspaceSessionId?: string | null
}

export const useChatController = ({
  workspaceSessionId = null,
}: ChatControllerOptions = {}): ChatController => {
  const { meta } = useWorkbench()
  const { selectedWorkspace, selectedChat } = meta

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null)
  const [chatStatus, setChatStatus] = React.useState<"idle" | "streaming" | "error">(
    "idle"
  )
  const [chatError, setChatError] = React.useState<string | null>(null)
  const [restoreCheckpointError, setRestoreCheckpointError] = React.useState<
    string | null
  >(null)
  const [restoringCheckpoints, setRestoringCheckpoints] = React.useState<
    Record<string, boolean>
  >({})
  const [promptValue, setPromptValue] = React.useState("")
  const [isTranscriptLoading, setIsTranscriptLoading] = React.useState(false)
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = React.useState(false)
  const streamAbortRef = React.useRef<AbortController | null>(null)
  const transcriptAbortRef = React.useRef<AbortController | null>(null)
  const copyTimeoutRef = React.useRef<number | null>(null)

  const createLocalMessageId = React.useCallback(() => {
    return `m_${Math.random().toString(36).slice(2, 10)}`
  }, [])
  const createLocalFileId = React.useCallback(() => {
    return `f_${Math.random().toString(36).slice(2, 10)}`
  }, [])

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const activeChat = React.useMemo<ChatSession | null>(() => {
    if (selectedChat) {
      return selectedChat
    }
    if (!selectedWorkspace) {
      return null
    }
    if (workspaceSessionId) {
      const workspaceSession = selectedWorkspace.chats.find(
        (chatEntry) => chatEntry.id === workspaceSessionId
      )
      if (workspaceSession) {
        return workspaceSession
      }
    }
    return selectedWorkspace.chats[0] ?? null
  }, [selectedChat, selectedWorkspace, workspaceSessionId])

  const fetchTranscript = React.useCallback(
    async (conversationId: string, sessionId: string, signal: AbortSignal) => {
      const response = await fetch(
        `/api/conversations/${conversationId}/sessions/${sessionId}/transcript`,
        { signal }
      )
      if (!response.ok) {
        throw new Error("Failed to load transcript.")
      }
      const transcript = (await response.json()) as {
        role: "user" | "assistant"
        content?: string
        parts?: StructuredMessagePart[]
        metadata?: Record<string, unknown>
      }[]
      setMessages(
        transcript.map((entry) =>
          createClientMessage({
            id: createLocalMessageId(),
            role: entry.role,
            content: entry.content,
            parts: entry.parts,
            metadata: entry.metadata,
          })
        )
      )
    },
    [createLocalMessageId]
  )

  const loadTranscript = React.useCallback(
    async (resetPrompt: boolean) => {
      streamAbortRef.current?.abort()
      transcriptAbortRef.current?.abort()
      if (resetPrompt) {
        setMessages([])
        setPromptValue("")
        setChatStatus("idle")
        setChatError(null)
        setRestoreCheckpointError(null)
        setIsAwaitingFirstToken(false)
      }
      const conversationId = selectedWorkspace?.id
      const sessionId = activeChat?.id
      if (!conversationId || !sessionId) {
        setIsTranscriptLoading(false)
        return
      }
      const controller = new AbortController()
      transcriptAbortRef.current = controller
      setIsTranscriptLoading(true)
      try {
        await fetchTranscript(conversationId, sessionId, controller.signal)
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }
        setChatError(err instanceof Error ? err.message : "Failed to load transcript.")
        setMessages([])
      } finally {
        if (!controller.signal.aborted) {
          setIsTranscriptLoading(false)
        }
      }
    },
    [activeChat?.id, fetchTranscript, selectedWorkspace?.id]
  )

  React.useEffect(() => {
    void loadTranscript(true)
  }, [selectedWorkspace?.id, activeChat?.id, loadTranscript])

  const onPromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPromptValue(event.target.value)
  }

  const onSuggestionClick = React.useCallback((suggestion: string) => {
    setPromptValue(suggestion)
    if (typeof document === "undefined") {
      return
    }
    window.requestAnimationFrame(() => {
      const textarea = document.querySelector(
        'textarea[name="message"]'
      ) as HTMLTextAreaElement | null
      if (!textarea) {
        return
      }
      textarea.focus()
      textarea.setSelectionRange(suggestion.length, suggestion.length)
    })
  }, [])

  const onPromptSubmit = async (message: PromptInputMessage) => {
    if (!selectedWorkspace || !activeChat) {
      return
    }
    if (chatStatus === "streaming") {
      return
    }
    const content = message.text.trim()
    if (!content) {
      return
    }

    const conversationId = selectedWorkspace.id
    const sessionId = activeChat.id
    const userMessageId = createLocalMessageId()
    const assistantMessageId = createLocalMessageId()
    const attachmentParts: StructuredMessagePart[] = message.files.map((file) => {
      const attachmentId = createLocalFileId()
      return {
        type: "file",
        id: attachmentId,
        file: {
          id: attachmentId,
          name: file.filename,
          path: file.url,
          mimeType: file.mediaType,
          size: file.size,
          source: "upload",
        },
      }
    })
    const userParts = normalizeMessageParts(content, [
      { type: "text", text: content },
      ...attachmentParts,
    ])

    setPromptValue("")
    setChatError(null)
    setIsAwaitingFirstToken(true)
    setChatStatus("streaming")
    setMessages((prev) => [
      ...prev,
      createClientMessage({ id: userMessageId, role: "user", content, parts: userParts }),
      createClientMessage({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        parts: [],
        isStreaming: true,
      }),
    ])

    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/sessions/${sessionId}/chat/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, parts: userParts }),
          signal: controller.signal,
        }
      )
      if (!response.ok || !response.body) {
        throw new Error("Failed to start streaming response.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""

        for (const part of parts) {
          const lines = part.split("\n").filter(Boolean)
          if (!lines.length) {
            continue
          }
          let eventName = "message"
          const dataLines: string[] = []
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.replace(/^event:\s*/, "")
            } else if (line.startsWith("data:")) {
              dataLines.push(line.replace(/^data:\s*/, ""))
            }
          }
          const rawData = dataLines.join("\n")
          let data: any = rawData
          if (rawData) {
            try {
              data = JSON.parse(rawData)
            } catch {
              data = rawData
            }
          }

          if (eventName === "message_delta" && typeof data?.delta === "string") {
            setIsAwaitingFirstToken(false)
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? applyMessageDelta(message, data.delta)
                  : message
              )
            )
            continue
          }

          if (eventName === "message_part_updated" || eventName === "message.part.updated") {
            const incomingPart = data?.part
            if (incomingPart && typeof incomingPart.type === "string") {
              setIsAwaitingFirstToken(false)
              setMessages((prev) =>
                prev.map((message) => {
                  if (message.id !== assistantMessageId) {
                    return message
                  }
                  return applyMessagePartUpdate(
                    message,
                    incomingPart as StructuredMessagePart,
                    data?.delta
                  )
                })
              )
            }
            continue
          }

          if (eventName === "message_end") {
            setIsAwaitingFirstToken(false)
            setChatStatus("idle")
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? applyMessageEnd(message, {
                      content: typeof data?.content === "string" ? data.content : undefined,
                      parts: Array.isArray(data?.parts) ? data.parts : undefined,
                    })
                  : message
              )
            )
            continue
          }

          if (eventName === "error") {
            setIsAwaitingFirstToken(false)
            setChatStatus("error")
            setChatError(
              typeof data?.message === "string" ? data.message : "Streaming failed."
            )
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, isStreaming: false }
                  : message
              )
            )
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return
      }
      setIsAwaitingFirstToken(false)
      setChatStatus("error")
      setChatError(err instanceof Error ? err.message : "Streaming failed.")
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? { ...message, isStreaming: false }
            : message
        )
      )
    } finally {
      if (!controller.signal.aborted) {
        setIsAwaitingFirstToken(false)
        setChatStatus((status) => (status === "streaming" ? "idle" : status))
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, isStreaming: false }
              : message
          )
        )
      }
      streamAbortRef.current = null
    }
  }

  const onCopyMessage = React.useCallback(
    async (messageId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) {
        return
      }

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(trimmed)
        } else {
          const textarea = document.createElement("textarea")
          textarea.value = trimmed
          textarea.style.position = "fixed"
          textarea.style.opacity = "0"
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand("copy")
          document.body.removeChild(textarea)
        }
      } catch {
        return
      }

      setCopiedMessageId(messageId)
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current))
      }, 2000)
    },
    []
  )

  const onRetryMessage = React.useCallback(
    (messageIndex: number) => {
      if (chatStatus === "streaming") {
        return
      }

      for (let index = messageIndex; index >= 0; index -= 1) {
        const candidate = messages[index]
        if (candidate?.role !== "user") {
          continue
        }
        const candidateText = getTextFromParts(candidate.parts) || candidate.content || ""
        if (candidateText.trim()) {
          void onPromptSubmit({ text: candidateText, files: [] })
          return
        }
      }
    },
    [chatStatus, messages, onPromptSubmit]
  )

  const onRestoreCheckpoint = React.useCallback(
    async (checkpoint: CheckpointMarker) => {
      if (!selectedWorkspace || !activeChat) {
        return
      }
      if (!checkpoint.restore) {
        return
      }
      if (restoringCheckpoints[checkpoint.id]) {
        return
      }
      setRestoreCheckpointError(null)
      setRestoringCheckpoints((prev) => ({ ...prev, [checkpoint.id]: true }))
      try {
        let response: Response
        if (checkpoint.restore.url) {
          const method = (checkpoint.restore.method ?? "POST").toUpperCase()
          const hasBody = checkpoint.restore.payload !== undefined && method !== "GET"
          response = await fetch(checkpoint.restore.url, {
            method,
            headers: hasBody ? { "Content-Type": "application/json" } : undefined,
            body: hasBody ? JSON.stringify(checkpoint.restore.payload) : undefined,
          })
        } else {
          if (!checkpoint.restore.messageId) {
            throw new Error("Checkpoint restore is missing a message id.")
          }
          response = await fetch(
            `/api/conversations/${selectedWorkspace.id}/sessions/${activeChat.id}/checkpoints/restore`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messageId: checkpoint.restore.messageId,
                partId: checkpoint.restore.partId,
              }),
            }
          )
        }
        if (!response.ok) {
          let message = "Failed to restore checkpoint."
          try {
            const payload = (await response.json()) as { error?: string }
            if (payload.error) {
              message = payload.error
            }
          } catch {
            // Ignore parsing errors
          }
          throw new Error(message)
        }
        await loadTranscript(false)
      } catch (err) {
        setRestoreCheckpointError(
          err instanceof Error ? err.message : "Failed to restore checkpoint."
        )
      } finally {
        setRestoringCheckpoints((prev) => {
          const next = { ...prev }
          delete next[checkpoint.id]
          return next
        })
      }
    },
    [
      loadTranscript,
      restoringCheckpoints,
      activeChat,
      selectedWorkspace,
      setRestoreCheckpointError,
    ]
  )

  const usageFromMessages = React.useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const usage = extractUsageFromMetadata(messages[index]?.metadata)
      if (usage) {
        return usage
      }
    }
    return null
  }, [messages])

  const isChatStreaming = chatStatus === "streaming"
  const contextUsage = usageFromMessages ?? undefined
  const promptDisabled =
    isChatStreaming || !selectedWorkspace || !activeChat || isTranscriptLoading

  return {
    activeChat,
    messages,
    copiedMessageId,
    chatStatus,
    chatError,
    restoreCheckpointError,
    restoringCheckpoints,
    promptValue,
    isTranscriptLoading,
    isAwaitingFirstToken,
    isChatStreaming,
    contextUsage,
    promptDisabled,
    onPromptChange,
    onSuggestionClick,
    onPromptSubmit,
    onCopyMessage,
    onRetryMessage,
    onRestoreCheckpoint,
  }
}
