"use client"

import { useEffect } from "react"
import { ErrorBanner } from "./ErrorBanner"
import { useError } from "@/lib/contexts/error-context"

export function GlobalErrorBanner() {
  const { errors, checkOpenCodeHealth, setOpenCodeError } = useError()

  // Check health on mount
  useEffect(() => {
    checkOpenCodeHealth()
  }, [checkOpenCodeHealth])

  if (!errors.opencodeError) return null

  return (
    <ErrorBanner
      message={errors.opencodeError}
      onRetry={checkOpenCodeHealth}
      onDismiss={() => setOpenCodeError(null)}
      retryLabel="Retry"
    />
  )
}
