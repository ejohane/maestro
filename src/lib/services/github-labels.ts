/**
 * GitHub label management service for planning workflow state.
 * 
 * This service provides functions to add/remove the maestro:planning label
 * on GitHub issues, which is used to filter issues out of "Open Issues" views
 * while they are in active planning.
 * 
 * Uses the GitHub CLI (gh) for all operations. Requires gh to be installed
 * and authenticated.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { 
  PLANNING_LABEL, 
  PLANNING_LABEL_COLOR, 
  PLANNING_LABEL_DESCRIPTION,
  SWARM_LABEL,
  SWARM_LABEL_COLOR,
  SWARM_LABEL_DESCRIPTION,
} from "@/lib/constants";
import { withRetry } from "@/lib/utils/error-handling";

const execAsync = promisify(exec);

// Re-export constants for server-side convenience
export { PLANNING_LABEL, PLANNING_LABEL_COLOR, SWARM_LABEL, SWARM_LABEL_COLOR };

/**
 * Ensure the maestro:planning label exists in the repository.
 * Creates the label with standard color/description if it doesnt exist.
 * 
 * This is called before adding the label to an issue to ensure
 * the label exists. Its idempotent - safe to call multiple times.
 * 
 * @param projectPath - Absolute path to the git repository
 * @throws Error if GitHub CLI fails (network, auth, etc.)
 */
export async function ensurePlanningLabel(projectPath: string): Promise<void> {
  // Use --force to create or update the label idempotently
  // This avoids the need to check if the label exists first
  await execAsync(
    `gh label create "${PLANNING_LABEL}" --color "${PLANNING_LABEL_COLOR}" --description "${PLANNING_LABEL_DESCRIPTION}" --force`,
    { cwd: projectPath }
  );
}

/**
 * Add the planning label to a GitHub issue.
 * 
 * This function:
 * 1. Ensures the label exists in the repository
 * 2. Adds the label to the specified issue (with retry logic)
 * 
 * Uses withRetry with GitHub-specific retryability logic:
 * - 3 attempts maximum
 * - Exponential backoff (1s, 2s, 4s)
 * - Retries rate limit errors but not permission errors
 * 
 * If the label is already on the issue, GitHub CLI handles this gracefully
 * (no error, just a no-op).
 * 
 * @param projectPath - Absolute path to the git repository
 * @param issueNumber - GitHub issue number to label
 * @throws Error if GitHub CLI fails after all retry attempts
 * 
 * @example
 * ```typescript
 * await addPlanningLabel("/Users/me/my-repo", 42);
 * // Issue #42 now has the maestro:planning label
 * ```
 */
export async function addPlanningLabel(
  projectPath: string,
  issueNumber: number
): Promise<void> {
  // First ensure the label exists in the repo (no retry needed - idempotent)
  await ensurePlanningLabel(projectPath);
  
  // Add the label to the issue with retry logic for transient failures
  await withRetry(
    async () => {
      await execAsync(
        `gh issue edit ${issueNumber} --add-label "${PLANNING_LABEL}"`,
        { cwd: projectPath }
      );
    },
    {
      maxAttempts: 3,
      backoff: 1000,
      backoffMultiplier: 2,
      isRetryable: isGitHubRetryable,
      onRetry: (attempt, error, nextDelay) => {
        console.log(
          `[GitHub Labels] Retry ${attempt}/3 for adding label to issue #${issueNumber}: ${error.message}. Next delay: ${nextDelay}ms`
        );
      },
    }
  );
}

/**
 * Remove the planning label from a GitHub issue.
 * 
 * Fails silently if:
 * - The label doesnt exist on the issue
 * - The label doesnt exist in the repository
 * 
 * This is intentional - we care about the end state (no label), not
 * whether the label was there before.
 * 
 * @param projectPath - Absolute path to the git repository
 * @param issueNumber - GitHub issue number to unlabel
 * @throws Error only for unexpected failures (network, auth)
 * 
 * @example
 * ```typescript
 * await removePlanningLabel("/Users/me/my-repo", 42);
 * // Issue #42 no longer has the maestro:planning label
 * ```
 */
