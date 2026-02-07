# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.

**Quick reference:**
- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)

For full workflow details: `bd prime`

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Local Development Commands

This repo is a Bun + Turbo monorepo. Core workflows:

```bash
bun install
bun run build
bun run lint
bun run test
```

### Run the CLI locally (dev/debug)

```bash
bun run apps/cli/src/index.ts
bun run apps/cli/src/index.ts -- --help
bun run --cwd apps/cli cli
bun run --cwd apps/cli dev
bun --inspect apps/cli/src/index.ts
```

### Web UI (local)

```bash
bun run --cwd apps/web build
maestro serve
```

For UI development (web + API server):

```bash
bun run dev
```

## Frontend Visual Verification (Mandatory)

For any frontend/UI work (layout, styling, interaction, rendering behavior) or any task that requires visual confirmation:

1. Use the `agent-browser` skill and verify the change in a real browser session.
2. Exercise the relevant UI states/interactions (not just static load).
3. Capture screenshots of the verified result.
4. Include verification evidence in the handoff (what was checked + screenshot paths).

Do not mark frontend work complete without this browser-based verification unless blocked by an explicit environmental constraint; if blocked, document the blocker and the exact command/output that failed.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
