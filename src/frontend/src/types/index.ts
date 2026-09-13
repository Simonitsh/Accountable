import {
  Briefcase,
  GraduationCap,
  HeartPulse,
  type LucideIcon,
  Palette,
  Users,
} from "lucide-react";
import { useCallback } from "react";
import type {
  GoalCategory as BackendGoalCategory,
  GoalState as BackendGoalState,
  HabitPublic as BackendHabitPublic,
  MacroGoalPublic as BackendMacroGoalPublic,
} from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";

export type UserRole = "user" | "admin";

// Local type aliases for the backend enums. These satisfy all type-position
// usages in interfaces below (state: GoalState, category: GoalCategory, etc.)
// and are re-exported as types so external consumers get the type side.
// External consumers needing the enum VALUE (e.g. GoalCategory.Health) must
// import from ../backend.d.ts directly — a value re-export from a .d.ts
// triggers TS2846.
type GoalState = BackendGoalState;
type GoalCategory = BackendGoalCategory;
export type { GoalState, GoalCategory };

/** Avatar shape variants — exactly five values per user instructions. */
export type AvatarShape =
  | "Triangle"
  | "Square"
  | "Pentagon"
  | "Hexagon"
  | "Star"
  | null;

/** Avatar color — exact hex of one of the approved base palette swatches, or null. */
export type AvatarColor = string | null;

/**
 * Avatar color mode — determines how the selected color is applied.
 *  - 'Fill': color is applied to both the border ring and the inner shape.
 *  - 'BorderOnly': color is applied to the border ring only; the inner shape
 *    renders in a neutral white/light-gray.
 *
 * Mirrors the backend variant (#Fill / #BorderOnly).
 */
export type AvatarColorMode = "Fill" | "BorderOnly";

/** Backend variant mirror for AvatarColorMode (#Fill / #BorderOnly). */
export type AvatarColorModeVariant =
  | {
      __kind__: "Fill";
    }
  | {
      __kind__: "BorderOnly";
    };

export type CheckInType =
  | "success"
  | "skip"
  | "inProgress"
  | "missedCheckIn"
  | "missedCheckOut";
export type ConnectionStatus = "pending" | "accepted" | "rejected";

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarShape: AvatarShape;
  avatarColor: AvatarColor;
  avatarColorMode: AvatarColorMode;
  role: UserRole;
  goalLimit: number;
}

// ─── Backend type mirrors (new goal/habit split) ──────────────────────────────
// The backend now distinguishes Macro Goals (the destination) from Habits
// (the daily keystone action). These mirror the generated backend.d.ts shapes
// so frontend code can import canonical types from a single location.

/**
 * MacroGoalPublic — re-exported from the generated backend bindings.
 * A macro goal is the high-level destination ("I want to X so that I can Y").
 * It carries the wish, the wishDescription (keystone habit name), the
 * outcome, the category, and the state — but NO schedule, Lock-In, or
 * obstacle fields (those live on the linked habits). Returned by
 * getMacroGoal() and listMyGoals().
 */
export type MacroGoalPublic = BackendMacroGoalPublic;

/**
 * HabitPublic — re-exported from the generated backend bindings.
 * A habit is the daily keystone action linked to a parent macro goal via
 * `goalId`. It carries the full schedule (scheduledDays, startTime, endTime,
 * lockInDurationMinutes), the ifThenPlan, the obstacleTemplateId, and the
 * isLockIn flag. Returned by getHabit(), listHabitsByParent(), createHabit().
 */
export type HabitPublic = BackendHabitPublic;

/**
 * GoalWithHabitsPublic — mirrors the backend GoalWithHabitsPublic type
 * returned by listMyGoals(). Groups a macro goal with its linked habits so
 * the dashboard and My Goals page can render goals with their nested habits.
 *
 * NOTE: The generated backend type declares `goal` as required, but at
 * runtime the backend can return a group with `goal: undefined` (e.g. a
 * goal hard-deleted while its habits still exist). Treat `goal` as
 * potentially undefined in all frontend access — filter out such groups at
 * the point of consumption and use optional chaining as a belt-and-suspenders
 * guard at each access site.
 */
export interface GoalWithHabitsPublic {
  goal: MacroGoalPublic | undefined;
  habits: HabitPublic[];
}

/**
 * ReusableGoalPublic — mirrors the backend ReusableGoalPublic type returned
 * by listMyReusableGoals(). Used to populate the goal-reuse chips in the
 * WOOP wizard step 2 (Macro Goal). Each chip carries the full wish text,
 * the wishDescription (keystone habit name), the goal state, and now the
 * category (added in the new backend shape).
 */
export interface ReusableGoalPublic {
  id: bigint;
  wish: string;
  wishDescription: string;
  state: GoalState;
  category: GoalCategory;
}

