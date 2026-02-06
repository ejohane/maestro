import { describe, expect, it } from "vitest"

import { formatDate, formatDateTime } from "./date-format"

describe("date-format", () => {
  it("returns Unknown for missing values", () => {
    expect(formatDate()).toBe("Unknown")
    expect(formatDateTime()).toBe("Unknown")
  })

  it("returns original value for invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date")
    expect(formatDateTime("not-a-date")).toBe("not-a-date")
  })

  it("formats valid dates", () => {
    expect(formatDate("2026-01-15T12:30:00Z")).toMatch(/2026|Jan|15/)
    expect(formatDateTime("2026-01-15T12:30:00Z")).toMatch(/Jan|15/)
  })
})