export async function removePlanningLabel(
  projectPath: string,
  issueNumber: number
): Promise<void> {
  try {
    await execAsync(
      `gh issue edit ${issueNumber} --remove-label "${PLANNING_LABEL}"`,
      { cwd: projectPath }
    );
  } catch (err) {
    // Check if this is a "label not found" error - thats OK
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("does not exist")) {
      // Label wasnt on the issue or doesnt exist - this is fine
      return;
    }
    // Re-throw other errors (network, auth, etc.)
    throw err;
  }
}

/**
 * Check if an issue has the planning label.
 * 
 * This is a pure function that operates on the labels array from a GitHub issue.
 * It does NOT make any API calls - use this for filtering in UI components.
 * 
 * @param labels - Array of label objects from GitHub issue (must have name property)
 * @returns true if the issue has the maestro:planning label
 * 
 * @example
 * ```typescript
 * const issues = await fetchIssues();
 * const openIssues = issues.filter(issue => !hasPlanningLabel(issue.labels));
 * ```
 */
export function hasPlanningLabel(labels: { name: string }[]): boolean {
  return labels.some(label => label.name === PLANNING_LABEL);
}

/**
 * Type guard to check if an issue is in planning state.
 * Alias for hasPlanningLabel with clearer intent.
 * 
 * @param labels - Array of label objects from GitHub issue
 * @returns true if issue is currently being planned
 */
export function isInPlanning(labels: { name: string }[]): boolean {
  return hasPlanningLabel(labels);
}

/**
 * Check if a label exists on a GitHub issue by querying the remote.
 * 
 * Unlike hasPlanningLabel() which operates on in-memory data, this function
 * makes a GitHub API call to verify the current state of the issue.
 * 
 * @param projectPath - Absolute path to the git repository
 * @param issueNumber - GitHub issue number to check
 * @param labelName - Label name to look for (defaults to PLANNING_LABEL)
 * @returns true if the label exists on the issue, false otherwise
 * 
 * @example
 * ```typescript
 * // Check if planning label exists on remote
 * const hasLabel = await hasLabelOnIssue("/Users/me/repo", 42);
 * if (!hasLabel) {
 *   await addPlanningLabel("/Users/me/repo", 42);
 * }
 * ```
 */
export async function hasLabelOnIssue(
  projectPath: string,
  issueNumber: number,
  labelName: string = PLANNING_LABEL
): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `gh issue view ${issueNumber} --json labels --jq ".labels[].name"`,
      { cwd: projectPath }
    );
    // stdout contains one label name per line
    const labels = stdout.split("\n").map(s => s.trim()).filter(Boolean);
    return labels.includes(labelName);
  } catch {
    // If we cannot determine label state (network error, issue not found, etc.),
    // assume label is not present. Caller can decide whether to attempt adding it.
    return false;
  }
}

/**
 * Determines if a GitHub CLI error is retryable.
 * 
 * This is GitHub-specific logic that differs from the global defaultIsRetryable():
 * - Rate limit 403s ARE retryable (we just need to wait)
 * - Permission 403s are NOT retryable (no amount of waiting helps)
 * - Gateway errors (502, 503, 504) ARE retryable
 * - Auth errors (401) are NOT retryable
 * - Network errors (ETIMEDOUT, ECONNRESET) ARE retryable
 * 
 * @param error - The error to evaluate
 * @returns true if the operation should be retried
 * 
 * @example
 * ```typescript
 * await withRetry(
 *   () => addPlanningLabel(path, issueNumber),
 *   { isRetryable: isGitHubRetryable }
 * );
 * ```
 */