/**
 * CreateMacroGoalRequest — mirrors the backend CreateMacroGoalRequest.
 * Creates a new macro goal (the destination). Carries only the macro-level
 * fields: category, wish, wishDescription, outcome, plus optional
 * iconName/themeColor. NO Lock-In, schedule, obstacle, or ifThenPlan fields
 * (those belong to CreateHabitRequest).
 */
export interface CreateMacroGoalRequest {
  category: GoalCategory;
  wish: string;
  wishDescription: string;
  outcome: string;
  iconName?: string;
  themeColor?: string;
}

/**
 * CreateHabitRequest — mirrors the backend CreateHabitRequest.
 * Creates a new habit (the daily keystone action) linked to an existing
 * macro goal via `goalId` (required). Carries the habit-level fields:
 * ifThenPlan, obstacleTemplateId, isLockIn, schedule, and optional
 * iconName/themeColor. NO category, wish, wishDescription, or outcome
 * (those belong to the parent macro goal).
 */
export interface CreateHabitRequest {
  goalId: bigint;
  ifThenPlan: string;
  obstacleTemplateId?: number;
  isLockIn: boolean;
  scheduledDays?: string[];
  startTime?: string;
  endTime?: string;
  startTimeMinutes?: bigint;
  endTimeMinutes?: bigint;
  lockInDurationMinutes?: bigint;
  iconName?: string;
  themeColor?: string;
}

/**
 * UpdateHabitRequest — mirrors the backend UpdateHabitRequest.
 * Updates an existing habit's schedule, Lock-In, icon, color, and ifThenPlan.
 * Carries timezoneOffsetMinutes (required) and an optional isTimeEdit flag.
 */
export interface UpdateHabitRequest {
  timezoneOffsetMinutes: bigint;
  startTime?: string;
  endTime?: string;
  startTimeMinutes?: bigint;
  endTimeMinutes?: bigint;
  scheduledDays?: string[];
  isLockIn?: boolean;
  lockInDurationMinutes?: bigint;
  ifThenPlan?: string;
  iconName?: string;
  themeColor?: string;
  isTimeEdit?: boolean;
}

/**
 * UpdateMacroGoalRequest — mirrors the backend UpdateMacroGoalRequest.
 * Updates an existing macro goal's icon and theme color only (the wish,
 * wishDescription, outcome, and category are immutable after creation).
 */
export interface UpdateMacroGoalRequest {
  iconName?: string;
  themeColor?: string;
}

// ─── Storage mirror type ──────────────────────────────────────────────────────
/**
 * Goal — the frontend storage mirror type. Kept for backwards compatibility
 * with existing components that consume a single flat goal shape (e.g.
 * GoalCard, GoalInsightSheet, SkipModal, MissedWindowSheet, UndoPopup,
 * WoopCatchSheet, PartnerHabitDetail). `goalId` is optional: when undefined
 * the record is a macro goal; when set it is a habit linked to that parent.
 *
 * This is the union of MacroGoalPublic + HabitPublic fields so existing
 * consumers can keep reading `goal.wish`, `goal.isLockIn`, `goal.startTime`,
 * etc. without reshape. New code should prefer MacroGoalPublic / HabitPublic
 * directly.
 */
export interface Goal {
  id: string;
  goalId?: bigint;
  owner: string;
  wish: string;
  wishDescription: string;
  outcome: string;
  obstacleTemplateId?: string;
  ifThenPlan: string;
  state: GoalState;
  iconName?: string;
  themeColor?: string;
  isLockIn: boolean;
  category: GoalCategory;
  startTime?: string;
  endTime?: string;
  lockInDurationMinutes?: number;
  startTimeMinutes?: number;
  endTimeMinutes?: number;
  scheduledDays?: string[];
  createdAt: bigint;
  updatedAt: bigint;
}

// ─── Compatibility aliases ───────────────────────────────────────────────────
// The generated backend.d.ts no longer exports GoalPublic or
// UpdateGoalRequest (they were split into MacroGoalPublic/HabitPublic and
// UpdateHabitRequest/UpdateMacroGoalRequest). Several existing components
// still import those names from "../backend.d.ts" directly; re-exporting
// them here from types/index.ts gives those files a single migration target
// once they are updated in a later task. Until then, files importing
// `GoalPublic` from backend.d.ts will fail to compile — that migration is
// tracked as a scope_conflict in the episode issues (out of this task's
// assigned file list).
//
// GoalPublic is aliased to HabitPublic because the old GoalPublic shape was
// the habit-level record (it carried isLockIn, startTime, scheduledDays,
// obstacleTemplateId, ifThenPlan — all habit fields). MacroGoalPublic is a
// narrower shape without those fields.
export type GoalPublic = HabitPublic;
export type UpdateGoalRequest = UpdateHabitRequest;

export interface CheckIn {
  id: string;
  goalId: bigint;
  owner: string;
  checkInType: CheckInType;
  obstacleTemplateId?: string;
  timestamp: bigint;
  lockInStartedAt?: number;
  lockInEndedAt?: number;
  executedIfThen: boolean;
  customObstacleNote?: string;
}

