import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { MaestroConfig, ProjectConfig, ConfigError } from "../types/config";

class ConfigService {
  private configDir = path.join(os.homedir(), ".maestro");
  private configPath = path.join(this.configDir, "config.json");

  // Core operations
  async getConfig(): Promise<MaestroConfig> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      return JSON.parse(content);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ENOENT"
      ) {
        const defaultConfig: MaestroConfig = { projects: [] };
        await this.saveConfig(defaultConfig);
        return defaultConfig;
      }
      if (err instanceof SyntaxError) {
        throw new ConfigError("Config file is corrupted", "PARSE_ERROR");
      }
      throw err;
    }
  }

  async saveConfig(config: MaestroConfig): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  // Project helpers
  async getProjects(): Promise<ProjectConfig[]> {
    const config = await this.getConfig();
    return config.projects;
  }

  async getProject(id: string): Promise<ProjectConfig | null> {
    const projects = await this.getProjects();
    return projects.find((p) => p.id === id) ?? null;
  }

  async projectExists(id: string): Promise<boolean> {
    const project = await this.getProject(id);
    return project !== null;
  }

  async addProject(inputPath: string, name?: string): Promise<ProjectConfig> {
    // Resolve symlinks to get the real path
    const realPath = await fs.realpath(inputPath);

    if (!this.isWithinHome(realPath)) {
      throw new ConfigError("Path must be within home directory", "VALIDATION");
    }

    const config = await this.getConfig();

    // Check for duplicate path
    if (config.projects.some((p) => p.path === realPath)) {
      throw new ConfigError("Project already exists", "VALIDATION");
    }

    const project: ProjectConfig = {
      id: crypto.randomUUID(),
      path: realPath,
      name: name?.trim() || null,
      addedAt: new Date().toISOString(),
    };

    config.projects.push(project);
    await this.saveConfig(config);
    return project;
  }

  async updateProject(
    id: string,
    updates: Partial<Pick<ProjectConfig, "name" | "path">>
  ): Promise<ProjectConfig> {
    const config = await this.getConfig();
    const index = config.projects.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new ConfigError("Project not found", "ENOENT");
    }

    const project = config.projects[index];

    if (updates.path !== undefined) {
      const realPath = await fs.realpath(updates.path);
      if (!this.isWithinHome(realPath)) {
        throw new ConfigError("Path must be within home directory", "VALIDATION");
      }
      // Check for duplicate (excluding current project)
      if (config.projects.some((p) => p.path === realPath && p.id !== id)) {
        throw new ConfigError("Another project already uses this path", "VALIDATION");
      }
      project.path = realPath;
    }

    if (updates.name !== undefined) {
      project.name = updates.name?.trim() || null;
    }

    config.projects[index] = project;
    await this.saveConfig(config);
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    const config = await this.getConfig();
    config.projects = config.projects.filter((p) => p.id !== id);
    await this.saveConfig(config);
  }

  // Path utilities
  getHomeDir(): string {
    return os.homedir();
  }

  toDisplayPath(absolutePath: string): string {
    const home = this.getHomeDir();
    if (absolutePath.startsWith(home)) {
      return "~" + absolutePath.slice(home.length);
    }
    return absolutePath;
  }

  toAbsolutePath(displayPath: string): string {
    if (displayPath.startsWith("~/") || displayPath === "~") {
      return path.join(this.getHomeDir(), displayPath.slice(1));
    }
    return displayPath;
  }

  deriveDisplayName(filePath: string): string {
    return path.basename(filePath);
  }

  isWithinHome(testPath: string): boolean {
    const resolved = path.resolve(testPath);
    const home = this.getHomeDir();
    return resolved === home || resolved.startsWith(home + path.sep);
  }

  getParentPath(filePath: string): string | null {
    const parent = path.dirname(filePath);
    if (!this.isWithinHome(parent) || parent === filePath) {
      return null;
    }
    return parent;
  }
}

export const configService = new ConfigService();
