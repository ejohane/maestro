// Shared utility functions for filtering beads by issue
// Used by both the beads list and watch routes

import { Bead } from "./beads";

/**
 * Find the epic bead for a specific issue.
 * Only matches epics that explicitly mention the issue number.
 * 
 * IMPORTANT: We intentionally do NOT fall back to "any epic" because
 * the beads database is shared across all worktrees/issues. Falling back
 * would show beads from unrelated issues.
 * 
 * Patterns we look for:
 * - "(GH #12)" - standard format from planning agent
 * - "#12" - short format
 * - "issue 12" or "issue-12" - natural language
 */
export function findEpicBead(beads: Bead[], issueNumber: number): Bead | null {
  return beads.find(
    (b) =>
      b.type === "epic" &&
      (b.title.includes(`#${issueNumber}`) ||
        b.title.toLowerCase().includes(`issue ${issueNumber}`) ||
        b.title.toLowerCase().includes(`issue-${issueNumber}`))
  ) || null;
}

/**
 * Filter beads to only include those that are part of the given epic's tree.
 * Returns the epic and all its descendants (children, grandchildren, etc.)
 */
export function filterBeadsByEpic(allBeads: Bead[], epic: Bead): Bead[] {
  const epicDescendantIds = new Set<string>();
  epicDescendantIds.add(epic.id);
  
  // Iteratively collect all descendants
  // We need multiple passes since children reference parents
  let foundNew = true;
  while (foundNew) {
    foundNew = false;
    for (const bead of allBeads) {
      if (bead.parent && epicDescendantIds.has(bead.parent) && !epicDescendantIds.has(bead.id)) {
        epicDescendantIds.add(bead.id);
        foundNew = true;
      }
    }
  }
  
  return allBeads.filter((b) => epicDescendantIds.has(b.id));
}

/**
 * Get beads for a specific issue from the full beads list.
 * Returns only beads that belong to the issue's epic tree.
 * Returns empty array if no epic found for the issue.
 */
export function getBeadsForIssue(allBeads: Bead[], issueNumber: number): Bead[] {
  const epic = findEpicBead(allBeads, issueNumber);
  if (!epic) {
    return [];
  }
  return filterBeadsByEpic(allBeads, epic);
}

/**
 * Get beads for a specific epic by ID.
 * Returns only beads that belong to the epic's tree.
 * Returns empty array if the epic ID is not found.
 */
export function getBeadsForEpic(allBeads: Bead[], epicId: string): Bead[] {
  const epic = allBeads.find((b) => b.id === epicId);
  if (!epic) {
    return [];
  }
  return filterBeadsByEpic(allBeads, epic);
}
