# Maestro

Maestro is a workspace-aware CLI for running AI-assisted coding sessions against local git repositories. It keeps track of projects, conversations, and sessions, creates isolated git worktrees per conversation, and stores session history and event streams alongside your repo in a `.maestro` directory.

This repo is an early MVP that wires together:

- A `maestro` CLI for project + conversation lifecycle.
- Git worktree automation for isolated workspaces.
- Storage for projects, conversations, sessions, transcripts, and events.
- An OpenCode client adapter for sending prompts and streaming responses.

## Current capabilities

- Register a git repo as a Maestro project.
- Start a new conversation from a base ref, with optional stash.
- Create a dedicated git branch + worktree per conversation.
- Chat in the current session using OpenCode.
- Store transcripts and event streams as newline-delimited JSON.
- Switch between conversations and sessions.
- Support interactive TTY chat and piped stdin input.

## Repo layout

- `apps/cli` - The `maestro` CLI entrypoint and command implementations.
- `apps/web` - Placeholder package for a future web UI.
- `packages/core` - Shared types + ID/time helpers.
- `packages/git` - Git helpers (repo discovery, worktrees, stashing).
- `packages/opencode` - OpenCode SDK client wrapper.
- `packages/storage` - File-based storage in `.maestro`.
- `packages/ui-kit` - Placeholder for shared UI components.
- `packages/config` - Placeholder for shared configuration.

## How the CLI works

### Core data model

Defined in `packages/core`:

- `Project`: a registered git repository.
- `Conversation`: a git worktree + branch derived from a base ref.
- `Session`: a chat session within a conversation.

Each object is timestamped (`createdAt`, `updatedAt`) and uses a short prefixed ID (`p_`, `c_`, `s_`).

### Storage layout

Data is stored inside the target repo under `.maestro`:

```
.maestro/
  current.json
  projects/
    p_XXXX.json
  conversations/
    c_XXXX/
      conversation.json
      workspace.json
      pointers.json
      sessions/
        s_XXXX/
          session.json
          pointers.json
          transcript.ndjson
          events.ndjson
  workspaces/
    c_XXXX/   (git worktree path)
```

- `current.json` tracks the active project/conversation/session.
- `transcript.ndjson` stores user/assistant/system messages.
- `events.ndjson` stores SDK and tool call events as they stream.

### Git workspace behavior

When starting a conversation, the CLI:

1. Resolves the repo root and asserts it is a git repo.
2. Optionally stashes dirty changes (`--stash`).
3. Resolves a base ref (`origin/<defaultBranch>` if present, else the local default branch).
4. Creates a branch named `conv/<conversationId>` at the base SHA.
5. Adds a git worktree at `.maestro/workspaces/<conversationId>`.

This produces isolated working directories per conversation while keeping the main repo clean.

### OpenCode integration

`packages/opencode` wraps the OpenCode SDK with a `DirectSDKClient` that:

- Ensures an OpenCode session exists (creates one if needed).
- Builds a system message from the workspace path and stored transcript history.
- Sends a prompt and yields streaming response events.

Authentication is handled via basic auth headers when `OPENCODE_SERVER_PASSWORD` is set.

## Commands

All commands are exposed via the `maestro` binary.

### Project registration

Register a local repo as a project:

```
maestro project add --name "My Repo" --repo /path/to/repo --default-branch main
```

### Start a conversation

Create a new conversation (and worktree) for a project:

```
maestro start <projectNameOrId>
```

Optional flags:

- `--title <title>` sets a display title.
- `--from <ref>` uses a specific base ref.
- `--stash` stashes uncommitted changes before creating the worktree.

### Chat in a session

```
maestro chat
```

The CLI supports both interactive TTY sessions and piped input:

```
echo "Summarize this repo" | maestro chat
```

Type `/exit` or `/quit` to end interactive sessions.

### Session management

Create a new session in the current conversation:

```
maestro session new --title "Refactor pass"
```

### Conversation management

List recent conversations:

```
maestro ls
```

Switch the current conversation:

```
maestro use <conversationId>
```

## Environment variables

- `MAESTRO_MODEL` - Default model ID used by the session.
- `MAESTRO_OPENCODE_URL` - OpenCode server URL (defaults to `http://localhost:4096`).
- `OPENCODE_SERVER_USERNAME` - Basic auth username (defaults to `opencode`).
- `OPENCODE_SERVER_PASSWORD` - Basic auth password (enables auth when set).

## Development

This is a Bun + Turbo monorepo.

```
bun install
bun run build
bun run lint
bun run test
```

### Run the CLI locally (dev/debug)

Run the CLI directly against source (no build step required):

```
bun run apps/cli/src/index.ts
```

Pass CLI arguments after `--`:

```
bun run apps/cli/src/index.ts -- --help
```

You can also use the app-level dev script:

```
bun run --cwd apps/cli dev
```

If you need to debug, start Bun with the inspector and attach to `localhost:9229`:

```
bun --inspect apps/cli/src/index.ts
```

Set `MAESTRO_OPENCODE_URL` if your OpenCode server is running somewhere other than the default `http://localhost:4096`.

## What is not built yet

- No web UI beyond a placeholder package.
- No remote storage or sync.
- No UI kit components yet.
- No advanced tool invocation or plugin system.

## Roadmap ideas

- Rich session browser in a web UI.
- Summaries and indexing for transcripts.
- Conversation cleanup/archival helpers.
- Automated PR creation for completed sessions.
