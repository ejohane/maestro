#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import readline from "node:readline";
import {
  Conversation,
  Project,
  Session,
  generateId,
  nowIso
} from "@maestro/core";
import {
  appendEventEntry,
  appendTranscriptEntry,
  findProject,
  listConversations,
  listProjects,
  listSessions,
  readConversation,
  readCurrentContext,
  readProjectById,
  readSession,
  readTranscriptHistory,
  setCurrentContext,
  updateConversationTimestamp,
  updateSessionTimestamp,
  writeConversation,
  writeProject,
  writeSession
} from "@maestro/storage";
import {
  assertGitRepo,
  getRepoDisplayName,
  prepareWorkspace,
  resolveRepoRoot
} from "@maestro/git";
import { DirectSDKClient } from "@maestro/opencode";
import { startWebServer } from "./server.js";

const program = new Command();

program.name("maestro").description("Maestro MVP CLI").version("0.0.0");

const getRepoRootFromCwd = async (): Promise<string> => {
  try {
    return await resolveRepoRoot(process.cwd());
  } catch {
    throw new Error("Not inside a git repository.");
  }
};

const exitWithError = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const buildConversationTitle = (options: {
  repoLabel: string;
  createdAt: string;
  defaultBranch: string;
  fromRef?: string;
  title?: string;
}): string | undefined => {
  const provided = options.title?.trim();
  if (provided) {
    return provided;
  }
  const timestamp = formatTimestamp(options.createdAt);
  const suffix =
    options.fromRef && options.fromRef !== options.defaultBranch
      ? ` (${options.fromRef})`
      : "";
  return `${options.repoLabel} - ${timestamp}${suffix}`;
};

const buildSessionTitle = (options: {
  createdAt: string;
  model?: string;
  title?: string;
}): string | undefined => {
  const provided = options.title?.trim();
  if (provided) {
    return provided;
  }
  const timestamp = formatTimestamp(options.createdAt);
  return `${timestamp} - ${options.model ?? "default"}`;
};

const projectCommand = program.command("project").description("Project commands");

