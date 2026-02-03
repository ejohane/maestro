import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon } from "lucide-react"

import type { SourceCitation } from "@maestro/core"

import { cn } from "../../lib/utils"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card"

type NormalizedCitation = SourceCitation & {
  id: string
  index: number
}

type CitationContextValue = {
  citations: NormalizedCitation[]
  byId: Map<string, NormalizedCitation>
}

const CitationContext = createContext<CitationContextValue | null>(null)

const normalizeSources = (sources: SourceCitation[]): NormalizedCitation[] =>
  sources.map((source, index) => ({
    ...source,
    id: source.id?.trim() || `source-${index + 1}`,
    index,
  }))

const buildCitationContext = (sources: SourceCitation[]): CitationContextValue => {
  const citations = normalizeSources(sources)
  const byId = new Map(citations.map((source) => [source.id, source]))
  return { citations, byId }
}

export const CitationProvider = ({
  sources,
  children,
}: {
  sources: SourceCitation[]
  children: ReactNode
}) => {
  const value = useMemo(() => buildCitationContext(sources), [sources])
  return <CitationContext.Provider value={value}>{children}</CitationContext.Provider>
}

const useCitations = () => useContext(CitationContext)

const parseCitationId = (value: string, context?: CitationContextValue | null) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (context?.byId.has(trimmed)) {
    return trimmed
  }
  const numeric = Number.parseInt(trimmed, 10)
  if (!Number.isNaN(numeric) && numeric > 0) {
    const index = numeric - 1
    return context?.citations[index]?.id ?? trimmed
  }
  const match = trimmed.match(/^source-(\d+)$/)
  if (match) {
    const index = Number.parseInt(match[1], 10) - 1
    return context?.citations[index]?.id ?? trimmed
  }
  return trimmed
}

const splitCitationIds = (value: string, context?: CitationContextValue | null) => {
  const candidates = value.split(/[,|]/).map((entry) => entry.trim())
  const resolved = candidates
    .map((entry) => parseCitationId(entry, context))
    .filter((entry): entry is string => Boolean(entry))
  return Array.from(new Set(resolved))
}

const formatCitationLabel = (ids: string[], context?: CitationContextValue | null) => {
  if (!ids.length) {
    return "?"
  }
  if (!context?.citations.length) {
    return ids.join(",")
  }
  const labels = ids.map((id) => {
    const entry = context.byId.get(id)
    if (!entry) {
      return id
    }
    return String(entry.index + 1)
  })
  return labels.join(",")
}

const formatSourceTitle = (source: SourceCitation, index: number) =>
  source.title?.trim() || source.url?.trim() || `Source ${index + 1}`

const CitationBadge = ({ label, className }: { label: string; className?: string }) => (
  <span
    className={cn(
      "inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full border bg-muted/30 px-1 text-[10px] font-semibold text-muted-foreground",
      className
    )}
  >
    [{label}]
  </span>
)

export const InlineCitation = ({
  ids,
  className,
}: {
  ids: string[]
  className?: string
}) => {
  const context = useCitations()
  const resolvedIds = useMemo(() => splitCitationIds(ids.join(","), context), [ids, context])
  const entries = useMemo(
    () =>
      resolvedIds
        .map((id) => context?.byId.get(id))
        .filter((entry): entry is NormalizedCitation => Boolean(entry)),
    [context, resolvedIds]
  )
  const label = formatCitationLabel(resolvedIds, context)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeEntry = entries[activeIndex]

  useEffect(() => {
    setActiveIndex(0)
  }, [resolvedIds.join("|")])

  if (!entries.length || !activeEntry) {
    return <CitationBadge label={label} className={className} />
  }

  const isMultiple = entries.length > 1
  const handlePrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? entries.length - 1 : prev - 1))
  }
  const handleNext = () => {
    setActiveIndex((prev) => (prev === entries.length - 1 ? 0 : prev + 1))
  }

  return (
    <HoverCard openDelay={200} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex align-super focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
          )}
          aria-label={`View citation ${label}`}
        >
          <CitationBadge label={label} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-[320px]">
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Source {activeEntry.index + 1}
            </div>
            {isMultiple ? (
              <div className="flex items-center gap-1">
                <Button
                  aria-label="Previous citation"
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                  onClick={handlePrevious}
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {activeIndex + 1} / {entries.length}
                </span>
                <Button
                  aria-label="Next citation"
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                  onClick={handleNext}
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
          <div className="text-sm font-semibold text-foreground">
            {formatSourceTitle(activeEntry, activeEntry.index)}
          </div>
          {activeEntry.locator ? (
            <div className="text-xs text-muted-foreground">{activeEntry.locator}</div>
          ) : null}
          {activeEntry.snippet ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{activeEntry.snippet}</p>
          ) : null}
          {activeEntry.url ? (
            <a
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              href={activeEntry.url}
              target="_blank"
              rel="noreferrer"
            >
              Open source <ExternalLinkIcon className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export const CitationAnchor = ({
  href,
  children,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const context = useCitations()
  if (href) {
    const normalized = href.trim()
    const isCitation =
      normalized.startsWith("citation:") ||
      normalized.startsWith("cite:") ||
      normalized.startsWith("source:")
    if (isCitation) {
      const raw = normalized.replace(/^(citation|cite|source):/, "")
      const ids = splitCitationIds(raw, context)
      return <InlineCitation ids={ids} className={className} />
    }
  }
  return (
    <a className={className} href={href} {...props}>
      {children}
    </a>
  )
}

export const prepareCitationMarkdown = (
  text: string,
  sources: SourceCitation[]
): string => {
  if (!text) {
    return text
  }
  if (!sources.length) {
    return text
  }
  const context = buildCitationContext(sources)
  return text.replace(/\[\^([^\]]+)\]/g, (match, raw) => {
    const ids = splitCitationIds(String(raw), context)
    if (!ids.length) {
      return match
    }
    const label = formatCitationLabel(ids, context)
    return `[${label}](citation:${ids.join(",")})`
  })
}

export const SourcesList = ({
  sources,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { sources: SourceCitation[] }) => {
  const normalized = useMemo(() => normalizeSources(sources), [sources])

  if (!normalized.length) {
    return null
  }

  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border bg-muted/10 p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Sources
        </div>
        <Badge variant="secondary">{normalized.length}</Badge>
      </div>
      <ol className="grid gap-3">
        {normalized.map((source) => {
          const title = formatSourceTitle(source, source.index)
          return (
            <li
              key={source.id}
              className="rounded-lg border bg-background/80 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-muted/30 text-xs font-semibold text-muted-foreground">
                  {source.index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{title}</span>
                    {source.url ? (
                      <a
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  {source.locator ? (
                    <div className="text-xs text-muted-foreground">
                      {source.locator}
                    </div>
                  ) : null}
                  {source.snippet ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {source.snippet}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
