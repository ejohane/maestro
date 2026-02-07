import type * as React from "react"
import type { FileReference } from "@maestro/core"
import { ArrowUp, Check, Copy, RotateCcw } from "lucide-react"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../../../components/ai-elements/conversation"
import { Loader } from "../../../components/ai-elements/loader"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAttachments,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageCheckpoint,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "../../../components/ai-elements/message"
import { ModelSelector, type ModelOption } from "../../../components/ai-elements/model-selector"
import { PlanSection } from "../../../components/ai-elements/plan"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "../../../components/ai-elements/prompt-input"
import { ChainOfThoughtSection } from "../../../components/ai-elements/chain-of-thought"
import {
  CitationAnchor,
  CitationProvider,
  prepareCitationMarkdown,
  SourcesList,
} from "../../../components/ai-elements/sources"
import { ContextUsageIndicator, type ContextUsage } from "../../../components/ai-elements/context-usage"
import { QueueSection, TaskListSection } from "../../../components/ai-elements/task-queue"
import { Button } from "../../../components/ui/button"
import { Shimmer } from "../../../components/ui/shimmer"
import { getTextFromParts, type StructuredMessagePart } from "../../../lib/messages"
import { cn } from "../../../lib/utils"
import { PromptInputAttachmentsPreview } from "../components/prompt-input-attachments-preview"
import {
  getChainOfThoughtEntry,
  getCheckpointMarkers,
  getMessageBranches,
  getPlanEntries,
  getQueueEntries,
  getSourcesFromParts,
  getTaskEntries,
} from "../message-entries"
import type { ChatMessage, CheckpointMarker } from "../types"

type ChatViewProps = {
  isTranscriptLoading: boolean
  messages: ChatMessage[]
  copiedMessageId: string | null
  isChatStreaming: boolean
  isAwaitingFirstToken: boolean
  restoringCheckpoints: Record<string, boolean>
  emptyStateSuggestions: string[]
  promptDisabled: boolean
  promptValue: string
  modelOptions: ModelOption[]
  selectedModel: string
  isUpdatingModel: boolean
  contextUsage?: ContextUsage
  updateModelError: string | null
  chatError: string | null
  restoreCheckpointError: string | null
  onSuggestionClick: (suggestion: string) => void
  onPromptSubmit: (message: PromptInputMessage) => Promise<void>
  onPromptChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  onUpdateSessionModel: (modelId: string) => Promise<void>
  onCopyMessage: (messageId: string, messageText: string) => Promise<void>
  onRetryMessage: (messageIndex: number) => void
  onRestoreCheckpoint: (checkpoint: CheckpointMarker) => Promise<void>
}

const stripLeadingUserEcho = (assistantText: string, userText: string): string => {
  const normalizedAssistantText = assistantText.trimStart()
  const normalizedUserText = userText.trim()
  if (!normalizedAssistantText || !normalizedUserText) {
    return assistantText
  }
  if (!normalizedAssistantText.startsWith(normalizedUserText)) {
    return assistantText
  }

  const echoedPrefixRemoved = normalizedAssistantText
    .slice(normalizedUserText.length)
    .replace(/^\s+/, "")
  return echoedPrefixRemoved
}

