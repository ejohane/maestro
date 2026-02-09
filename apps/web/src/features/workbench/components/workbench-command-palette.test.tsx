import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, afterEach } from "vitest"

import { WorkbenchCommandPalette } from "./workbench-command-palette"
import type {
  CommandPaletteCommandProvider,
  CommandPaletteSearchProvider,
} from "../command-palette/types"
import type { Project } from "../types"

const projects: Project[] = [
  {
    id: "project-1",
    name: "Core",
    repoPath: "/tmp/core",
    defaultBranch: "main",
    repoUrl: "https://github.com/example/core",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
    workspaces: [
      {
        id: "workspace-1",
        name: "Refactor",
        chats: [
          {
            id: "chat-1",
            name: "Setup",
          },
        ],
      },
    ],
  },
]

const createBaseProps = () => ({
  open: true,
  onOpenChange: vi.fn(),
  projects,
  selectedProject: projects[0] ?? null,
  selectedWorkspace: projects[0]?.workspaces[0] ?? null,
  selectedChat: projects[0]?.workspaces[0]?.chats[0] ?? null,
  onSelectProjectsView: vi.fn(),
  onSelectSettingsView: vi.fn(),
  onSelectProject: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onSelectChat: vi.fn(),
  onReloadProjects: vi.fn().mockResolvedValue(undefined),
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("WorkbenchCommandPalette", () => {
  it("opens directly in create-project view when requested", () => {
    const props = createBaseProps()

    render(<WorkbenchCommandPalette {...props} initialView="create-project" />)

    expect(screen.getByPlaceholderText("e.g. Marketing site")).toBeInTheDocument()
  })

  it("opens directly in create-workspace view when requested", () => {
    const props = createBaseProps()

    render(<WorkbenchCommandPalette {...props} initialView="create-workspace" />)

    expect(
      screen.getByPlaceholderText("New workspace name (optional)")
    ).toBeInTheDocument()
  })

  it("creates a project from within the command palette", async () => {
    const props = createBaseProps()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "project-new",
        name: "New Project",
        repoPath: "/tmp/new-project",
        defaultBranch: "main",
        createdAt: "2026-02-09T10:00:00Z",
        updatedAt: "2026-02-09T10:00:00Z",
      }),
    })
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<WorkbenchCommandPalette {...props} />)

    fireEvent.click(screen.getByRole("option", { name: /Add new project/i }))

    fireEvent.change(screen.getByPlaceholderText("e.g. Marketing site"), {
      target: { value: "New Project" },
    })
    fireEvent.change(screen.getByPlaceholderText("/path/to/repo (optional)"), {
      target: { value: "/tmp/new-project" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Create project" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(props.onReloadProjects).toHaveBeenCalledTimes(1)
      expect(props.onSelectProject).toHaveBeenCalledWith("project-new")
      expect(props.onOpenChange).toHaveBeenCalledWith(false)
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("/api/projects")
    expect((init as RequestInit).method).toBe("POST")
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      name: "New Project",
      repoPath: "/tmp/new-project",
      defaultBranch: "main",
    })
  })

  it("selects a directory from within the create-project flow", async () => {
    const props = createBaseProps()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ path: "/Users/erikjohansson/dev/maestro" }),
    })
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<WorkbenchCommandPalette {...props} />)

    fireEvent.click(screen.getByRole("option", { name: /Add new project/i }))
    fireEvent.click(screen.getByRole("button", { name: "Select folder" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(screen.getByDisplayValue("/Users/erikjohansson/dev/maestro")).toBeInTheDocument()
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("/api/fs/select-directory")
    expect((init as RequestInit).method).toBe("POST")
  })

  it("supports injected command providers and search providers", async () => {
    const props = createBaseProps()
    const pluginCommandRun = vi.fn()

    const pluginCommandProvider: CommandPaletteCommandProvider = {
      id: "plugin-command",
      getCommands: () => [
        {
          id: "plugin-command",
          group: "Plugin",
          label: "Open plugin panel",
          value: "plugin panel open",
          perform: () => pluginCommandRun(),
        },
      ],
    }

    const pluginSearchProvider: CommandPaletteSearchProvider = {
      id: "plugin-search",
      search: (query) => {
        if (!query.includes("plug")) {
          return []
        }
        return [
          {
            id: "plugin-search-result",
            group: "Search",
            label: "Plugin search result",
            value: "plugin search result",
            perform: () => {},
          },
        ]
      },
    }

    render(
      <WorkbenchCommandPalette
        {...props}
        commandProviders={[pluginCommandProvider]}
        searchProviders={[pluginSearchProvider]}
      />
    )

    fireEvent.click(screen.getByRole("option", { name: /Open plugin panel/i }))
    expect(pluginCommandRun).toHaveBeenCalledTimes(1)

    fireEvent.click(
      screen.getByRole("option", {
        name: /Search projects, workspaces, and sessions/i,
      })
    )

    fireEvent.change(
      screen.getByPlaceholderText("Search projects, workspaces, and sessions..."),
      {
        target: { value: "plug" },
      }
    )

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Plugin search result/i })).toBeInTheDocument()
    })
  })

  it("searches projects, workspaces, and sessions from search mode", async () => {
    const props = createBaseProps()

    render(<WorkbenchCommandPalette {...props} />)

    fireEvent.click(
      screen.getByRole("option", {
        name: /Search projects, workspaces, and sessions/i,
      })
    )

    fireEvent.change(
      screen.getByPlaceholderText("Search projects, workspaces, and sessions..."),
      {
        target: { value: "core" },
      }
    )

    fireEvent.click(
      screen.getByRole("option", {
        name: /Core.*github\.com\/example\/core/i,
      })
    )

    await waitFor(() => {
      expect(props.onSelectProject).toHaveBeenCalledWith("project-1")
      expect(props.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("creates a workspace from within the command palette", async () => {
    const props = createBaseProps()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        project: { id: "project-1" },
        conversation: { id: "workspace-new" },
        session: { id: "chat-new" },
      }),
    })
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(<WorkbenchCommandPalette {...props} />)

    fireEvent.click(screen.getByRole("option", { name: /Add new workspace/i }))
    fireEvent.change(screen.getByPlaceholderText("New workspace name (optional)"), {
      target: { value: "Sprint planning" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(props.onReloadProjects).toHaveBeenCalledTimes(1)
      expect(props.onSelectChat).toHaveBeenCalledWith(
        "project-1",
        "workspace-new",
        "chat-new"
      )
      expect(props.onOpenChange).toHaveBeenCalledWith(false)
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("/api/conversations")
    expect((init as RequestInit).method).toBe("POST")
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      projectId: "project-1",
      title: "Sprint planning",
    })
  })
})
