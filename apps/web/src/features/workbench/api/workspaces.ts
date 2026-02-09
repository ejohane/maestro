import type { CreateConversationResponse } from "../types"

type ApiErrorPayload = {
  error?: string
}

type CreateWorkspacePayload = {
  projectId: string
  title?: string
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

export const createWorkspace = async (
  payload: CreateWorkspacePayload
): Promise<CreateConversationResponse> => {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response, "Failed to create workspace."))
  }

  return (await response.json()) as CreateConversationResponse
}
