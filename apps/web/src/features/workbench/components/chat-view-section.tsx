import { ChatView } from "../views/chat-view"
import type { ContextUsage } from "../../../components/ai-elements/context-usage"
import type { ModelOption } from "../../../components/ai-elements/model-selector"
import type { PromptInputMessage } from "../../../components/ai-elements/prompt-input"
import type { ChatMessage, CheckpointMarker } from "../types"

type ChatViewSectionProps = {
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

export const ChatViewSection = (props: ChatViewSectionProps) => {
  return <ChatView {...props} />
}