export interface Connection {
  id: string;
  fromPrincipal: string;
  toPrincipal: string;
  status: ConnectionStatus;
  createdAt: bigint;
}

export interface FeedItem {
  checkIn: CheckIn;
  goalName: string;
  partnerDisplayName: string;
  partnerAvatarShape: AvatarShape;
  partnerAvatarColor: AvatarColor;
  partnerAvatarColorMode: AvatarColorMode;
  highFiveCount: number;
}

export interface GoalAnalytics {
  goalId: bigint;
  goalName: string;
  successCount: number;
  skipCount: number;
  missedCount: number;
  currentStreak: number;
}

export interface AnalyticsSummary {
  goals: GoalAnalytics[];
  dailySuccessRate30Days: number[];
}

/**
 * @deprecated Use CreateMacroGoalRequest (macro goals) or CreateHabitRequest
 * (habits) instead. Kept only so existing imports from types/index.ts do not
 * break until the consuming files are migrated in a later task.
 */
export interface CreateGoalRequest {
  wish: string;
  wishDescription: string;
  outcome: string;
  ifThenPlan: string;
  category: GoalCategory;
  isLockIn: boolean;
  goalId?: bigint;
  scheduledDays: string[];
  iconName?: string;
  themeColor?: string;
  obstacleTemplateId?: string;
  startTime?: string;
  endTime?: string;
  lockInDurationMinutes?: number;
  startTimeMinutes?: number;
  endTimeMinutes?: number;
  timezoneOffsetMinutes: bigint;
}

export interface ObstacleTemplate {
  id: string;
  label: string;
  description: string;
}

export const CATEGORY_DETAILS: {
  id: GoalCategory;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "Health" as GoalCategory,
    title: "Health",
    description:
      "Physical fitness, nutrition, sleep, and mental wellness habits.",
    icon: HeartPulse,
  },
  {
    id: "Learning" as GoalCategory,
    title: "Learning",
    description: "Reading, courses, skill-building, and intellectual growth.",
    icon: GraduationCap,
  },
  {
    id: "Social" as GoalCategory,
    title: "Social",
    description: "Relationships, networking, community, and communication.",
    icon: Users,
  },
  {
    id: "Productivity" as GoalCategory,
    title: "Productivity",
    description: "Work, focus, time management, and career advancement.",
    icon: Briefcase,
  },
  {
    id: "Leisure" as GoalCategory,
    title: "Leisure",
    description: "Hobbies, creativity, relaxation, and personal enjoyment.",
    icon: Palette,
  },
];

export const OBSTACLE_TEMPLATES: ObstacleTemplate[] = [
  {
    id: "low_energy",
    label: "Low Energy",
    description: "I feel tired or lack motivation",
  },
  {
    id: "time_crunch",
    label: "Time Crunch",
    description: "I ran out of time or had competing priorities",
  },
  {
    id: "distraction",
    label: "Distraction",
    description: "I got pulled away by distractions",
  },
  {
    id: "social_pressure",
    label: "Social Pressure",
    description: "External demands took over",
  },
  {
    id: "environment",
    label: "Environment",
    description: "My environment wasn't set up for success",
  },
  {
    id: "health",
    label: "Health",
    description: "Physical or mental health issues got in the way",
  },
  {
    id: "something_else",
    label: "Something else",
    description: "A different reason got in the way",
  },
];

/**
 * useResolveObstacleLabel — the single shared mechanism every obstacle picker
 * flow uses to turn a built-in obstacle label into a real, reusable obstacle
 * template id owned by the caller.
 *
 * It calls the backend `resolveObstacleLabel({ labelText })` find-or-create:
 * the first time a user picks a given label it becomes a saved ObstacleTemplate
 * record for them; every later pick of the same label reuses that same record
 * (case-insensitive title match) instead of creating a duplicate. This builds
 * on the existing dedup pattern already in the app — WoopWizard's
 * `uniqueUserObstacles` logic avoids showing a duplicate when a user's saved
 * obstacle matches one of the six built-in labels by comparing titles
 * case-insensitively. The backend performs the same case-insensitive
 * label-to-template match, so a built-in label always resolves to one reusable
 * template id rather than creating a new record per pick.
 *
 * Returns a stable `resolveObstacleLabel(labelText)` function that resolves the
 * label and returns the resolved template id (BigInt). Throws if the backend
 * actor is not ready.
 */
export function useResolveObstacleLabel() {
  const { actor, actorReady } = useBackend();

  return useCallback(
    async (labelText: string): Promise<bigint> => {
      if (!actor || !actorReady) {
        throw new Error("Backend is not ready");
      }
      const template = await actor.resolveObstacleLabel({ labelText });
      return template.id;
    },
    [actor, actorReady],
  );
}
