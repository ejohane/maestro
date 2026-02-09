import type { ApiProject } from "../types"

type ApiErrorPayload = {
  error?: string
}

type SelectDirectoryPayload = {
  startPath?: string
}

type SelectDirectoryResponse = {
  path?: string
}

type CreateProjectPayload = {
  name: string
  defaultBranch: string
  repoPath?: string
  gitProvider?: string
  repoUrl?: string
}

const resolveErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as ApiErrorPayload
    if (payload.error) {
      return payload.error
    }
  } catch {
    // Ignore payload parsing errors and keep fallback message.
  }
  return fallback
}

export const selectDirectory = async ({
  startPath,
}: SelectDirectoryPayload = {}): Promise<string | null> => {
  const response = await fetch("/api/fs/select-directory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startPath }),
  })

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response, "Failed to select folder."))
  }

  const payload = (await response.json()) as SelectDirectoryResponse
  return payload.path?.trim() || null
}

export const createProject = async (payload: CreateProjectPayload): Promise<ApiProject> => {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response, "Failed to create project."))
  }

  return (await response.json()) as ApiProject
}
