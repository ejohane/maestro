/**
 * Error handling utilities for the planning mode feature.
 * Provides user-friendly error messages, retry logic with exponential backoff,
 * and health check utilities.
 */

/**
 * Pattern definitions for translating technical error messages to user-friendly ones.
 */
const ERROR_PATTERNS: Array<{ match: RegExp; message: string }> = [
  { match: /ENOENT/, message: "File or directory not found" },
  { match: /EACCES/, message: "Permission denied" },
  { match: /ENOSPC/, message: "Disk is full" },
  { match: /ETIMEDOUT/, message: "Connection timed out" },
  { match: /ECONNREFUSED/, message: "Connection refused" },
  { match: /ECONNRESET/, message: "Connection was reset" },
  { match: /ENOTFOUND/, message: "Server not found" },
  { match: /branch.*already exists/i, message: "Branch already exists" },
  { match: /bun install.*failed/i, message: "Failed to install dependencies" },
  { match: /npm install.*failed/i, message: "Failed to install dependencies" },
  { match: /worktree.*already exists/i, message: "Worktree already exists" },
  { match: /not a git repository/i, message: "Not a git repository" },
  { match: /uncommitted changes/i, message: "Uncommitted changes detected" },
  { match: /merge conflict/i, message: "Merge conflict detected" },
  { match: /fetch failed/i, message: "Network request failed" },
  { match: /aborted/i, message: "Operation was cancelled" },
  { match: /opencode.*not.*running/i, message: "OpenCode is not running" },
  { match: /session.*not.*found/i, message: "Session not found" },
  { match: /invalid.*session/i, message: "Invalid session" },
]

/**
 * Translates a technical error message to a user-friendly message.
 *
 * @param error - The error to translate
 * @returns A user-friendly error message
 */
export function getUserFriendlyMessage(error: Error): string {
  const errorMessage = error.message

  for (const { match, message } of ERROR_PATTERNS) {
    if (match.test(errorMessage)) {
      return message
    }
  }

  // Return the original message if no pattern matches
  // but strip any stack traces or overly technical details
  const cleanMessage = errorMessage.split("\n")[0].trim()
  return cleanMessage || "An unknown error occurred"
}

/**
 * Options for the retry utility.
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number
  /** Initial backoff delay in milliseconds (default: 1000) */
  backoff?: number
  /** Maximum backoff delay in milliseconds (default: 30000) */
  maxBackoff?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Optional callback called before each retry attempt */
  onRetry?: (attempt: number, error: Error, nextDelay: number) => void
  /** Optional function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean
}

/**
 * Default function to check if an error is retryable.
 * Network errors and transient failures are generally retryable.
 */
function defaultIsRetryable(error: Error): boolean {
  const message = error.message

  // Non-retryable errors
  const nonRetryablePatterns = [
    /permission denied/i,
    /EACCES/i,
    /not found/i,
    /ENOENT/i,
    /invalid/i,
    /already exists/i,
    /unauthorized/i,
    /forbidden/i,
  ]

  for (const pattern of nonRetryablePatterns) {
    if (pattern.test(message)) {
      return false
    }
  }

  // Retryable errors (network issues, timeouts, etc.)
  const retryablePatterns = [
    /timeout/i,
    /ETIMEDOUT/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /network/i,
    /fetch failed/i,
    /503/,
    /502/,
    /500/,
    /temporarily unavailable/i,
  ]

  for (const pattern of retryablePatterns) {
    if (pattern.test(message)) {
      return true
    }
  }

  // Default to not retrying for unknown errors
  return false
}

/**
 * Executes an async function with automatic retry and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('/api/data'),
 *   { maxAttempts: 3, backoff: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    backoff = 1000,
    maxBackoff = 30000,
    backoffMultiplier = 2,
    onRetry,
    isRetryable = defaultIsRetryable,
  } = options

  let lastError: Error | null = null
  let currentDelay = backoff

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry
      const isLastAttempt = attempt === maxAttempts
      const shouldRetry = !isLastAttempt && isRetryable(lastError)

      if (!shouldRetry) {
        throw lastError
      }

      // Calculate next delay with exponential backoff
      const nextDelay = Math.min(currentDelay, maxBackoff)

      // Notify callback if provided
      if (onRetry) {
        onRetry(attempt, lastError, nextDelay)
      }

      // Wait before retrying
      await sleep(nextDelay)

      // Increase delay for next attempt
      currentDelay = currentDelay * backoffMultiplier
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error("Retry failed with no error")
}

/**
 * Utility function to sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Result of an OpenCode health check.
 */
export interface HealthCheckResult {
  /** Whether OpenCode is healthy and responding */
  ok: boolean
  /** Error message if not healthy */
  error?: string
  /** OpenCode server URL if available */
  url?: string
}

/**
 * Checks if the OpenCode server is healthy and responding.
 * This calls the `/api/health/opencode` endpoint to verify connectivity.
 *
 * @returns Health check result with status and any error message
 *
 * @example
 * ```typescript
 * const health = await checkOpenCodeHealth();
 * if (!health.ok) {
 *   console.error('OpenCode is not available:', health.error);
 * }
 * ```
 */
export async function checkOpenCodeHealth(): Promise<HealthCheckResult> {
  try {
    const response = await fetch("/api/health/opencode", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const data = await response.json()

    if (response.ok && data.status === "healthy") {
      return {
        ok: true,
        url: data.url,
      }
    }

    return {
      ok: false,
      error: data.error || "OpenCode server is not responding",
      url: data.url,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check OpenCode health"

    return {
      ok: false,
      error: message,
    }
  }
}

/**
 * Wraps an async function to automatically handle and log errors.
 *
 * @param fn - The async function to wrap
 * @param context - Optional context string for error logging
 * @returns A wrapped function that catches and re-throws errors with context
 */
export function withErrorContext<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  context: string
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    try {
      return await fn(...args)
    } catch (error) {
      const originalError =
        error instanceof Error ? error : new Error(String(error))
      const contextualError = new Error(
        `${context}: ${getUserFriendlyMessage(originalError)}`
      )
      // Preserve the original stack trace
      contextualError.stack = originalError.stack
      throw contextualError
    }
  }
}