projectCommand
  .command("add")
  .requiredOption("--name <name>", "Project name")
  .requiredOption("--repo <path>", "Path to git repo")
  .option("--default-branch <branch>", "Default branch", "main")
  .description("Register a local git repo as a project")
  .action(async (options) => {
    try {
      const repoRoot = await resolveRepoRoot(path.resolve(options.repo));
      await assertGitRepo(repoRoot);
      const project: Project = {
        id: generateId("p"),
        name: options.name,
        repoPath: repoRoot,
        defaultBranch: options.defaultBranch,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      await writeProject(repoRoot, project);
      console.log(`Added project ${project.name} (${project.id})`);
    } catch (error) {
      exitWithError(error);
    }
  });

projectCommand
  .command("list")
  .option("--repo <path>", "Filter by repo path")
  .description("List registered projects")
  .action(async (options) => {
    try {
      let repoRoot: string | undefined;
      if (options.repo) {
        repoRoot = await resolveRepoRoot(path.resolve(options.repo));
      }

      const projects = await listProjects(repoRoot ?? process.cwd(), {
        includeAll: !repoRoot
      });

      if (projects.length === 0) {
        console.log("No projects found.");
        return;
      }

      projects
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((project) => {
          console.log(
            `${project.id} "${project.name}" - ${project.repoPath} (${project.defaultBranch})`
          );
        });
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command("start")
  .argument("<project>", "Project name or id")
  .option("--title <title>", "Conversation title")
  .option("--from <ref>", "Base git ref")
  .option("--stash", "Stash dirty changes")
  .description("Start a new conversation")
  .action(async (projectNameOrId, options) => {
    try {
      const repoRoot = await getRepoRootFromCwd();
      const project = await findProject(repoRoot, projectNameOrId);
      if (!project) {
        throw new Error(`Project not found: ${projectNameOrId}`);
      }

      const conversationId = generateId("c");
      const workspace = await prepareWorkspace({
        repoRoot: project.repoPath,
        conversationId,
        projectName: project.name,
        conversationTitle: options.title,
        defaultBranch: project.defaultBranch,
        fromRef: options.from,
        stash: options.stash
      });

      const ts = nowIso();
      const repoLabel = await getRepoDisplayName(project.repoPath);
      const conversationTitle = buildConversationTitle({
        repoLabel,
        createdAt: ts,
        defaultBranch: project.defaultBranch,
        fromRef: options.from,
        title: options.title
      });
      const conversation: Conversation = {
        id: conversationId,
        projectId: project.id,
        title: conversationTitle,
        branch: workspace.branch,
        workspacePath: workspace.worktreePath,
        baseRef: workspace.baseRef,
        baseSha: workspace.baseSha,
        stashRef: workspace.stashRef,
        createdAt: ts,
        updatedAt: ts
      };
      await writeConversation(project.repoPath, conversation);

      const sessionId = generateId("s");
      const model = process.env.MAESTRO_MODEL;
      const sessionTitle = buildSessionTitle({ createdAt: ts, model });
      const session: Session = {
        id: sessionId,
        conversationId: conversation.id,
        title: sessionTitle,
        model,
        createdAt: ts,
        updatedAt: ts
      };
      await writeSession(project.repoPath, conversation.id, session);
      await setCurrentContext(project.repoPath, {
        projectId: project.id,
        conversationId: conversation.id,
        sessionId: session.id
      });

      console.log(`Project: ${project.name}`);
      console.log(`Conversation: ${conversation.id}${conversation.title ? ` "${conversation.title}"` : ""}`);
      console.log(`Workspace: ${path.relative(project.repoPath, conversation.workspacePath)}`);
      console.log(`Branch: ${conversation.branch}`);
      console.log(`Base: ${conversation.baseSha} (${conversation.baseRef})`);
      console.log(`Session: ${session.id}`);
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command("chat")
  .option("--session <id>", "Session id")
  .description("Chat in the current session")
  .action(async (options) => {
    try {
      const repoRoot = await getRepoRootFromCwd();
      const current = await readCurrentContext(repoRoot);
      if (!current.conversationId) {
        throw new Error("No current conversation. Use maestro start or maestro use.");
      }
      const conversation = await readConversation(repoRoot, current.conversationId);
      const sessionId = options.session ?? current.sessionId;
      if (!sessionId) {
        throw new Error("No session selected. Use maestro session new.");
      }
      let session = await readSession(repoRoot, conversation.id, sessionId);
      if (!session.model) {
        session.model = process.env.MAESTRO_MODEL;
        await writeSession(repoRoot, conversation.id, session);
      }
      await setCurrentContext(repoRoot, {
        projectId: current.projectId,
        conversationId: conversation.id,
        sessionId: session.id
      });

      const client = new DirectSDKClient();
      const opencodeSessionId = await client.ensureSession({
        sessionId: session.opencodeSessionId,
        title: session.title ?? conversation.title
      });
      if (opencodeSessionId !== session.opencodeSessionId) {
        session.opencodeSessionId = opencodeSessionId;
        await writeSession(repoRoot, conversation.id, session);
      }
      const processInput = async (input: string): Promise<boolean> => {
        const trimmed = input.trim();
        if (!trimmed) {
          return true;
        }
        if (trimmed === "/exit" || trimmed === "/quit") {
          return false;
        }

        const ts = nowIso();
        await appendTranscriptEntry(repoRoot, conversation.id, session.id, {
          ts,
          role: "user",
          content: trimmed,
          sessionId: session.id,
          conversationId: conversation.id
        });

        const history = await readTranscriptHistory(repoRoot, conversation.id, session.id);
        let assistantContent = "";
        for await (const event of client.sendMessage({
          workspacePath: conversation.workspacePath,
          history,
          message: trimmed,
          model: session.model,
          sessionId: session.opencodeSessionId,
          sessionTitle: session.title ?? conversation.title
        })) {
          await appendEventEntry(repoRoot, conversation.id, session.id, {
            ts: nowIso(),
            type: mapEventType(event.type),
            data: event.data,
            sessionId: session.id,
            conversationId: conversation.id
          });
          const chunk = extractAssistantChunk(event);
          if (chunk) {
            process.stdout.write(chunk);
            assistantContent += chunk;
          }
        }
        if (assistantContent.length > 0) {
          process.stdout.write("\n");
          await appendTranscriptEntry(repoRoot, conversation.id, session.id, {
            ts: nowIso(),
            role: "assistant",
            content: assistantContent,
            sessionId: session.id,
            conversationId: conversation.id
          });
        }
        await updateSessionTimestamp(repoRoot, conversation.id, session);
        await updateConversationTimestamp(repoRoot, conversation);
        return true;
      };

      if (process.stdin.isTTY) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: true
        });
        const promptUser = (): Promise<string> =>
          new Promise((resolve) => rl.question("maestro> ", resolve));

        console.log("Type /exit to quit.");
        while (true) {
          const input = await promptUser();
          const keepGoing = await processInput(input);
          if (!keepGoing) {
            break;
          }
        }
        rl.close();
      } else {
        const rl = readline.createInterface({
          input: process.stdin,
          terminal: false
        });
        for await (const line of rl) {
          const keepGoing = await processInput(line);
          if (!keepGoing) {
            break;
          }
        }
        rl.close();
      }
    } catch (error) {
      exitWithError(error);
    }
  });

const sessionCommand = program.command("session").description("Session commands");

sessionCommand
  .command("new")
  .option("--title <title>", "Session title")
  .description("Create a new session in the current conversation")
  .action(async (options) => {
    try {
      const repoRoot = await getRepoRootFromCwd();
      const current = await readCurrentContext(repoRoot);
      if (!current.conversationId) {
        throw new Error("No current conversation. Use maestro start or maestro use.");
      }
      const conversation = await readConversation(repoRoot, current.conversationId);
      const ts = nowIso();
      const session: Session = {
        id: generateId("s"),
        conversationId: conversation.id,
        title: buildSessionTitle({
          createdAt: ts,
          model: process.env.MAESTRO_MODEL,
          title: options.title
        }),
        model: process.env.MAESTRO_MODEL,
        createdAt: ts,
        updatedAt: ts
      };
      await writeSession(repoRoot, conversation.id, session);
      await setCurrentContext(repoRoot, {
        projectId: current.projectId,
        conversationId: conversation.id,
        sessionId: session.id
      });
      console.log(`Session: ${session.id}`);
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command("ls")
  .description("List recent conversations")
  .action(async () => {
    try {
      const repoRoot = await getRepoRootFromCwd();
      const conversations = await listConversations(repoRoot);
      const current = await readCurrentContext(repoRoot);
      if (conversations.length === 0) {
        console.log("No conversations yet.");
        return;
      }
      for (const conversation of conversations) {
        const project = await readProjectById(repoRoot, conversation.projectId);
        const marker = conversation.id === current.conversationId ? "*" : " ";
        const title = conversation.title ? ` "${conversation.title}"` : "";
        console.log(`${marker} ${conversation.id}${title} - ${project.name} (${conversation.updatedAt})`);
      }
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command("use")
  .argument("<conversationId>", "Conversation id")
  .description("Set the current conversation")
  .action(async (conversationId) => {
    try {
      const repoRoot = await getRepoRootFromCwd();
      const conversation = await readConversation(repoRoot, conversationId);
      const sessions = await listSessions(repoRoot, conversation.id);
      let session = sessions[0];
      if (!session) {
        const ts = nowIso();
        session = {
          id: generateId("s"),
          conversationId: conversation.id,
          title: buildSessionTitle({
            createdAt: ts,
            model: process.env.MAESTRO_MODEL
          }),
          model: process.env.MAESTRO_MODEL,
          createdAt: ts,
          updatedAt: ts
        };
        await writeSession(repoRoot, conversation.id, session);
      }
      await setCurrentContext(repoRoot, {
        projectId: conversation.projectId,
        conversationId: conversation.id,
        sessionId: session.id
      });
      console.log(`Conversation: ${conversation.id}`);
      console.log(`Session: ${session.id}`);
    } catch (error) {
      exitWithError(error);
    }
  });

program
  .command("serve")
  .description("Serve the local web UI")
  .option("--port <port>", "Port to listen on", "4173")
  .option("--host <host>", "Host to bind", "127.0.0.1")
  .action(async (options) => {
    try {
      const port = Number(options.port);
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error("Port must be a positive number.");
      }
      await startWebServer({ port, host: options.host });
    } catch (error) {
      exitWithError(error);
    }
  });

const mapEventType = (type: string): string => {
  if (type === "tool_call") return "tool_call";
  if (type === "tool_result") return "tool_result";
  if (type === "error") return "error";
  if (type === "assistant_message") return "sdk_event";
  return "sdk_event";
};

const extractAssistantChunk = (event: { type: string; data: any }): string => {
  if (event.type !== "assistant_message") {
    return "";
  }
  if (typeof event.data === "string") {
    return event.data;
  }
  if (typeof event.data?.content === "string") {
    return event.data.content;
  }
  if (typeof event.data?.message === "string") {
    return event.data.message;
  }
  if (typeof event.data?.delta === "string") {
    return event.data.delta;
  }
  return "";
};

program.parseAsync(process.argv).catch(exitWithError);
