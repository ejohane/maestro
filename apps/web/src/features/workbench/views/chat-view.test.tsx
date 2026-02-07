import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ChatView } from "./chat-view"
import type { ChatMessage } from "../types"
import type { PromptInputMessage } from "../../../components/ai-elements/prompt-input"

vi.mock("../../../components/ai-elements/conversation", () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationEmptyState: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationScrollButton: () => <button type="button">Scroll</button>,
}))

vi.mock("../../../components/ai-elements/loader", () => ({
  Loader: () => <span>Loader</span>,
}))

vi.mock("../../../components/ai-elements/message", () => ({
  Message: ({ children }: { children: React.ReactNode }) => <article>{children}</article>,
  MessageAction: ({
    children,
    onClick,
    label,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: () => void
    label?: string
    "aria-label"?: string
  }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel ?? label}>
      {children}
      {label}
    </button>
  ),
  MessageActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageAttachments: ({ attachments }: { attachments: Array<{ name: string }> }) => (
    <div>attachments:{attachments.map((item) => item.name).join(",")}</div>
  ),
  MessageBranch: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageBranchContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageBranchNext: () => <button type="button">next</button>,
  MessageBranchPage: () => <span>page</span>,
  MessageBranchPrevious: () => <button type="button">previous</button>,
  MessageBranchSelector: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageCheckpoint: ({
    label,
    onRestore,
  }: {
    label: string
    onRestore?: () => void
  }) => (
    <button type="button" onClick={onRestore}>
      checkpoint:{label}
    </button>
  ),
  MessageContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageResponse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("../../../components/ai-elements/model-selector", () => ({
  ModelSelector: ({
    onSelect,
    value,
  }: {
    onSelect: (value: string) => void
    value: string
  }) => (
    <button type="button" onClick={() => onSelect(value)}>
      select-model
    </button>
  ),
}))

vi.mock("../../../components/ai-elements/plan", () => ({
  PlanSection: ({ title }: { title?: string }) => <div>plan:{title ?? "untitled"}</div>,
}))

vi.mock("../../../components/ai-elements/prompt-input", () => ({
  PromptInput: ({
    children,
    onSubmit,
  }: {
    children: React.ReactNode
    onSubmit: (message: PromptInputMessage) => Promise<void>
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({ text: "from-submit", files: [] })
      }}
    >
      {children}
    </form>
  ),
  PromptInputActionAddAttachments: () => <button type="button">add-attachment</button>,
  PromptInputActionMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PromptInputActionMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputActionMenuTrigger: () => <button type="button">actions</button>,
  PromptInputFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PromptInputSubmit: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  PromptInputTextarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
  PromptInputTools: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("../../../components/ai-elements/chain-of-thought", () => ({
  ChainOfThoughtSection: ({
    entry,
  }: {
    entry: { steps: Array<{ label: string }> }
  }) => <div>thought:{entry.steps.map((step) => step.label).join("|")}</div>,
}))

vi.mock("../../../components/ai-elements/sources", () => ({
  CitationAnchor: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  CitationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  prepareCitationMarkdown: (text: string) => text,
  SourcesList: ({ sources }: { sources: Array<{ id?: string }> }) => (
    <div>sources:{sources.length}</div>
  ),
}))

vi.mock("../../../components/ai-elements/context-usage", () => ({
  ContextUsageIndicator: () => <div>context-usage</div>,
}))

vi.mock("../../../components/ai-elements/task-queue", () => ({
  QueueSection: ({ title }: { title?: string }) => <div>queue:{title ?? "untitled"}</div>,
  TaskListSection: ({ title }: { title?: string }) => <div>task:{title ?? "untitled"}</div>,
}))

vi.mock("../../../components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("../../../components/ui/shimmer", () => ({
  Shimmer: () => <div>shimmer</div>,
}))

vi.mock("../components/prompt-input-attachments-preview", () => ({
  PromptInputAttachmentsPreview: () => <div>attachment-preview</div>,
}))

const createMessage = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: "msg-default",
  role: "assistant",
  content: "content",
  parts: [{ type: "text", text: "content" }],
  ...overrides,
})

