/**
 * Shared constants for use in both client and server components.
 * 
 * IMPORTANT: Keep this file free of server-only imports (child_process, fs, etc.)
 * to ensure it can be safely imported by React client components.
 * 
 * This file defines constants related to the planning workflow state management
 * using GitHub labels as the persistence mechanism.
 */

/**
 * GitHub label applied to issues that are currently in the planning phase.
 * 
 * When a user starts planning an issue in Maestro:
 * 1. This label is added to the GitHub issue
 * 2. Issue is filtered out of "Open Issues" sections
 * 3. Issue appears only in "Planning" sections
 * 
 * When planning ends:
 * 1. This label is removed from the GitHub issue
 * 2. Issue returns to "Open Issues" sections
 */
export const PLANNING_LABEL = "maestro:planning";

/**
 * Color for the planning label (GitHub hex format, without # prefix).
 * 
 * Purple (7057ff) was chosen because:
 * - Distinct from common label colors (red=bug, green=enhancement, blue=question)
 * - Suggests "in progress" or "workflow state"
 * - Matches Maestros primary purple branding
 */
export const PLANNING_LABEL_COLOR = "7057ff";

/**
 * Description text for the planning label.
 * Shown in GitHub UI when hovering over the label.
 */
export const PLANNING_LABEL_DESCRIPTION = "Issue is being planned in Maestro";

/**
 * GitHub label used to identify issues that are actively being executed by a Maestro swarm.
 * 
 * This label is added when:
 * - User clicks "Start Swarm" in the planning header
 * - The orchestrator session is created and /swarm command is sent
 * 
 * This label is removed when:
 * - User clicks "Stop Swarm" (manual abort)
 * - All beads under the epic are marked as closed (automatic completion)
 * - An unrecoverable error occurs in the orchestrator
 * 
 * The presence of both maestro:planning AND maestro:swarming labels indicates
 * an issue is in active execution phase.
 */
export const SWARM_LABEL = "maestro:swarming";

/**
 * Color for the swarm label in GitHub - green (#28a745) to indicate active execution.
 * This contrasts with the purple (#7057ff) planning label.
 */
export const SWARM_LABEL_COLOR = "28a745";

/**
 * Description for the swarm label shown in GitHub label management.
 */
export const SWARM_LABEL_DESCRIPTION =
  "Issue is being executed by Maestro swarm";
