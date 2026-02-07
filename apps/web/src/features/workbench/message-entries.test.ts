import { describe, expect, it } from "vitest"

import type { StructuredMessagePart } from "../../lib/messages"
import {
  clampPercent,
  extractUsageFromMetadata,
  getChainOfThoughtEntry,
  getCheckpointMarkers,
  getMessageBranches,
  getPlanEntries,
  getQueueEntries,
  getSourcesFromParts,
  getTaskEntries,
  normalizePercent,
  parsePlanStep,
  parsePlanSteps,
  parseProgressValue,
  parseTaskItem,
  parseTaskItems,
  toTrimmedString,
} from "./message-entries"
import type { ChatMessage } from "./types"

const createMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
  id: "m-1",
  role: "assistant",
  content: "base",
  parts: [{ type: "text", text: "base" } as StructuredMessagePart],
  ...overrides,
})

describe("message-entries utilities", () => {
  it("trims strings and ignores non-strings", () => {
    expect(toTrimmedString("  hello  ")).toBe("hello")
    expect(toTrimmedString("   ")).toBeUndefined()
    expect(toTrimmedString(42)).toBeUndefined()
  })

  it("normalizes and clamps percents", () => {
    expect(normalizePercent(0.5)).toBe(50)
    expect(normalizePercent(35)).toBe(35)
    expect(clampPercent(120)).toBe(100)
    expect(clampPercent(-5)).toBe(0)
  })

  it("parses plan step from string", () => {
    expect(parsePlanStep("Ship feature", "plan-1", 0)).toEqual({
      id: "plan-1-step-0",
      title: "Ship feature",
    })
  })

  it("parses plan step from object and keeps metadata", () => {
    expect(
      parsePlanStep(
        {
          id: "step-a",
          title: "Draft",
          description: "First pass",
          items: ["a", "b"],
          status: "in_progress",
        },
        "plan-1",
        0
      )
    ).toEqual({
      id: "step-a",
      title: "Draft",
      description: "First pass",
      bullets: ["a", "b"],
      status: "in_progress",
    })
  })

  it("parses plan steps from array and single values", () => {
    expect(parsePlanSteps(["One", "Two"], "plan-2")).toHaveLength(2)
    expect(parsePlanSteps("One", "plan-3")).toHaveLength(1)
  })

  it("parses progress values from percent, fraction and decimal", () => {
    expect(parseProgressValue("75%")).toEqual({ value: 75, label: "75%" })
    expect(parseProgressValue("3/4")).toEqual({ value: 75, label: "3/4" })
    expect(parseProgressValue(0.25)).toEqual({ value: 25, label: "25%" })
  })

  it("parses nested progress records", () => {
    expect(parseProgressValue({ current: 2, total: 8 })).toEqual({
      value: 25,
      label: "2/8",
    })
    expect(parseProgressValue({ progress: "40%" })).toEqual({
      value: 40,
      label: "40%",
    })
  })

  it("parses task items from object", () => {
    expect(
      parseTaskItem(
        {
          id: "task-1",
          title: "Run tests",
          description: "Unit + integration",
          done: true,
          progress: "100%",
        },
        "task",
        0
      )
    ).toEqual({
      id: "task-1",
      title: "Run tests",
      description: "Unit + integration",
      status: "Done",
      progress: 100,
      progressLabel: "100%",
    })
  })

  it("parses task items from strings and arrays", () => {
    expect(parseTaskItem("Write docs", "task", 1)).toEqual({
      id: "task-item-1",
      title: "Write docs",
    })
    expect(parseTaskItems(["A", "B"], "task-x")).toHaveLength(2)
  })

  it("extracts usage from metadata variants", () => {
    expect(
      extractUsageFromMetadata({
        usage_summary: {
          input_tokens: 11,
          output_tokens: "13",
          total_tokens: 24,
          cost_usd: "0.0002",
          model: "openai/gpt-5",
        },
      })
    ).toEqual({
      inputTokens: 11,
      outputTokens: 13,
      totalTokens: 24,
      costUsd: 0.0002,
      model: "openai/gpt-5",
      source: "metadata",
    })
  })

  it("returns null usage when no token data exists", () => {
    expect(extractUsageFromMetadata({ usage: { model: "x" } })).toBeNull()
    expect(extractUsageFromMetadata(undefined)).toBeNull()
  })

  it("collects source citations from message parts", () => {
    const sources = getSourcesFromParts([
      {
        type: "sources",
        sources: [{ id: "s1", title: "Doc", url: "https://example.com" }],
      } as unknown as StructuredMessagePart,
      { type: "text", text: "hello" } as StructuredMessagePart,
    ])

    expect(sources).toHaveLength(1)
    expect(sources[0]?.id).toBe("s1")
  })

  it("builds checkpoint markers with restore metadata", () => {
    const markers = getCheckpointMarkers(
      [
        {
          id: "checkpoint-1",
          type: "data-checkpoint",
          label: "Saved",
          data: {
            description: "Saved state",
            status: "ready",
            restore: {
              messageId: "m-1",
              partId: "p-1",
              method: "POST",
              url: "/restore",
              payload: { id: 1 },
            },
          },
        } as unknown as StructuredMessagePart,
      ],
      "m-1"
    )

    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({
      id: "checkpoint-1",
      label: "Saved",
      description: "Saved state",
      status: "ready",
      restore: {
        messageId: "m-1",
        partId: "p-1",
        method: "POST",
        url: "/restore",
      },
    })
  })

  it("builds plan, task, and queue entries from structured data", () => {
    const parts = [
      {
        id: "plan",
        type: "data-plan",
        data: {
          title: "Plan",
          steps: ["Step A", "Step B"],
          status: "running",
        },
      },
      {
        id: "task",
        type: "data-task",
        data: {
          title: "Tasks",
          items: ["Do one"],
          isStreaming: true,
        },
      },
      {
        id: "queue",
        type: "data-queue",
        data: {
          title: "Queue",
          items: ["Queued task"],
          total: 4,
        },
      },
    ] as unknown as StructuredMessagePart[]

    const plans = getPlanEntries(parts, "m")
    const tasks = getTaskEntries(parts, "m")
    const queues = getQueueEntries(parts, "m")

    expect(plans[0]?.steps).toHaveLength(2)
    expect(tasks[0]?.items).toHaveLength(1)
    expect(queues[0]?.totalCount).toBe(4)
  })

  it("builds chain-of-thought steps from step markers, reasoning, and tools", () => {
    const entry = getChainOfThoughtEntry(
      [
        {
          id: "step-start-1",
          type: "step-start",
          snapshot: "Inspect code",
        } as unknown as StructuredMessagePart,
        {
          id: "reasoning-1",
          type: "reasoning",
          text: "Looking at call sites.",
          time: { start: 1000, end: 1800 },
        } as unknown as StructuredMessagePart,
        {
          id: "tool-1",
          type: "tool",
          tool: "grep",
          callID: "call-1",
          state: {
            status: "completed",
            time: { start: 1800, end: 2600 },
          },
        } as unknown as StructuredMessagePart,
        {
          id: "step-finish-1",
          type: "step-finish",
          reason: "Collected enough evidence.",
        } as unknown as StructuredMessagePart,
      ],
      "m-thought",
      false
    )

    expect(entry).not.toBeNull()
    expect(entry?.durationSeconds).toBe(2)
    expect(entry?.steps).toHaveLength(1)
    expect(entry?.steps[0]).toMatchObject({
      label: "Inspect code",
      summary: "Collected enough evidence.",
      reasoning: "Looking at call sites.",
      status: "complete",
    })
    expect(entry?.steps[0]?.tools[0]).toMatchObject({
      name: "grep",
      callId: "call-1",
      status: "completed",
    })
  })

  it("keeps the latest implicit thought step active while streaming", () => {
    const entry = getChainOfThoughtEntry(
      [
        {
          id: "reasoning-stream",
          type: "reasoning",
          text: "Drafting a patch plan.",
        } as unknown as StructuredMessagePart,
        {
          id: "tool-stream",
          type: "tool",
          name: "bash",
          callId: "call-stream",
          status: "running",
        } as unknown as StructuredMessagePart,
      ],
      "m-stream",
      true
    )

    expect(entry).not.toBeNull()
    expect(entry?.steps).toHaveLength(1)
    expect(entry?.steps[0]?.status).toBe("active")
    expect(entry?.steps[0]?.label).toBe("Reasoning")
  })

  it("parses and deduplicates message branches", () => {
    const message = createMessage({
      id: "m-branch",
      content: "Base",
      metadata: {
        branches: [
          "Alternative A",
          { id: "branch-b", content: "Alternative B", label: "B" },
        ],
        branchIndex: 2,
      },
      parts: [{ type: "text", text: "Base" } as StructuredMessagePart],
    })

    const { branches, defaultBranch } = getMessageBranches(message, "Base", [])

    expect(branches).toHaveLength(3)
    expect(branches[0]?.id).toBe("m-branch-branch-base")
    expect(branches[1]?.content).toBe("Alternative A")
    expect(branches[2]?.id).toBe("branch-b")
    expect(defaultBranch).toBe(2)
  })

  it("ignores branch entries that match base content", () => {
    const message = createMessage({
      id: "m-dupe",
      content: "Same",
      metadata: { branches: ["Same", "Different"] },
      parts: [{ type: "text", text: "Same" } as StructuredMessagePart],
    })

    const { branches } = getMessageBranches(message, "Same", [])

    expect(branches.map((branch) => branch.content)).toEqual(["Same", "Different"])
  })

  it("parses branches from data branch payloads and skips empty entries", () => {
    const message = createMessage({
      id: "m-payload-branches",
      content: "Base",
      parts: [
        { type: "text", text: "Base" } as StructuredMessagePart,
        {
          type: "data-branch",
          data: {
            branches: [
              { content: "  " },
              42,
              { text: "From payload branch" },
            ],
          },
        } as unknown as StructuredMessagePart,
      ],
    })

    const { branches, defaultBranch } = getMessageBranches(message, "Base", [])

    expect(branches.map((branch) => branch.content)).toEqual(["Base", "From payload branch"])
    expect(defaultBranch).toBe(0)
  })
})
