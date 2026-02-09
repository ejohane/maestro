import type { ProjectFormState } from "./types"

export const createDefaultProjectFormState = (): ProjectFormState => ({
  name: "",
  repoPath: "",
  defaultBranch: "main",
  gitProvider: "",
  repoUrl: "",
})