export function isGitHubRetryable(error: Error): boolean {
  const msg = error.message.toLowerCase();
  
  // Rate limits are always retryable
  // GitHub rate limit messages include "rate limit" or "API rate limit exceeded"
  if (msg.includes("rate limit")) {
    return true;
  }
  
  // Secondary rate limits (abuse detection)
  // These also include "rate limit" but checking explicitly for completeness
  if (msg.includes("secondary rate limit")) {
    return true;
  }
  
  // Gateway errors are retryable (server-side temporary issues)
  if (/\b50[234]\b/.test(error.message)) {
    return true;
  }
  
  // Network/connection errors are retryable
  if (
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("timeout")
  ) {
    return true;
  }
  
  // Everything else is NOT retryable:
  // - 401 Unauthorized (auth issue, wont change)
  // - 403 without "rate limit" (permission issue)
  // - 404 Not Found (resource doesnt exist)
  // - 422 Unprocessable Entity (validation error)
  return false;
}

// ============================================================================
// Swarm Label Management
// ============================================================================

/**
 * Ensures the maestro:swarming label exists in the repository.
 * Creates it with the configured color and description if it doesn't exist.
 * Safe to call multiple times (idempotent).
 * 
 * @param projectPath - Absolute path to the git repository
 * @throws Error if gh CLI fails due to auth/network issues
 */
export async function ensureSwarmLabel(projectPath: string): Promise<void> {
  try {
    await execAsync(
      `gh label create "${SWARM_LABEL}" --color "${SWARM_LABEL_COLOR}" --description "${SWARM_LABEL_DESCRIPTION}" --force`,
      { cwd: projectPath }
    );
  } catch (error) {
    // Label might already exist - only re-throw for actual errors
    if (!isLabelExistsError(error)) {
      throw error;
    }
  }
}

/**
 * Adds the maestro:swarming label to an issue.
 * Creates the label if it doesn't exist.
 * 
 * @param projectPath - Absolute path to the git repository
 * @param issueNumber - GitHub issue number
 * @throws Error if gh CLI fails
 */
export async function addSwarmLabel(
  projectPath: string,
  issueNumber: number
): Promise<void> {
  await ensureSwarmLabel(projectPath);
  await execAsync(
    `gh issue edit ${issueNumber} --add-label "${SWARM_LABEL}"`,
    { cwd: projectPath }
  );
}

/**
 * Removes the maestro:swarming label from an issue.
 * Fails silently if the label is not present (idempotent).
 * 
 * @param projectPath - Absolute path to the git repository  
 * @param issueNumber - GitHub issue number
 */
export async function removeSwarmLabel(
  projectPath: string,
  issueNumber: number
): Promise<void> {
  try {
    await execAsync(
      `gh issue edit ${issueNumber} --remove-label "${SWARM_LABEL}"`,
      { cwd: projectPath }
    );
  } catch (error) {
    // Ignore "label not found" errors - the goal is achieved
    if (!isLabelNotFoundError(error)) {
      throw error;
    }
  }
}

/**
 * Pure function to check if a labels array includes the swarm label.
 * Works with GitHub API label objects.
 * 
 * @param labels - Array of label objects with 'name' property
 * @returns true if maestro:swarming label is present
 */
export function hasSwarmLabel(labels: { name: string }[]): boolean {
  return labels.some((label) => label.name === SWARM_LABEL);
}

/**
 * Alias for hasSwarmLabel for semantic clarity.
 * Use this when checking "is the issue currently in swarm phase?"
 * 
 * @param labels - Array of label objects with 'name' property
 * @returns true if issue is in swarm execution phase
 */
export function isInSwarm(labels: { name: string }[]): boolean {
  return hasSwarmLabel(labels);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an error is a "label not found" error from GitHub CLI.
 */
function isLabelNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("not found") || 
           error.message.includes("label does not exist");
  }
  return false;
}

/**
 * Check if an error is a "label already exists" error from GitHub CLI.
 */
function isLabelExistsError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("already exists");
  }
  return false;
}
