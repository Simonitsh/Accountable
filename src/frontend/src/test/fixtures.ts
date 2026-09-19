import { GoalCategory, GoalState } from "../backend";
import type { HabitPublic, MacroGoalPublic } from "../types";

// Fixed timestamp (nanoseconds) for a known date so formatDate output is
// deterministic across environments. 2024-03-15T12:00:00Z in ns.
export const FIXED_TS_NS = 1_710_504_000_000_000_000n;

export function makeHabit(overrides: Partial<HabitPublic> = {}): HabitPublic {
  return {
    id: 1n,
    startTime: "09:00",
    endTime: "10:00",
    endTimeMinutes: 600n,
    scheduledDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    owner: "aaaaa-aa" as unknown as HabitPublic["owner"],
    startTimeMinutes: 540n,
    createdAt: FIXED_TS_NS,
    wish: "I want to run so that I can feel energized",
    goalId: 1n,
    themeColor: "#10B981",
    wishDescription: "Run every morning",
    ifThenPlan: "If I feel tired, I will put on my shoes",
    obstacleTemplateIds: [1n],
    updatedAt: FIXED_TS_NS,
    state: GoalState.active,
    category: GoalCategory.Health,
    isLockIn: false,
    outcome: "Feel energized",
    lockInDurationMinutes: 60n,
    ...overrides,
  };
}

export function makeMacroGoal(
  overrides: Partial<MacroGoalPublic> = {},
): MacroGoalPublic {
  return {
    id: 1n,
    owner: "aaaaa-aa" as unknown as MacroGoalPublic["owner"],
    createdAt: FIXED_TS_NS,
    wish: "I want to run 5K so that I can build a daily habit",
    wishDescription: "Run every morning",
    outcome: "Feel energized",
    state: GoalState.active,
    category: GoalCategory.Health,
    updatedAt: FIXED_TS_NS,
    ...overrides,
  };
}
