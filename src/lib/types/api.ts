export interface Project {
  id: string;
  path: string;
  displayPath: string;
  name: string | null;
  displayName: string;
  addedAt: string;
  status: "active" | "missing";
}

export interface Directory {
  name: string;
  path: string;
  isGitRepo: boolean;
}

export interface BrowseResult {
  currentPath: string;
  displayPath: string;
  parent: string | null;
  canGoUp: boolean;
  directories: Directory[];
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  createdAt: string;
  author: {
    login: string;
  };
  labels: { name: string }[];
}

export interface PlanningSessionInfo {
  issueNumber: number;
  issueTitle: string;
  worktreePath: string;
  createdAt: string;
}

// ============================================================================
// Swarm Types
// ============================================================================

/**
 * Status of the swarm execution as a whole.
 * - 'running': Orchestrator is active, agents may be working
 * - 'stopped': User manually stopped the swarm
 * - 'completed': All beads under the epic are closed
 * - 'error': Orchestrator crashed or unrecoverable error
 */
export type SwarmStatus = "running" | "stopped" | "completed" | "error";

/**
 * Swarm session mapping stored in ~/.maestro/sessions.json
 * Extends the base SessionMapping with swarm-specific fields.
 */
export interface SwarmSessionMapping {
  projectId: string; // Project UUID from Maestro config
  projectPath: string; // Project absolute path
  issueNumber: number; // GitHub issue number
  sessionId: string; // Orchestrator OpenCode session ID
  sessionType: "swarm"; // Discriminator for session type
  worktreePath: string; // Same worktree used in planning
  epicId: string; // Bead epic ID being executed
  status: SwarmStatus; // Current swarm status
  startedAt: string; // ISO timestamp when swarm started
  createdAt: string; // ISO timestamp (for consistency)
  lastAccessedAt: string; // ISO timestamp of last activity
}

/**
 * Status of an individual agent (child session).
 * Derived from OpenCode session.status events.
 */
export type AgentStatus = "idle" | "busy" | "blocked" | "error" | "completed";

/**
 * Real-time state of a swarm agent (child session).
 */
export interface SwarmAgentState {
  sessionId: string; // Child session ID
  title: string; // Session title or truncated ID
  status: AgentStatus; // Current agent status
  lastActivity?: string; // Description of last tool call
  lastActivityAt?: string; // Timestamp of last activity
  pendingPermission?: PendingPermission; // If blocked, the permission request
}

/**
 * Full state of the orchestrator session.
 */
export interface SwarmOrchestratorState {
  sessionId: string; // Orchestrator session ID
  status: AgentStatus; // Orchestrator status
  epicId: string; // Epic being executed
  startedAt: string; // When swarm started
}

/**
 * OpenCode permission response options.
 * - 'once': Allow this specific action this time only
 * - 'always': Add to permanent allowlist for this session
 * - 'reject': Deny this action
 */
export type PermissionResponse = "once" | "always" | "reject";

/**
 * A pending permission request from an agent.
 * Derived from OpenCode permission.updated events.
 */
export interface PendingPermission {
  id: string; // Permission ID for responding
  sessionId: string; // Which agent needs permission
  type: string; // Permission type (bash, edit, etc.)
  pattern?: string; // The command/file being requested
  title: string; // Human-readable description
  metadata: Record<string, unknown>; // Additional context
  requestedAt: string; // When permission was requested
}

/**
 * Progress statistics for the swarm.
 */
export interface SwarmProgress {
  total: number; // Total beads under epic
  completed: number; // Beads with status 'closed'
  inProgress: number; // Beads with status 'in_progress'
  pending: number; // Beads with status 'open'
  percentage: number; // completed / total * 100
}

/**
 * Return type for useSwarmWatch hook.
 * Provides unified access to all swarm real-time data.
 */
export interface UseSwarmWatchReturn {
  orchestrator: SwarmOrchestratorState | null;
  agents: SwarmAgentState[];
  // Note: Bead type should be imported from beads service when available
  beads: unknown[];
  permissions: PendingPermission[];
  progress: SwarmProgress;
  isConnected: boolean;
  isReconnecting: boolean;
  error: Error | null;
}

/**
 * Response from POST /api/projects/[id]/swarm/[issueNumber]/start
 */
export interface StartSwarmResponse {
  success: boolean;
  sessionId?: string; // Orchestrator session ID
  worktreePath?: string;
  epicId?: string;
  error?: string;
}

/**
 * Response from POST /api/projects/[id]/swarm/[issueNumber]/stop
 */
export interface StopSwarmResponse {
  success: boolean;
  error?: string;
}

/**
 * Response from GET /api/projects/[id]/swarms
 * Lists all active swarms for a project.
 */
export interface ActiveSwarm {
  issueNumber: number;
  issueTitle: string;
  epicId: string;
  sessionId: string; // Orchestrator session ID
  worktreePath: string;
  status: SwarmStatus;
  progress: SwarmProgress;
  agents: {
    total: number;
    running: number;
    blocked: number;
  };
  startedAt: string;
}

/**
 * Union type for all swarm-related SSE events.
 * These are transformed from OpenCode events.
 */
export type SwarmSSEEvent =
  | { type: "orchestrator.status"; data: SwarmOrchestratorState }
  | { type: "agent.created"; data: SwarmAgentState }
  | { type: "agent.status"; data: { sessionId: string; status: AgentStatus } }
  | { type: "agent.activity"; data: { sessionId: string; activity: string } }
  | { type: "permission.requested"; data: PendingPermission }
  | {
      type: "permission.resolved";
      data: { sessionId: string; permissionId: string };
    }
  | { type: "progress.updated"; data: SwarmProgress }
  | { type: "swarm.completed"; data: { completedAt: string } }
  | { type: "swarm.error"; data: { error: string } };