const createBaseProps = () => ({
  isTranscriptLoading: false,
  messages: [] as ChatMessage[],
  copiedMessageId: null,
  isChatStreaming: false,
  isAwaitingFirstToken: false,
  restoringCheckpoints: {},
  emptyStateSuggestions: ["Suggest A", "Suggest B"],
  promptDisabled: false,
  promptValue: "hello",
  modelOptions: [{ id: "openai/gpt-5", label: "gpt-5" }],
  selectedModel: "openai/gpt-5",
  isUpdatingModel: false,
  contextUsage: undefined,
  updateModelError: null,
  chatError: null,
  restoreCheckpointError: null,
  onSuggestionClick: vi.fn(),
  onPromptSubmit: vi.fn(async () => {}),
  onPromptChange: vi.fn(),
  onUpdateSessionModel: vi.fn(async () => {}),
  onCopyMessage: vi.fn(async () => {}),
  onRetryMessage: vi.fn(),
  onRestoreCheckpoint: vi.fn(async () => {}),
})

describe("ChatView", () => {
  it("renders transcript loading state", () => {
    const props = createBaseProps()
    render(<ChatView {...props} isTranscriptLoading />)

    expect(screen.getByText("Loading transcript...")).toBeInTheDocument()
  })

  it("renders empty state and wires suggestion + submit actions", () => {
    const props = createBaseProps()
    render(<ChatView {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "Suggest A" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Send" })[0])

    expect(props.onSuggestionClick).toHaveBeenCalledWith("Suggest A")
    expect(props.onPromptSubmit).toHaveBeenCalled()
    expect(screen.getByText("No messages yet")).toBeInTheDocument()
  })

  it("renders message content branches and interaction controls", () => {
    const props = createBaseProps()

    const userMessage = createMessage({
      id: "user-1",
      role: "user",
      content: "How do we refactor this?",
      parts: [{ type: "text", text: "How do we refactor this?" }],
    })

    const assistantMessage = createMessage({
      id: "assistant-1",
      role: "assistant",
      content: "Use extracted modules.",
      parts: [
        { type: "text", text: "Use extracted modules." },
        {
          type: "file",
          file: {
            id: "file-1",
            name: "plan.md",
            path: "/tmp/plan.md",
            source: "upload",
          },
        },
        { type: "reasoning", text: "Because cohesion improves." },
        {
          type: "sources",
          sources: [{ id: "src-1", title: "Doc", url: "https://example.com" }],
        },
        {
          id: "checkpoint-1",
          type: "data-checkpoint",
          label: "Checkpoint",
          data: {
            restore: {
              messageId: "assistant-1",
              partId: "checkpoint-1",
              url: "/restore",
            },
          },
        },
        {
          id: "plan-1",
          type: "data-plan",
          data: {
            title: "Execution plan",
            steps: ["Extract logic"],
          },
        },
        {
          id: "task-1",
          type: "data-task",
          data: {
            title: "Tasks",
            items: ["Write tests"],
          },
        },
        {
          id: "queue-1",
          type: "data-queue",
          data: {
            title: "Queue",
            items: ["Run CI"],
            total: 1,
          },
        },
      ],
      metadata: {
        branches: ["Alternative branch response"],
      },
    })

    render(
      <ChatView
        {...props}
        messages={[userMessage, assistantMessage]}
        contextUsage={{ inputTokens: 1, outputTokens: 2, totalTokens: 3, source: "metadata" }}
        updateModelError="Model update failed"
        chatError="Chat failed"
        restoreCheckpointError="Restore failed"
      />
    )

    fireEvent.click(screen.getAllByLabelText("Copy message")[1])
    fireEvent.click(screen.getByLabelText("Retry"))
    fireEvent.click(screen.getByRole("button", { name: "checkpoint:Checkpoint" }))
    fireEvent.click(screen.getByRole("button", { name: "select-model" }))

    expect(props.onCopyMessage).toHaveBeenCalledWith("assistant-1", "Use extracted modules.")
    expect(props.onRetryMessage).toHaveBeenCalledWith(1)
    expect(props.onRestoreCheckpoint).toHaveBeenCalled()
    expect(props.onUpdateSessionModel).toHaveBeenCalledWith("openai/gpt-5")

    expect(screen.getByText("attachments:plan.md")).toBeInTheDocument()
    expect(screen.getByText("thought:Reasoning")).toBeInTheDocument()
    expect(screen.getByText("plan:Execution plan")).toBeInTheDocument()
    expect(screen.getByText("task:Tasks")).toBeInTheDocument()
    expect(screen.getByText("queue:Queue")).toBeInTheDocument()
    expect(screen.getByText("context-usage")).toBeInTheDocument()
    expect(screen.getByText("Model update failed")).toBeInTheDocument()
    expect(screen.getByText("Chat failed")).toBeInTheDocument()
    expect(screen.getByText("Restore failed")).toBeInTheDocument()
  })
})
