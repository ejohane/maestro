# Maestro

A mobile-friendly web frontend for OpenCode tailored to a workflow centered on ideation, planning, and parallel agent execution (swarming).

## Problem Statement

Current AI coding workflows are fragmented. You ideate in one place, create issues in another, plan tasks manually, and run agents one at a time. When running multiple agents in parallel (swarming), there's no unified way to observe progress, detect failures, or intervene.

Maestro provides a single interface that follows a natural development workflow: discuss an idea with an agent, formalize it as a GitHub issue, decompose it into tasks, and launch a swarm of agents to implement it in parallel—all while maintaining visibility and control.

## Use Cases

### 1. Ideation

You have a rough idea for a feature. You open a chat with an agent and discuss it. The agent asks clarifying questions, suggests approaches, identifies edge cases. This is exploratory—no code is written yet.

When the idea is solid, you formalize it by creating a GitHub issue and a feature branch directly from the interface.

### 2. Planning

You have a GitHub issue (either just created or pre-existing). You want to break it down into concrete, parallelizable tasks.

The system generates a beads epic with subtasks. You review and refine: reorder tasks, adjust scope, add/remove items, assign files to tasks (which informs file reservation during execution).

This is iterative. You might go back and forth with an agent to refine the plan before it's ready.

### 3. Swarm Execution

The plan is ready. You launch a swarm.

The system identifies ready tasks (no blockers), reserves the relevant files, spawns agent sessions, and sends each agent its task context. Agents work in parallel.

You see a real-time dashboard:
- Which agents are active
- What task each agent is working on
- Live streaming of agent activity
- File reservation status (who owns what)
- Task status (pending, in progress, blocked, done, failed)

When an agent completes a task, its file reservations are released, the task is marked done, and any newly-unblocked tasks become available for the next agent.

When an agent fails or gets stuck, the task is marked blocked and highlighted in the UI. You can inspect the agent's output, send it a message to redirect, or take over manually.

### 4. Solo Iteration

Not every feature needs a swarm. Sometimes you want to iterate directly with one agent—no formal plan, no beads tasks.

This is the same chat interface as ideation, but positioned for implementation. You and the agent go back and forth, making changes, testing, refining.

### 5. Manual Intervention

During a swarm, you notice an agent going down the wrong path. You click into its session and send a message: "Stop. Try using the existing auth middleware instead of creating a new one."

The agent sees your message, adjusts course, and continues.

Or an agent is blocked on a decision it can't make. You provide the answer and it proceeds.

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                          Maestro                                 │
│                    (Next.js web application)                     │
└─────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   OpenCode   │    │  Agent Mail  │    │    Beads     │
│    Server    │    │  MCP Server  │    │  (MCP/CLI)   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                    Local Development Machine
                             │
                             │ Tailscale
                             ▼
                    Mobile / Remote Access
```

### OpenCode Server

The backbone. Runs locally via `opencode serve`.

Provides:
- **Sessions**: Each agent is a session. Create, list, abort, inspect.
- **Prompts**: Send messages to sessions, including async fire-and-forget.
- **Events**: SSE stream for real-time updates (session status, message parts, completions, errors).
- **Files**: Read files, search content, find symbols.

The frontend uses the `@opencode-ai/sdk` TypeScript client to communicate.

### Agent Mail MCP Server

Coordination layer for multi-agent work.

Used for:
- **File Reservations**: Before an agent edits files, it reserves them. Prevents conflicts during parallel execution. Advisory locks with TTL.
- **Agent Registry**: Track which agents are active and what they're doing.

Not used for:
- Inter-agent chat (agents don't need to talk to each other; beads is the coordination layer)
- Human-agent messaging (use OpenCode session prompts instead)

### Beads

Task management system. Organizes work into epics and subtasks.

Provides:
- **Epic/Subtask Structure**: Hierarchical task breakdown.
- **Task States**: open, in_progress, blocked, closed.
- **Dependencies**: Tasks can depend on other tasks.
- **Ready Queue**: Query for tasks that are unblocked and ready to start.

The frontend queries beads to know what to work on, updates status as agents progress, and reflects the current state in the UI.

### GitHub CLI

For issue and branch management.

Used to:
- Create issues from ideation conversations
- Create feature branches
- (Future) Create pull requests when feature is complete

## User Experience

### Navigation Hierarchy

```
┌─────────────────┐
│  Project List   │  ← All your repos
└────────┬────────┘
         ▼
┌─────────────────────────────────────────┐
│           Project Overview              │
├─────────────────────────────────────────┤
│ ACTIVE SWARMS        [live indicators]  │
│ IN PROGRESS          [epics w/ work]    │
│ READY TO SWARM       [planned]          │
│ IDEAS                [still ideating]   │
│ RECENT               [completed]        │
├─────────────────────────────────────────┤
│ SOLO SESSIONS        [past chats]       │
├─────────────────────────────────────────┤
│ [+ New Idea]              [Solo Chat]   │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   Epic View     │  ← The unit of work
│                 │
│ Ideate → Plan ──┼──→ (refine loop)
│           │     │
│           ▼     │
│        Swarm    │
└─────────────────┘
```

### Project List View

The entry point. Shows all configured repositories/projects.

Each project displays:
- Project name and path
- Quick status (active swarms, in-progress work)
- Last activity timestamp

Actions:
- Select a project to open Project Overview
- Add/configure new projects

### Project Overview View

The hub for a single project. Shows what's happening and provides entry points for all workflows.

Sections:

| Section | Content | Epic State |
|---------|---------|------------|
| **Active Swarms** | Swarms running right now, click to monitor | `in_progress` + agents active |
| **In Progress** | Epics with work started but not currently swarming | `in_progress` |
| **Ready to Swarm** | Planned epics not yet launched | `planned` |
| **Ideas** | Epics still in ideation phase, no plan yet | `ideating` |
| **Recent** | Recently completed or closed epics | `closed` |
| **Solo Sessions** | Past solo chat sessions (browsable history) | N/A |

Actions:
- **+ New Idea**: Start ideation chat, which can become an epic
- **Solo Chat**: Quick implementation chat, not tied to an epic

### Epic Lifecycle

Epics follow an ideation-first approach. You start with a conversation, and formalize into a tracked epic when the idea is solid.

```
[+ New Idea]
      │
      ▼
