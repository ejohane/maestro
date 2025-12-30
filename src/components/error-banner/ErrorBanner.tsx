"use client"

import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  retryLabel?: string
}

export function ErrorBanner({ message, onRetry, onDismiss, retryLabel = "Retry" }: ErrorBannerProps) {
  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm">
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">{message}</span>
        </div>
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
