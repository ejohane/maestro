"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Circle, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StepId = "create_worktree" | "install_deps" | "create_session" | "send_prompt"
type StepStatus = "pending" | "in_progress" | "completed" | "skipped" | "error"

interface StepState {
  id: StepId
  name: string
  status: StepStatus
  error?: string
  startTime?: number
  duration?: number
}

interface SetupProgressProps {
  projectId: string
  issueNumber: number
  issueTitle: string
  onComplete: (result: { sessionId: string; worktreePath: string }) => void
  onError: (error: { step: string; error: string }) => void
}

// Step definitions matching the API
const INITIAL_STEPS: StepState[] = [
  { id: "create_worktree", name: "Creating git worktree", status: "pending" },
  { id: "install_deps", name: "Installing dependencies", status: "pending" },
  { id: "create_session", name: "Starting AI session", status: "pending" },
  { id: "send_prompt", name: "Analyzing issue", status: "pending" },
]

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "pending":
      return <Circle className="h-4 w-4 text-muted-foreground" />
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />
    case "completed":
    case "skipped":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />
  }
}

function formatDuration(ms: number): string {
  return `(${(ms / 1000).toFixed(1)}s)`
}

export function SetupProgress({
  projectId,
  issueNumber,
  issueTitle,
  onComplete,
  onError,
}: SetupProgressProps) {
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const stepStartTimesRef = useRef<Record<string, number>>({})

  const startPipeline = useCallback(async () => {
    // Reset state for retry
    setSteps(INITIAL_STEPS)
    setPipelineError(null)
    setIsRetrying(false)
    stepStartTimesRef.current = {}

    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const response = await fetch(
        `/api/projects/${projectId}/planning/${issueNumber}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueTitle }),
          signal,
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split("\n")
        buffer = lines.pop() || "" // Keep incomplete line in buffer

        let currentEvent = ""
        let currentData = ""

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6).trim()
          } else if (line === "" && currentEvent && currentData) {
            // End of event, process it
            try {
              const data = JSON.parse(currentData)

              if (currentEvent === "step") {
                const stepId = data.id as StepId
                const status = data.status as StepStatus

                // Track timing
                if (status === "in_progress") {
                  stepStartTimesRef.current[stepId] = Date.now()
                }

                setSteps((prev) =>
                  prev.map((step) => {
                    if (step.id === stepId) {
                      const startTime = stepStartTimesRef.current[stepId]
                      let duration: number | undefined
                      if (
                        (status === "completed" || status === "error") &&
                        startTime
                      ) {
                        duration = Date.now() - startTime
                      }
                      return {
                        ...step,
                        status,
                        name: data.name || step.name,
                        error: data.error,
                        duration,
                      }
                    }
                    return step
                  })
                )

                // If step errored, update error state
                if (status === "error") {
                  setPipelineError(data.error || "Step failed")
                  onError({
                    step: data.name || stepId,
                    error: data.error || "Step failed",
                  })
                }
              } else if (currentEvent === "complete") {
                onComplete({
                  sessionId: data.sessionId,
                  worktreePath: data.worktreePath,
                })
              } else if (currentEvent === "error") {
                setPipelineError(data.error || "Pipeline failed")
                onError({
                  step: "Pipeline",
                  error: data.error || "Pipeline failed",
                })
              }
            } catch {
              // Ignore JSON parse errors
            }

            currentEvent = ""
            currentData = ""
          }
        }
      }
    } catch (err) {
      if (signal.aborted) return // Ignore abort errors

      const message = err instanceof Error ? err.message : String(err)
      setPipelineError(message)
      onError({ step: "Connection", error: message })
    }
  }, [projectId, issueNumber, issueTitle, onComplete, onError])

  useEffect(() => {
    startPipeline()

    return () => {
      // Cleanup: abort any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    setIsRetrying(true)
    startPipeline()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Setting up planning environment...
      </p>

      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.id} className="space-y-1">
            <div className="flex items-center gap-3">
              <StepIcon status={step.status} />
              <span
                className={cn(
                  "text-sm",
                  step.status === "pending" && "text-muted-foreground",
                  step.status === "in_progress" && "text-foreground",
                  step.status === "completed" && "text-foreground",
                  step.status === "skipped" && "text-muted-foreground",
                  step.status === "error" && "text-destructive"
                )}
              >
                {step.name}
                {step.status === "in_progress" && "..."}
              </span>
              {step.status === "completed" && step.duration && (
                <span className="text-xs text-muted-foreground">
                  {formatDuration(step.duration)}
                </span>
              )}
              {step.status === "skipped" && (
                <span className="text-xs text-muted-foreground">(skipped)</span>
              )}
            </div>
            {step.status === "error" && step.error && (
              <p className="text-xs text-destructive ml-7 mt-1">{step.error}</p>
            )}
          </div>
        ))}
      </div>

      {pipelineError && (
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
