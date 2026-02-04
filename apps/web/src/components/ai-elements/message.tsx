import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { ComponentProps, HTMLAttributes, ReactElement } from "react"
import { createContext, memo, useContext, useEffect, useState } from "react"
import { Streamdown } from "streamdown"
import { FileImage, FileText, X } from "lucide-react"

import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"

import { cn } from "../../lib/utils"
import type { MessageRole } from "@maestro/core"
import { Avatar, AvatarFallback } from "../ui/avatar"
import { Button } from "../ui/button"
import { ButtonGroup, ButtonGroupText } from "../ui/button-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole
}

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  from: MessageRole
  fallback?: string
}

export const MessageAvatar = ({
  from,
  fallback,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("h-8 w-8 border", className)} {...props}>
    <AvatarFallback
      className={cn(
        "text-xs font-semibold",
        from === "user" ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
      )}
    >
      {fallback ?? (from === "user" ? "ME" : from === "system" ? "SYS" : "AI")}
    </AvatarFallback>
  </Avatar>
)

export const Message = ({ className, from, children, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-start gap-3",
      from === "user" ? "is-user flex-row-reverse text-right" : "is-assistant",
      className
    )}
    {...props}
  >
    <MessageAvatar from={from} />
    <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
  </div>
)

export type MessageContentProps = HTMLAttributes<HTMLDivElement>

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-2xl group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground group-[.is-assistant]:leading-relaxed",
      className
    )}
    {...props}
  >
    {children}
  </div>
)

export type MessageActionsProps = ComponentProps<"div">

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
)

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string
  label?: string
}

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}

interface MessageBranchContextType {
  currentBranch: number
  totalBranches: number
  goToPrevious: () => void
  goToNext: () => void
  branches: ReactElement[]
  setBranches: (branches: ReactElement[]) => void
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(null)

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext)

  if (!context) {
    throw new Error("MessageBranch components must be used within MessageBranch")
  }

  return context
}

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number
  onBranchChange?: (branchIndex: number) => void
}

export const MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch)
  const [branches, setBranches] = useState<ReactElement[]>([])

  const handleBranchChange = (newBranch: number) => {
    setCurrentBranch(newBranch)
    onBranchChange?.(newBranch)
  }

  const goToPrevious = () => {
    const newBranch = currentBranch > 0 ? currentBranch - 1 : branches.length - 1
    handleBranchChange(newBranch)
  }

  const goToNext = () => {
    const newBranch = currentBranch < branches.length - 1 ? currentBranch + 1 : 0
    handleBranchChange(newBranch)
  }

  const contextValue: MessageBranchContextType = {
    currentBranch,
    totalBranches: branches.length,
    goToPrevious,
    goToNext,
    branches,
    setBranches,
  }

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div className={cn("grid w-full gap-2 [&>div]:pb-0", className)} {...props} />
    </MessageBranchContext.Provider>
  )
}

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>

export const MessageBranchContent = ({
  children,
  ...props
}: MessageBranchContentProps) => {
  const { currentBranch, setBranches, branches } = useMessageBranch()
  const childrenArray = Array.isArray(children) ? children : [children]

  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray)
    }
  }, [childrenArray, branches, setBranches])

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden"
      )}
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ))
}

export type MessageBranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole
}

export const MessageBranchSelector = ({
  className,
  from,
  ...props
}: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch()

  if (totalBranches <= 1) {
    return null
  }

  return (
    <ButtonGroup
      className="[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md"
      orientation="horizontal"
      {...props}
    />
  )
}

export type MessageBranchPreviousProps = ComponentProps<typeof Button>

export const MessageBranchPrevious = ({
  children,
  ...props
}: MessageBranchPreviousProps) => {
  const { goToPrevious, totalBranches } = useMessageBranch()

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  )
}

export type MessageBranchNextProps = ComponentProps<typeof Button>

export const MessageBranchNext = ({ children, ...props }: MessageBranchNextProps) => {
  const { goToNext, totalBranches } = useMessageBranch()

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  )
}

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>

