import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ChainOfThoughtSection } from "./chain-of-thought"

const entry = {
  durationSeconds: 1,
  steps: [
    {
      id: "step-1",
      label: "Using read",
      summary: "tool-calls",
      reasoning: "Inspecting files and reasoning about layout",
      status: "active" as const,
      tools: [],
    },
  ],
}

describe("ChainOfThoughtSection", () => {
  it("expands during streaming and collapses when streaming completes", async () => {
    const { rerender } = render(<ChainOfThoughtSection entry={entry} isStreaming />)

    expect(screen.getByText("Using read")).toBeInTheDocument()
    expect(screen.getByText("Thinking...")).toBeInTheDocument()

    rerender(<ChainOfThoughtSection entry={entry} isStreaming={false} />)

    expect(screen.getByText("Thought for 1s across 1 step")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Using read")).not.toBeInTheDocument()
    })
  })
})
