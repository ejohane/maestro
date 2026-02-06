import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PromptInputAttachmentsPreview } from "./prompt-input-attachments-preview"

const attachmentsState: {
  files: Array<{
    id: string
    filename: string
    url: string
    mediaType?: string
    size?: number
  }>
  remove: (id: string) => void
} = {
  files: [],
  remove: vi.fn(),
}

vi.mock("../../../components/ai-elements/prompt-input", () => ({
  PromptInputHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="prompt-header" data-class={className}>
      {children}
    </div>
  ),
  usePromptInputAttachments: () => attachmentsState,
}))

vi.mock("../../../components/ai-elements/message", () => ({
  MessageAttachments: ({
    attachments,
    onRemove,
  }: {
    attachments: Array<{ id: string; name: string }>
    onRemove?: (id: string) => void
  }) => (
    <div data-testid="message-attachments">
      {attachments.map((attachment) => (
        <button key={attachment.id} onClick={() => onRemove?.(attachment.id)}>
          {attachment.name}
        </button>
      ))}
    </div>
  ),
}))

describe("PromptInputAttachmentsPreview", () => {
  it("renders nothing when there are no attachments", () => {
    attachmentsState.files = []
    attachmentsState.remove = vi.fn()

    const { container } = render(<PromptInputAttachmentsPreview />)

    expect(container.firstChild).toBeNull()
  })

  it("maps attachment metadata and forwards remove callbacks", () => {
    const remove = vi.fn()
    attachmentsState.files = [
      {
        id: "file-1",
        filename: "notes.md",
        url: "/tmp/notes.md",
        mediaType: "text/markdown",
        size: 42,
      },
    ]
    attachmentsState.remove = remove

    render(<PromptInputAttachmentsPreview />)

    expect(screen.getByTestId("prompt-header")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "notes.md" }))
    expect(remove).toHaveBeenCalledWith("file-1")
  })
})
