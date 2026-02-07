import { describe, expect, it } from "vitest"

import {
  applyMessagePartUpdate,
  createClientMessage,
  type StructuredMessagePart,
} from "./messages"

describe("message part merge behavior", () => {
  it("prefers delta over incoming text on first streamed chunk", () => {
    const message = createClientMessage({
      id: "assistant-1",
      role: "assistant",
      content: "",
      parts: [],
      isStreaming: true,
    })

    const updated = applyMessagePartUpdate(
      message,
      {
        type: "text",
        id: "part-1",
        text: "start refactoring.start refactoring. be sure to leverage skills",
      } as StructuredMessagePart,
      "start refactoring."
    )

    expect(updated.content).toBe("start refactoring.")
    expect(updated.parts).toMatchObject([
      { type: "text", id: "part-1", text: "start refactoring." },
    ])
  })

  it("keeps appending deltas when incoming text does not match existing prefix", () => {
    const message = createClientMessage({
      id: "assistant-1",
      role: "assistant",
      content: "Yes",
      parts: [{ type: "text", id: "part-1", text: "Yes" }],
      isStreaming: true,
    })

    const updated = applyMessagePartUpdate(
      message,
      {
        type: "text",
        id: "part-1",
        text: "look at App.tsx - it has way too much logic, would you agree?Yes --",
      } as StructuredMessagePart,
      " --"
    )

    expect(updated.content).toBe("Yes --")
    expect(updated.parts).toMatchObject([{ type: "text", id: "part-1", text: "Yes --" }])
  })

  it("accepts cumulative incoming text when it extends the same prefix", () => {
    const message = createClientMessage({
      id: "assistant-1",
      role: "assistant",
      content: "Yes",
      parts: [{ type: "text", id: "part-1", text: "Yes" }],
      isStreaming: true,
    })

    const updated = applyMessagePartUpdate(
      message,
      { type: "text", id: "part-1", text: "Yes -- apps/web/src/App.tsx" },
      " -- apps/web/src/App.tsx"
    )

    expect(updated.content).toBe("Yes -- apps/web/src/App.tsx")
    expect(updated.parts).toMatchObject([
      { type: "text", id: "part-1", text: "Yes -- apps/web/src/App.tsx" },
    ])
  })
})
