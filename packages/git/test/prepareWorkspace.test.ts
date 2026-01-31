import { afterEach, describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { prepareWorkspace } from "../src/index";

const execFileAsync = promisify(execFile);

const runGit = async (repoRoot: string, args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args]);
  return stdout.trim();
};

const writeFile = async (filePath: string, contents: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
};

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

describe("prepareWorkspace", () => {
  let tempRoot: string | undefined;
  let originalHome: string | undefined;

  afterEach(async () => {
    if (originalHome) {
      process.env.HOME = originalHome;
    }
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("uses latest origin/main when fromRef is unset", async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "maestro-git-"));
    const homeDir = path.join(tempRoot, "home");
    const remotePath = path.join(tempRoot, "remote.git");
    const seedPath = path.join(tempRoot, "seed");
    const clonePath = path.join(tempRoot, "clone");

    await ensureDir(homeDir);
    await runGit(tempRoot, ["init", "--bare", remotePath]);

    await runGit(tempRoot, ["init", "-b", "main", seedPath]);
    await runGit(seedPath, ["config", "user.email", "maestro@example.com"]);
    await runGit(seedPath, ["config", "user.name", "Maestro Test"]);
    await writeFile(path.join(seedPath, "README.md"), "initial\n");
    await runGit(seedPath, ["add", "README.md"]);
    await runGit(seedPath, ["commit", "-m", "initial"]);
    await runGit(seedPath, ["remote", "add", "origin", remotePath]);
    await runGit(seedPath, ["push", "-u", "origin", "main"]);

    await runGit(tempRoot, ["clone", remotePath, clonePath]);

    await writeFile(path.join(seedPath, "CHANGELOG.md"), "update\n");
    await runGit(seedPath, ["add", "CHANGELOG.md"]);
    await runGit(seedPath, ["commit", "-m", "update"]);
    await runGit(seedPath, ["push"]);

    const latestSha = await runGit(seedPath, ["rev-parse", "main"]);

    originalHome = process.env.HOME;
    process.env.HOME = homeDir;

    const result = await prepareWorkspace({
      repoRoot: clonePath,
      conversationId: "c_test",
      projectName: "demo",
      defaultBranch: "main"
    });

    expect(result.baseRef).toBe("origin/main");
    expect(result.baseSha).toBe(latestSha);
  });
});
