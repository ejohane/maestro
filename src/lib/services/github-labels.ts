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
  PLANNING_LABEL_DESCRIPTION 
} from "@/lib/constants";

const execAsync = promisify(exec);

// Re-export constants for server-side convenience
export { PLANNING_LABEL, PLANNING_LABEL_COLOR };

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
  try {
    // Check if label already exists
    await execAsync(`gh label view "${PLANNING_LABEL}"`, { cwd: projectPath });
    // Label exists, nothing to do
  } catch {
    // Label doesnt exist (gh label view returns non-zero), create it
    await execAsync(
      `gh label create "${PLANNING_LABEL}" --color "${PLANNING_LABEL_COLOR}" --description "${PLANNING_LABEL_DESCRIPTION}"`,
      { cwd: projectPath }
    );
  }
}

/**
 * Add the planning label to a GitHub issue.
 * 
 * This function:
 * 1. Ensures the label exists in the repository
 * 2. Adds the label to the specified issue
 * 
 * If the label is already on the issue, GitHub CLI handles this gracefully
 * (no error, just a no-op).
 * 
 * @param projectPath - Absolute path to the git repository
 * @param issueNumber - GitHub issue number to label
 * @throws Error if GitHub CLI fails
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
  // First ensure the label exists in the repo
  await ensurePlanningLabel(projectPath);
  
  // Add the label to the issue
  await execAsync(
    `gh issue edit ${issueNumber} --add-label "${PLANNING_LABEL}"`,
    { cwd: projectPath }
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
