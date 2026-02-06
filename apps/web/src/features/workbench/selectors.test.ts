import { describe, expect, it } from "vitest"

import {
  buildModelOptions,
  collectAllWorkspaces,
  collectProjectRecentSessions,
  collectRecentSessions,
  collectSettingsModels,
  filterProjectPullRequests,
  getActiveProvider,
  hasProjectsWithRepos,
  sortOpenPullRequests,
} from "./selectors"
import type { ModelProvider, OpenPullRequest, Project } from "./types"

const modelProviders: ModelProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-5.2-codex", name: "GPT 5.2 Codex" },
      { id: "openai/o4-mini" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [{ id: "claude-sonnet-4" }],
  },
]

const projects: Project[] = [
  {
    id: "project-1",
    name: "Core",
    repoPath: "/tmp/core",
    defaultBranch: "main",
    repoUrl: "https://github.com/example/core",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-03T00:00:00Z",
    workspaces: [
      {
        id: "workspace-1",
        name: "Refactor",
        chats: [
          {
            id: "chat-1",
            name: "Session A",
            updatedAt: "2025-01-05T09:00:00Z",
          },
          {
            id: "chat-2",
            name: "Session B",
            updatedAt: "2025-01-04T09:00:00Z",
          },
        ],
        updatedAt: "2025-01-05T00:00:00Z",
      },
    ],
  },
  {
    id: "project-2",
    name: "Web",
    repoPath: "/tmp/web",
    defaultBranch: "main",
    createdAt: "2025-01-02T00:00:00Z",
    updatedAt: "2025-01-04T00:00:00Z",
    workspaces: [
      {
        id: "workspace-2",
        name: "UI polish",
        chats: [
          {
            id: "chat-3",
            name: "Session C",
            updatedAt: "2025-01-06T09:00:00Z",
          },
        ],
        updatedAt: "2025-01-06T00:00:00Z",
      },
    ],
  },
]

const pullRequests: OpenPullRequest[] = [
  {
    id: "1",
    number: "12",
    title: "Fix header",
    url: "https://example.com/pr/12",
    provider: "github",
    repo: "core",
    projectId: "project-1",
    projectName: "Core",
    updatedAt: "2025-01-03T00:00:00Z",
  },
  {
    id: "2",
    number: "99",
    title: "Add tests",
    url: "https://example.com/pr/99",
    provider: "gitlab",
    repo: "web",
    projectId: "project-2",
    projectName: "Web",
    updatedAt: "2025-01-07T00:00:00Z",
  },
]

describe("workbench selectors", () => {
  it("detects active model provider", () => {
    expect(getActiveProvider("openai/gpt-5")).toBe("openai")
    expect(getActiveProvider("gpt-5")).toBeNull()
    expect(getActiveProvider()).toBeNull()
  })

  it("collects settings models and prefixes provider ids", () => {
    expect(collectSettingsModels(modelProviders)).toEqual([
      "openai/gpt-5.2-codex",
      "openai/o4-mini",
      "anthropic/claude-sonnet-4",
    ])
  })

  it("builds deduped model options and filters by active provider", () => {
    const options = buildModelOptions({
      fallbackModel: "openai/gpt-5.2-codex",
      availableModels: ["openai/o3", "anthropic/claude-sonnet-4", "openai/o3"],
      settingsModels: collectSettingsModels(modelProviders),
      selectedChatModel: "openai/o3",
      activeProvider: "openai",
    })

    expect(options.map((option) => option.id)).toEqual([
      "openai/gpt-5.2-codex",
      "openai/o3",
      "openai/o4-mini",
    ])
  })

  it("collects recent sessions across projects by recency", () => {
    const sessions = collectRecentSessions(projects, 2)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.id).toBe("chat-3")
    expect(sessions[1]?.id).toBe("chat-1")
  })

  it("collects recent sessions for a selected project", () => {
    const sessions = collectProjectRecentSessions(projects[0], 5)
    expect(sessions.map((session) => session.id)).toEqual(["chat-1", "chat-2"])
    expect(collectProjectRecentSessions(null, 5)).toEqual([])
  })

  it("collects workspaces sorted by updated date", () => {
    const workspaces = collectAllWorkspaces(projects)
    expect(workspaces.map((workspace) => workspace.id)).toEqual([
      "workspace-2",
      "workspace-1",
    ])
  })

  it("sorts and filters pull requests", () => {
    const sorted = sortOpenPullRequests(pullRequests)
    expect(sorted[0]?.id).toBe("2")

    const filtered = filterProjectPullRequests(sorted, "project-1")
    expect(filtered.map((item) => item.id)).toEqual(["1"])
    expect(filterProjectPullRequests(sorted)).toEqual([])
  })

  it("detects whether any project has a repo url", () => {
    expect(hasProjectsWithRepos(projects)).toBe(true)
    expect(
      hasProjectsWithRepos([
        {
          ...projects[0],
          repoUrl: undefined,
        },
      ])
    ).toBe(false)
  })
})