export const ChatView = ({
  isTranscriptLoading,
  messages,
  copiedMessageId,
  isChatStreaming,
  isAwaitingFirstToken,
  restoringCheckpoints,
  emptyStateSuggestions,
  promptDisabled,
  promptValue,
  modelOptions,
  selectedModel,
  isUpdatingModel,
  contextUsage,
  updateModelError,
  chatError,
  restoreCheckpointError,
  onSuggestionClick,
  onPromptSubmit,
  onPromptChange,
  onUpdateSessionModel,
  onCopyMessage,
  onRetryMessage,
  onRestoreCheckpoint,
}: ChatViewProps) => {
  const isInitialSessionView = !isTranscriptLoading && messages.length === 0

  return (
    <Conversation className="chat-session min-h-0 flex-1">
      <ConversationContent
        className={cn(
          "chat-session-content gap-6",
          !isInitialSessionView && "chat-session-content-pinned"
        )}
      >
        {isTranscriptLoading ? (
          <div className="flex h-full min-h-[320px] items-center justify-center">
            <div className="grid w-full max-w-lg gap-3 px-4 text-sm text-muted-foreground">
              <div className="inline-flex items-center gap-2">
                <Loader className="mr-1" /> Loading transcript...
              </div>
              <div className="grid gap-2">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-full" />
                <Shimmer className="h-3 w-5/6" />
              </div>
            </div>
          </div>
        ) : messages.length ? (
          messages.map((message, messageIndex) => {
            const attachmentParts = message.parts.filter(
              (part): part is StructuredMessagePart & {
                type: "file"
                file: FileReference
              } => part.type === "file"
            )
            const attachments = attachmentParts.map((part, index) => {
              const file = part.file
              return {
                id: file.id || part.id || `attachment-${message.id}-${index}`,
                name: file.name,
                path: file.path,
                mimeType: file.mimeType,
                size: file.size,
                source: file.source,
              }
            })
            const sources = getSourcesFromParts(message.parts)
            const rawMessageText = getTextFromParts(message.parts) || message.content || ""
            const lastUserMessageText =
              message.role === "assistant"
                ? (() => {
                    for (let index = messageIndex; index >= 0; index -= 1) {
                      const candidate = messages[index]
                      if (candidate?.role !== "user") {
                        continue
                      }
                      const candidateText =
                        getTextFromParts(candidate.parts) || candidate.content || ""
                      if (candidateText.trim()) {
                        return candidateText
                      }
                    }
                    return ""
                  })()
                : ""
            const messageText =
              message.role === "assistant"
                ? stripLeadingUserEcho(rawMessageText, lastUserMessageText)
                : rawMessageText
            const hasMessageText = Boolean(messageText)
            const messageMarkdown = prepareCitationMarkdown(messageText, sources)
            const chainOfThought =
              message.role === "assistant"
                ? getChainOfThoughtEntry(message.parts, message.id, message.isStreaming)
                : null
            const checkpointMarkers = getCheckpointMarkers(message.parts, message.id)
            const planEntries = getPlanEntries(message.parts, message.id)
            const taskEntries = getTaskEntries(message.parts, message.id)
            const queueEntries = getQueueEntries(message.parts, message.id)
            const { branches: messageBranches, defaultBranch } = getMessageBranches(
              message,
              messageText,
              sources
            )
            const hasBranches = messageBranches.length > 1
            const isCopied = copiedMessageId === message.id
            const canRetry =
              message.role === "assistant" &&
              !message.isStreaming &&
              !isChatStreaming &&
              Boolean(lastUserMessageText.trim())
            const canCopy = Boolean(messageText.trim())
            const showActions = canCopy || canRetry
            const showToolbar = showActions || hasBranches
            const toolbarClassName = hasBranches ? undefined : "justify-end"
            const canRestoreCheckpoint = !isChatStreaming && !isTranscriptLoading
            const actionButtons = showActions ? (
              <MessageActions>
                {canCopy ? (
                  <MessageAction
                    aria-label={isCopied ? "Copied" : "Copy message"}
                    label={isCopied ? "Copied" : "Copy message"}
                    onClick={() => void onCopyMessage(message.id, messageText)}
                    tooltip={isCopied ? "Copied" : "Copy"}
                  >
                    {isCopied ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </MessageAction>
                ) : null}
                {canRetry ? (
                  <MessageAction
                    aria-label="Retry"
                    label="Retry"
                    onClick={() => onRetryMessage(messageIndex)}
                    tooltip="Retry"
                  >
                    <RotateCcw className="size-3.5" />
                  </MessageAction>
                ) : null}
              </MessageActions>
            ) : null

            return (
              <Message key={message.id} from={message.role} className="chat-session-message">
                <MessageContent className="chat-session-message-content">
                  {attachments.length ? <MessageAttachments attachments={attachments} /> : null}
                  {checkpointMarkers.length ? (
                    <div className="flex flex-wrap gap-2">
                      {checkpointMarkers.map((checkpoint) => (
                        <MessageCheckpoint
                          key={checkpoint.id}
                          label={checkpoint.label}
                          description={checkpoint.description}
                          status={checkpoint.status}
                          timestamp={checkpoint.timestamp}
                          onRestore={
                            checkpoint.restore
                              ? () => void onRestoreCheckpoint(checkpoint)
                              : undefined
                          }
                          restoreLabel={checkpoint.restore?.label}
                          isRestoring={Boolean(restoringCheckpoints[checkpoint.id])}
                          restoreDisabled={!canRestoreCheckpoint}
                        />
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" ? (
                    <>
                      {chainOfThought ? (
                        <ChainOfThoughtSection
                          entry={chainOfThought}
                          isStreaming={message.isStreaming}
                        />
                      ) : null}
                      {planEntries.length ? (
                        <div className="grid gap-2">
                          {planEntries.map((plan) => (
                            <PlanSection
                              key={plan.id}
                              title={plan.title}
                              summary={plan.summary}
                              steps={plan.steps}
                              isStreaming={plan.isStreaming ?? message.isStreaming}
                            />
                          ))}
                        </div>
                      ) : null}
                      {taskEntries.length ? (
                        <div className="grid gap-2">
                          {taskEntries.map((task) => (
                            <TaskListSection
                              key={task.id}
                              title={task.title}
                              summary={task.summary}
                              items={task.items}
                              isStreaming={task.isStreaming ?? message.isStreaming}
                            />
                          ))}
                        </div>
                      ) : null}
                      {queueEntries.length ? (
                        <div className="grid gap-2">
                          {queueEntries.map((queue) => (
                            <QueueSection
                              key={queue.id}
                              title={queue.title}
                              summary={queue.summary}
                              items={queue.items}
                              totalCount={queue.totalCount}
                              isStreaming={queue.isStreaming ?? message.isStreaming}
                            />
                          ))}
                        </div>
                      ) : null}
                      {hasBranches ? (
                        <MessageBranch defaultBranch={defaultBranch}>
                          <MessageBranchContent>
                            {messageBranches.map((branch) => {
                              const branchMarkdown = prepareCitationMarkdown(
                                branch.content,
                                branch.sources
                              )

                              return (
                                <div className="grid gap-2" key={branch.id}>
                                  <CitationProvider sources={branch.sources}>
                                    <MessageResponse components={{ a: CitationAnchor }}>
                                      {branchMarkdown}
                                    </MessageResponse>
                                  </CitationProvider>
                                  {branch.sources.length ? (
                                    <SourcesList sources={branch.sources} />
                                  ) : null}
                                </div>
                              )
                            })}
                          </MessageBranchContent>
                          {showToolbar ? (
                            <MessageToolbar
                              className={cn("chat-session-message-toolbar", toolbarClassName)}
                            >
                              {actionButtons}
                              <MessageBranchSelector from={message.role}>
                                <MessageBranchPrevious />
                                <MessageBranchPage />
                                <MessageBranchNext />
                              </MessageBranchSelector>
                            </MessageToolbar>
                          ) : null}
                        </MessageBranch>
                      ) : hasMessageText ? (
                        <>
                          <CitationProvider sources={sources}>
                            <MessageResponse components={{ a: CitationAnchor }}>
                              {messageMarkdown}
                            </MessageResponse>
                          </CitationProvider>
                          {sources.length ? <SourcesList sources={sources} /> : null}
                          {showToolbar ? (
                            <MessageToolbar
                              className={cn("chat-session-message-toolbar", toolbarClassName)}
                            >
                              {actionButtons}
                            </MessageToolbar>
                          ) : null}
                        </>
                      ) : showToolbar ? (
                        <MessageToolbar
                          className={cn("chat-session-message-toolbar", toolbarClassName)}
                        >
                          {actionButtons}
                        </MessageToolbar>
                      ) : null}
                      {message.isStreaming && !hasMessageText && isAwaitingFirstToken ? (
                        <div className="grid gap-2">
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <Loader /> Waiting for response...
                          </span>
                          <div className="grid gap-1">
                            <Shimmer className="h-3 w-4/5" />
                            <Shimmer className="h-3 w-2/3" />
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <CitationProvider sources={sources}>
                      <MessageResponse components={{ a: CitationAnchor }}>
                        {messageMarkdown}
                      </MessageResponse>
                    </CitationProvider>
                  )}
                </MessageContent>
                {message.role === "user" && showToolbar ? (
                  <MessageToolbar
                    className={cn(
                      "chat-session-message-toolbar self-end",
                      toolbarClassName
                    )}
                  >
                    {actionButtons}
                  </MessageToolbar>
                ) : null}
              </Message>
            )
          })
        ) : (
          <ConversationEmptyState className="chat-session-empty min-h-[320px]">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">No messages yet</h3>
                <p className="text-sm text-muted-foreground">
                  Ask a question to start the session.
                </p>
              </div>
              <div className="flex w-full max-w-xl flex-wrap justify-center gap-2">
                {emptyStateSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    className="chat-session-suggestion rounded-full text-xs"
                    disabled={promptDisabled}
                    onClick={() => onSuggestionClick(suggestion)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </ConversationEmptyState>
        )}
      </ConversationContent>
      <ConversationScrollButton
        className={cn(
          "chat-session-scroll-button",
          !isInitialSessionView && "chat-session-scroll-button-pinned"
        )}
      />
      <div
        className={cn(
          "chat-session-composer",
          !isInitialSessionView && "chat-session-composer-pinned"
        )}
      >
        <PromptInput className="chat-session-prompt" multiple onSubmit={onPromptSubmit}>
          <PromptInputAttachmentsPreview />
          <PromptInputTextarea
            className="chat-session-textarea"
            value={promptValue}
            onChange={onPromptChange}
            placeholder="Ask for follow-up changes"
            disabled={promptDisabled}
          />
          <PromptInputFooter className="chat-session-footer">
            <div className="chat-session-meta">
              <PromptInputTools className="chat-session-tools">
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger
                    aria-label="Prompt actions"
                    className="chat-session-tool-button"
                    disabled={promptDisabled}
                  />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments disabled={promptDisabled} />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <ModelSelector
                  className="chat-session-model-selector"
                  label=""
                  models={modelOptions}
                  value={selectedModel}
                  disabled={promptDisabled || isUpdatingModel}
                  onSelect={onUpdateSessionModel}
                />
                <span className="chat-session-effort">Extra High</span>
              </PromptInputTools>
              {contextUsage ? <ContextUsageIndicator usage={contextUsage} /> : null}
            </div>
            <PromptInputSubmit
              aria-label={isChatStreaming ? "Stop generation" : "Send"}
              className="chat-session-submit"
              disabled={promptDisabled || !promptValue.trim()}
              status={isChatStreaming ? "streaming" : "idle"}
              type="submit"
            >
              {!isChatStreaming ? <ArrowUp className="size-4" /> : null}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
        {updateModelError ? (
          <div className="chat-session-error mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {updateModelError}
          </div>
        ) : null}
        {chatError ? (
          <div className="chat-session-error mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {chatError}
          </div>
        ) : null}
        {restoreCheckpointError ? (
          <div className="chat-session-error mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {restoreCheckpointError}
          </div>
        ) : null}
      </div>
    </Conversation>
  )
}