export const MessageBranchPage = ({ className, ...props }: MessageBranchPageProps) => {
  const { currentBranch, totalBranches } = useMessageBranch()

  return (
    <ButtonGroupText
      className={cn("border-none bg-transparent text-muted-foreground shadow-none", className)}
      {...props}
    >
      {currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  )
}

export type MessageResponseProps = ComponentProps<typeof Streamdown>

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      plugins={{ code, mermaid, math, cjk }}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

MessageResponse.displayName = "MessageResponse"

export type MessageToolbarProps = ComponentProps<"div">

export const MessageToolbar = ({
  className,
  children,
  ...props
}: MessageToolbarProps) => (
  <div
    className={cn("mt-4 flex w-full items-center justify-between gap-4", className)}
    {...props}
  >
    {children}
  </div>
)

export type MessageCheckpointProps = HTMLAttributes<HTMLDivElement> & {
  label: string
  description?: string
  status?: string
  timestamp?: string
  onRestore?: () => void
  restoreLabel?: string
  isRestoring?: boolean
  restoreDisabled?: boolean
}

export const MessageCheckpoint = ({
  label,
  description,
  status,
  timestamp,
  onRestore,
  restoreLabel,
  isRestoring,
  restoreDisabled,
  className,
  ...props
}: MessageCheckpointProps) => {
  const showRestore = typeof onRestore === "function"
  const restoreText = isRestoring ? "Restoring..." : restoreLabel ?? "Restore"

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" aria-hidden="true" />
      <span className="font-medium text-foreground">{label}</span>
      {status ? <span className="text-[10px] uppercase tracking-[0.2em]">{status}</span> : null}
      {timestamp ? <span className="text-[10px]">{timestamp}</span> : null}
      {description ? <span>{description}</span> : null}
      {showRestore ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={onRestore}
          disabled={Boolean(restoreDisabled || isRestoring)}
          aria-label={isRestoring ? "Restoring checkpoint" : "Restore checkpoint"}
        >
          {restoreText}
        </Button>
      ) : null}
    </div>
  )
}

type MessageAttachmentMeta = {
  id: string
  name?: string
  path?: string
  mimeType?: string
  size?: number
  source?: "upload" | "workspace" | "tool" | "generated"
}

export type MessageAttachmentsProps = HTMLAttributes<HTMLDivElement> & {
  attachments: MessageAttachmentMeta[]
  onRemove?: (id: string) => void
}

const isImageType = (mimeType?: string, name?: string) => {
  if (mimeType?.startsWith("image/")) {
    return true
  }
  const extension = name?.split(".").pop()?.toLowerCase()
  if (!extension) {
    return false
  }
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension)
}

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) {
    return undefined
  }
  const units = ["B", "KB", "MB", "GB"]
  let current = size
  let unitIndex = 0
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }
  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const getAttachmentLabel = (attachment: MessageAttachmentMeta, index: number) => {
  if (attachment.name?.trim()) {
    return attachment.name
  }
  if (attachment.path) {
    const segments = attachment.path.split("/")
    const last = segments[segments.length - 1]
    if (last) {
      return last
    }
  }
  return `Attachment ${index + 1}`
}

export const MessageAttachments = ({
  attachments,
  onRemove,
  className,
  ...props
}: MessageAttachmentsProps) => {
  if (!attachments.length) {
    return null
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("grid gap-2 sm:grid-cols-2", className)} {...props}>
        {attachments.map((attachment, index) => {
          const label = getAttachmentLabel(attachment, index)
          const isImage = isImageType(attachment.mimeType, attachment.name)
          const previewUrl = attachment.path
          const canPreview = isImage && typeof previewUrl === "string"
          const sizeLabel = formatFileSize(attachment.size)

          const card = (
            <div className="group relative flex min-w-0 items-center gap-3 rounded-xl border bg-muted/20 p-2">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
                {canPreview ? (
                  <img
                    alt={label}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={previewUrl}
                  />
                ) : isImage ? (
                  <FileImage className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <FileText className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{label}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {attachment.mimeType ? <span>{attachment.mimeType}</span> : null}
                  {sizeLabel ? <span>{sizeLabel}</span> : null}
                  {attachment.source ? <span className="capitalize">{attachment.source}</span> : null}
                </div>
              </div>
              {onRemove ? (
                <Button
                  aria-label={`Remove ${label}`}
                  className="absolute right-1 top-1 h-7 w-7 rounded-full bg-background/80 text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100"
                  onClick={() => onRemove(attachment.id)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          )

          return (
            <Tooltip key={attachment.id}>
              <TooltipTrigger asChild>{card}</TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {canPreview ? (
                  <div className="grid gap-2">
                    <img
                      alt={label}
                      className="h-40 w-40 rounded-md object-cover"
                      loading="lazy"
                      src={previewUrl}
                    />
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ) : (
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{label}</span>
                    {attachment.mimeType ? <span>{attachment.mimeType}</span> : null}
                    {sizeLabel ? <span>{sizeLabel}</span> : null}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
