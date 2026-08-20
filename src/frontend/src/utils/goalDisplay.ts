import { GoalState } from "../backend";
import type { GoalState as GoalStateType } from "../types";

/**
 * Shared display helpers for goal/habit surfaces (GoalsPage, MyGoalsPage,
 * WoopWizard). These were previously duplicated byte-for-byte across the two
 * pages; consolidating them here keeps the rendered output identical while
 * giving every consumer a single source of truth.
 */

/** Human-readable label for a goal/habit state. */
export function stateLabel(state: GoalStateType): string {
  switch (state) {
    case GoalState.active:
      return "Active";
    case GoalState.completed:
      return "Completed";
    case GoalState.paused:
      return "Paused";
    default:
      return "Unknown";
  }
}

/** Inline style for the state badge (background, text, border). */
export function stateBadgeStyle(state: GoalStateType): React.CSSProperties {
  switch (state) {
    case GoalState.active:
      return {
        backgroundColor: "oklch(var(--color-accent-success) / 0.12)",
        color: "oklch(var(--color-accent-success))",
        border: "1px solid oklch(var(--color-accent-success) / 0.25)",
      };
    case GoalState.completed:
      return {
        backgroundColor: "oklch(var(--color-accent-skip) / 0.12)",
        color: "oklch(var(--color-accent-skip))",
        border: "1px solid oklch(var(--color-accent-skip) / 0.25)",
      };
    case GoalState.paused:
      return {
        backgroundColor: "oklch(var(--color-accent-missed) / 0.12)",
        color: "oklch(var(--color-accent-missed))",
        border: "1px solid oklch(var(--color-accent-missed) / 0.25)",
      };
    default:
      return {};
  }
}

/** Formats a bigint nanosecond timestamp as "Mar 15, 2024". */
export function formatDate(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** A Lock-In goal/habit reference used for overlap validation. */
export interface LockInGoalRef {
  id: bigint;
  startTime?: string;
  endTime?: string;
  wishDescription: string;
}

/**
 * Returns the conflicting Lock-In goal name if the new block overlaps any
 * existing one.
 *  - Point-in-time check (newStartTime === newEndTime): checks if newStartTime
 *    falls strictly *inside* an existing block (exclusive on both ends).
 *  - Range check (newStartTime !== newEndTime): standard interval overlap of
 *    [start, end].
 *
 * This is the more complete implementation (previously only in WoopWizard) and
 * is the single source of truth for both WoopWizard and GoalsPage.
 */
export function findOverlapGoal(
  goals: LockInGoalRef[],
  newStartTime: string,
  newEndTime: string,
  editingGoalId?: bigint | null,
): string | null {
  if (!newStartTime) return null;
  for (const g of goals) {
    if (
      editingGoalId !== undefined &&
      editingGoalId !== null &&
      g.id === editingGoalId
    )
      continue;
    if (!g.startTime || !g.endTime) continue;
    const isPointInTime = newStartTime === newEndTime;
    if (isPointInTime) {
      // Strictly inside: existingStart < newStart < existingEnd
      if (g.startTime < newStartTime && newStartTime < g.endTime) {
        return g.wishDescription || "an existing Lock-In";
      }
    } else {
      // Standard overlap: [newStart, newEnd) overlaps [existingStart, existingEnd)
      if (newStartTime < g.endTime && newEndTime > g.startTime) {
        return g.wishDescription || "an existing Lock-In";
      }
    }
  }
  return null;
}
