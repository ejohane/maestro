import { describe, it, expect, vi, beforeEach, afterAll } from "vitest"
import {
  getUserFriendlyMessage,
  withRetry,
  checkOpenCodeHealth,
} from "./error-handling"

describe("getUserFriendlyMessage", () => {
  it("translates ENOENT to user-friendly message", () => {
    const error = new Error("ENOENT: no such file or directory")
    expect(getUserFriendlyMessage(error)).toBe("File or directory not found")
  })

  it("translates EACCES to user-friendly message", () => {
    const error = new Error("EACCES: permission denied")
    expect(getUserFriendlyMessage(error)).toBe("Permission denied")
  })

  it("translates ENOSPC to user-friendly message", () => {
    const error = new Error("ENOSPC: no space left on device")
    expect(getUserFriendlyMessage(error)).toBe("Disk is full")
  })

  it("translates ETIMEDOUT to user-friendly message", () => {
    const error = new Error("ETIMEDOUT: connection timed out")
    expect(getUserFriendlyMessage(error)).toBe("Connection timed out")
  })

  it("translates ECONNREFUSED to user-friendly message", () => {
    const error = new Error("ECONNREFUSED: connection refused")
    expect(getUserFriendlyMessage(error)).toBe("Connection refused")
  })

  it("translates branch already exists error", () => {
    const error = new Error("fatal: branch 'feature-123' already exists")
    expect(getUserFriendlyMessage(error)).toBe("Branch already exists")
  })

  it("translates bun install failed error", () => {
    const error = new Error("bun install failed with exit code 1")
    expect(getUserFriendlyMessage(error)).toBe("Failed to install dependencies")
  })

  it("translates npm install failed error", () => {
    const error = new Error("npm install failed")
    expect(getUserFriendlyMessage(error)).toBe("Failed to install dependencies")
  })

  it("translates worktree already exists error", () => {
    const error = new Error("worktree already exists at path")
    expect(getUserFriendlyMessage(error)).toBe("Worktree already exists")
  })

  it("translates not a git repository error", () => {
    const error = new Error("fatal: not a git repository")
    expect(getUserFriendlyMessage(error)).toBe("Not a git repository")
  })

  it("returns original message for unknown errors", () => {
    const error = new Error("Something unusual happened")
    expect(getUserFriendlyMessage(error)).toBe("Something unusual happened")
  })

  it("strips stack traces from error messages", () => {
    const error = new Error("Error message\n    at function (file.js:1:1)")
    expect(getUserFriendlyMessage(error)).toBe("Error message")
  })

  it("handles empty error messages", () => {
    const error = new Error("")
    expect(getUserFriendlyMessage(error)).toBe("An unknown error occurred")
  })
})

describe("withRetry", () => {
  it("returns result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success")

    const result = await withRetry(fn)

    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("throws immediately on non-retryable error (ENOENT)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ENOENT: file not found"))

    await expect(withRetry(fn, { maxAttempts: 3, backoff: 1 })).rejects.toThrow(
      "ENOENT"
    )

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("throws immediately on non-retryable error (permission denied)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Permission denied"))

    await expect(withRetry(fn, { maxAttempts: 3, backoff: 1 })).rejects.toThrow(
      "Permission denied"
    )

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("throws immediately on already exists error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Branch already exists"))

    await expect(withRetry(fn, { maxAttempts: 3, backoff: 1 })).rejects.toThrow(
      "already exists"
    )

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on retryable error (timeout) and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValue("success")

    const result = await withRetry(fn, { maxAttempts: 3, backoff: 1 })

    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("retries on 503 error and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValue("success")

    const result = await withRetry(fn, { maxAttempts: 3, backoff: 1 })

    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("throws after max attempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"))

    await expect(
      withRetry(fn, { maxAttempts: 3, backoff: 1 })
    ).rejects.toThrow("ETIMEDOUT")

    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("calls onRetry callback before each retry", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValue("success")

    const onRetry = vi.fn()

    const result = await withRetry(fn, {
      maxAttempts: 3,
      backoff: 1,
      onRetry,
    })

    expect(result).toBe("success")
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number))
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number))
  })

  it("uses custom isRetryable function", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("custom-error"))
      .mockResolvedValue("success")

    // Custom function that treats "custom-error" as retryable
    const isRetryable = vi.fn().mockReturnValue(true)

    const result = await withRetry(fn, {
      maxAttempts: 3,
      backoff: 1,
      isRetryable,
    })

    expect(result).toBe("success")
    expect(isRetryable).toHaveBeenCalledWith(expect.any(Error))
  })

  it("converts non-Error exceptions to Error objects", async () => {
    const fn = vi.fn().mockRejectedValue("string error")

    await expect(
      withRetry(fn, { maxAttempts: 1, backoff: 1 })
    ).rejects.toThrow("string error")
  })
})

describe("checkOpenCodeHealth", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it("returns ok when health check succeeds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "healthy",
          url: "http://localhost:4096",
        }),
    } as Response)

    const result = await checkOpenCodeHealth()

    expect(result).toEqual({
      ok: true,
      url: "http://localhost:4096",
    })
    expect(fetch).toHaveBeenCalledWith("/api/health/opencode", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
  })

  it("returns error when health check returns unhealthy", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          status: "unhealthy",
          error: "OpenCode server not responding",
        }),
    } as Response)

    const result = await checkOpenCodeHealth()

    expect(result).toEqual({
      ok: false,
      error: "OpenCode server not responding",
    })
  })

  it("returns error when response is ok but status is not healthy", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "degraded",
          url: "http://localhost:4096",
        }),
    } as Response)

    const result = await checkOpenCodeHealth()

    expect(result).toEqual({
      ok: false,
      error: "OpenCode server is not responding",
      url: "http://localhost:4096",
    })
  })

  it("returns error when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

    const result = await checkOpenCodeHealth()

    expect(result).toEqual({
      ok: false,
      error: "Network error",
    })
  })

  it("handles non-Error exceptions in fetch", async () => {
    global.fetch = vi.fn().mockRejectedValue("string error")

    const result = await checkOpenCodeHealth()

    expect(result).toEqual({
      ok: false,
      error: "Failed to check OpenCode health",
    })
  })
})
