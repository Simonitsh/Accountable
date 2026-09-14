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

/**
 * Returns true if the current time falls within the Lock-In active window:
 * [startTime - 5 min, endTime + 5 min] on today's date.
 *
 * Both times are 'HH:MM' strings. The caller is responsible for guarding on
 * whether the habit is a Lock-In and that both times are present before
 * calling this helper. This is the single source of truth for the active-window
 * check shared by EditHabitPage and GoalsPage (previously duplicated in both).
 */
export function isLockInActiveWindow(
  startTime: string,
  endTime: string,
): boolean {
  const now = Date.now();
  const today = new Date();
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const windowStart =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      sh,
      sm,
    ).getTime() -
    5 * 60 * 1000;
  const windowEnd =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      eh,
      em,
    ).getTime() +
    5 * 60 * 1000;
  return now >= windowStart && now <= windowEnd;
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
