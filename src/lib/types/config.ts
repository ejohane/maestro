export interface MaestroConfig {
  projects: ProjectConfig[];
}

export interface ProjectConfig {
  id: string; // UUID v4
  path: string; // Absolute path: /Users/erik/dev/project
  name: string | null; // Custom display name, null = derive from path
  addedAt: string; // ISO 8601 timestamp
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public code: "ENOENT" | "EACCES" | "PARSE_ERROR" | "VALIDATION"
  ) {
    super(message);
    this.name = "ConfigError";
  }
}
