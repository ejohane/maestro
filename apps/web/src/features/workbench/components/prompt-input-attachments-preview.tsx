import {
  PromptInputHeader,
  usePromptInputAttachments,
} from "../../../components/ai-elements/prompt-input"
import { MessageAttachments } from "../../../components/ai-elements/message"

export const PromptInputAttachmentsPreview = () => {
  const attachments = usePromptInputAttachments()

  if (!attachments.files.length) {
    return null
  }

  const items = attachments.files.map((file) => ({
    id: file.id,
    name: file.filename,
    path: file.url,
    mimeType: file.mediaType,
    size: file.size,
    source: "upload" as const,
  }))

  return (
    <PromptInputHeader className="text-foreground">
      <MessageAttachments attachments={items} onRemove={attachments.remove} />
    </PromptInputHeader>
  )
}
