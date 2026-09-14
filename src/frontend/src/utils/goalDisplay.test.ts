import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoalState } from "../backend";
import {
  type LockInGoalRef,
  findOverlapGoal,
  formatDate,
  isLockInActiveWindow,
  stateBadgeStyle,
  stateLabel,
} from "./goalDisplay";

// ─── stateLabel / stateBadgeStyle / formatDate ────────────────────────────────
// These helpers were consolidated from GoalsPage/MyGoalsPage into the shared
// goalDisplay module. The page-level tests assert the rendered output; these
// unit tests pin the helper contracts directly so the shared source of truth
// stays stable.

describe("goalDisplay helpers", () => {
  it("maps each GoalState to its human-readable label", () => {
    expect(stateLabel(GoalState.active)).toBe("Active");
    expect(stateLabel(GoalState.paused)).toBe("Paused");
    expect(stateLabel(GoalState.completed)).toBe("Completed");
  });

  it("formats a bigint nanosecond timestamp as 'Mar 15, 2024'", () => {
    // 2024-03-15T12:00:00Z in nanoseconds.
    expect(formatDate(1_710_504_000_000_000_000n)).toBe("Mar 15, 2024");
  });

  it("returns a non-empty inline style for each known state", () => {
    for (const state of [
      GoalState.active,
      GoalState.paused,
      GoalState.completed,
    ]) {
      const style = stateBadgeStyle(state);
      expect(style.backgroundColor).toBeTruthy();
      expect(style.color).toBeTruthy();
      expect(style.border).toBeTruthy();
    }
  });
});

// ─── findOverlapGoal ──────────────────────────────────────────────────────────
// The shared implementation (previously only in WoopWizard) is the source of
// truth for both WoopWizard and GoalsPage. The point-in-time edge case — a
// habit whose start time equals its end time — is the intentional fix direction
// that GoalsPage previously got wrong, so it is pinned here directly.

function lockIn(
  id: bigint,
  startTime: string,
  endTime: string,
  wishDescription = `Lock-In ${id}`,
): LockInGoalRef {
  return { id, startTime, endTime, wishDescription };
}

describe("findOverlapGoal", () => {
  const existing = [
    lockIn(1n, "09:00", "10:00", "Morning block"),
    lockIn(2n, "14:00", "15:00", "Afternoon block"),
  ];

  it("returns null when there is no overlap", () => {
    expect(findOverlapGoal(existing, "11:00", "12:00")).toBeNull();
    expect(findOverlapGoal(existing, "10:00", "11:00")).toBeNull();
  });

  it("detects a standard range overlap", () => {
    expect(findOverlapGoal(existing, "09:30", "10:30")).toBe("Morning block");
    expect(findOverlapGoal(existing, "13:30", "14:30")).toBe("Afternoon block");
  });

  it("treats a point-in-time block (start === end) as strictly inside an existing block", () => {
    // 09:30 falls strictly inside [09:00, 10:00].
    expect(findOverlapGoal(existing, "09:30", "09:30")).toBe("Morning block");
    // 09:00 is NOT strictly inside (exclusive on both ends), so no conflict.
    expect(findOverlapGoal(existing, "09:00", "09:00")).toBeNull();
    // 10:00 is NOT strictly inside either.
    expect(findOverlapGoal(existing, "10:00", "10:00")).toBeNull();
  });

  it("ignores the goal being edited", () => {
    expect(findOverlapGoal(existing, "09:30", "10:30", 1n)).toBeNull();
  });

  it("returns null when the new start time is empty", () => {
    expect(findOverlapGoal(existing, "", "10:00")).toBeNull();
  });
});

// ─── isLockInActiveWindow ─────────────────────────────────────────────────────
// The shared implementation (previously duplicated in EditHabitPage and
// GoalsPage) is the single source of truth for the Lock-In active-window check.
// The window is [startTime - 5 min, endTime + 5 min] on today's date. Fake
// timers pin "now" so the boundary math is deterministic.

describe("isLockInActiveWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when now is inside the window", () => {
    // Window 09:00–10:00 → active [08:55, 10:05].
    vi.setSystemTime(new Date(2024, 2, 15, 9, 30));
    expect(isLockInActiveWindow("09:00", "10:00")).toBe(true);
  });

  it("returns true at the exact window boundaries", () => {
    // startTime - 5 min.
    vi.setSystemTime(new Date(2024, 2, 15, 8, 55));
    expect(isLockInActiveWindow("09:00", "10:00")).toBe(true);
    // endTime + 5 min.
    vi.setSystemTime(new Date(2024, 2, 15, 10, 5));
    expect(isLockInActiveWindow("09:00", "10:00")).toBe(true);
  });

  it("returns false just before the window opens", () => {
    vi.setSystemTime(new Date(2024, 2, 15, 8, 54, 59));
    expect(isLockInActiveWindow("09:00", "10:00")).toBe(false);
  });

  it("returns false just after the window closes", () => {
    vi.setSystemTime(new Date(2024, 2, 15, 10, 5, 1));
    expect(isLockInActiveWindow("09:00", "10:00")).toBe(false);
  });

  it("returns false well outside the window", () => {
    vi.setSystemTime(new Date(2024, 2, 15, 12, 0));
    expect(isLockInActiveWindow("09:00", "10:00")).toBe(false);
  });
});