┌───────────┐
│  IDEATE   │  Chat with agent, explore the idea
│           │  No commitment, no structure yet
└─────┬─────┘
      │ User clicks "Formalize" 
      │ (creates GitHub issue + branch)
      ▼
┌───────────┐
│   PLAN    │  Break into subtasks, assign files
│           │  Iterative refinement with agent
└─────┬─────┘
      │ User clicks "Ready to Swarm"
      ▼
┌───────────┐
│   SWARM   │  Parallel agent execution
│           │  Real-time monitoring & intervention
└─────┬─────┘
      │ All tasks complete (or abandoned)
      ▼
┌───────────┐
│   DONE    │  Archived in Recent
└───────────┘
```

### Solo Sessions

Solo sessions exist outside the epic lifecycle. They are project-scoped chat sessions for quick implementation work that doesn't need formal planning.

Characteristics:
- Not tied to any epic or beads task
- Full chat history is preserved and browsable
- Can be promoted to an epic if the work grows in scope

Use cases:
- Quick bug fixes
- Exploratory refactoring
- "Just help me with this one thing"

## Frontend Views

### Ideation View

Chat interface with a single agent. Exploratory conversation about a feature idea.

Shows:
- Chat history with the agent
- Current conversation state

Actions:
- Continue conversation
- **Formalize**: Create GitHub issue and branch, transition to Planning
- Abandon/archive the idea

### Planning View

Task breakdown interface. This is where refinement happens—iterating with an agent to get the plan right.

Shows:
- Epic title and description (from GitHub issue)
- List of subtasks as editable tree
- File assignments per task
- Dependency relationships
- Chat panel for refining the plan with an agent

Actions:
- Generate initial breakdown from issue/description
- Add, remove, reorder tasks
- Edit task details
- Adjust file assignments
- Chat with agent to refine plan
- **Ready to Swarm**: Mark plan complete, transition to Swarm

### Swarm View

Mission control dashboard for parallel execution.

Shows:
- Grid/list of active agents
- Per-agent: task, status, live activity stream
- Overall progress (tasks done / total)
- File reservation map
- Blocked/failed tasks highlighted

Actions:
- Launch swarm (if not yet started)
- Pause/abort swarm
- Click into agent to see full output
- Send message to agent (intervention)
- Retry failed task

### Solo View

Direct implementation chat with one agent. No beads, no swarm. Just you and the agent iterating on code.

Shows:
- Chat history
- Same interface as Ideation View

Actions:
- Continue conversation
- **Promote to Epic**: If work grows in scope, formalize into an epic
- End session

## Data Flow

### Swarm Execution Flow

```
User clicks "Launch Swarm"
         │
         ▼
┌─────────────────────────┐
│ Query beads for ready   │
│ tasks (unblocked)       │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ For each ready task:    │
│ 1. Reserve files        │◄─── Agent Mail
│ 2. Create session       │◄─── OpenCode
│ 3. Send prompt (async)  │◄─── OpenCode
│ 4. Update task status   │◄─── Beads
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Subscribe to SSE events │◄─── OpenCode
│ Update UI in real-time  │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ On task complete:       │
│ 1. Release reservations │◄─── Agent Mail
│ 2. Mark task closed     │◄─── Beads
│ 3. Check for new ready  │
│ 4. Spawn next agents    │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ On task failure:        │
│ 1. Mark task blocked    │◄─── Beads
│ 2. Highlight in UI      │
│ 3. Await user action    │
└─────────────────────────┘
```

### Event-Driven UI

The frontend maintains a persistent SSE connection to OpenCode. All UI updates flow from events:

- `session.created` → Add agent to dashboard
- `session.status` → Update agent status indicator
- `message.created` → New message in agent stream
- `part.updated` → Streaming token updates
- `session.completed` → Trigger completion flow
- `session.error` → Trigger failure handling

No polling. Real-time reactivity.

## Technical Stack

### Frontend
- **Next.js** (App Router)
- **Tailwind CSS** + **shadcn/ui** (mobile-friendly components)
- **EventSource** for SSE streaming

### Clients
- **@opencode-ai/sdk**: OpenCode server communication
- **Agent Mail MCP client**: File reservations, agent registry
- **Beads MCP client** or CLI wrapper: Task management
- **gh CLI**: GitHub operations

### Runtime Environment
- OpenCode server running locally (`opencode serve`)
- Agent Mail MCP server running locally
- Tailscale for remote/mobile access to local machine

## Non-Goals

- **Slack/messaging integration**: Out of scope. The frontend is the primary interface.
- **Push notifications**: Out of scope. Real-time updates only while frontend is open.
- **Agent-to-agent chat**: Agents coordinate through beads, not messaging.
- **Hosted/cloud deployment**: Runs locally, accessed via Tailscale.
