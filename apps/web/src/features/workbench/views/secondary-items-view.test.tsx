import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SecondaryItemsView } from "./secondary-items-view"

describe("SecondaryItemsView", () => {
  it("renders provided items", () => {
    render(<SecondaryItemsView title="Projects" items={["A", "B"]} />)

    expect(screen.getByText("Projects")).toBeInTheDocument()
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("B")).toBeInTheDocument()
  })

  it("renders empty state when no items exist", () => {
    render(<SecondaryItemsView title="Workspaces" items={[]} />)

    expect(screen.getByText("Nothing to show yet.")).toBeInTheDocument()
  })
})
