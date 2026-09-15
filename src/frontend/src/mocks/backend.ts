import {
  AvatarColorMode,
  CheckInType,
  ConnectionStatus,
  GoalCategory,
  GoalState,
  InteractionType,
  PartnerHabitError,
  UserRole,
  Variant_Star_Pentagon_Triangle_Hexagon_Square,
} from "../backend";
import type { backendInterface } from "../backend";

const mockPrincipal = { toText: () => "aaaaa-aa", __brand: "Principal" } as any;
const mockPrincipalSam = { toText: () => "bbbbb-bb", __brand: "Principal" } as any;

const now = BigInt(Date.now()) * BigInt(1_000_000);
const dayNs = BigInt(24 * 60 * 60 * 1_000) * BigInt(1_000_000);

const sampleObstacle = {
  id: BigInt(1),
  title: "Low Energy",
  owner: mockPrincipal,
  description: "Feeling too tired to take action",
};

// ─── Macro goals (the destination) ────────────────────────────────────────────
// Macro goals carry wish / wishDescription / outcome / category / state but NO
// schedule, Lock-In, or obstacle fields (those live on the linked habits).
// goalId is implicitly null on macro goals (the field does not exist on
// MacroGoalPublic).

// Macro goal 1 — Health, active, with linked habits below.
const sampleMacroGoal1 = {
  id: BigInt(1),
  owner: mockPrincipal,
  createdAt: now,
  updatedAt: now,
  // Assembled wish format ("I want to X so that I can Y") so the WOOP wizard
  // goal-reuse parseWish regex can split it back into goalAction/goalReason.
  wish: "I want to run 5K every morning so that I can build a daily running habit",
  wishDescription: "I want to build a daily running habit to improve my fitness and mental clarity.",
  outcome: "Feel energized and clear-headed every day",
  state: GoalState.active,
  themeColor: "#10B981",
  iconName: "running",
  category: GoalCategory.Health,
};

// Macro goal 2 — Learning, paused, with one linked habit below.
const sampleMacroGoal2 = {
  id: BigInt(2),
  owner: mockPrincipal,
  createdAt: now,
  updatedAt: now,
  // Assembled wish format so goal-reuse can parse it.
  wish: "I want to meditate daily so that I can reduce my stress and improve focus",
  wishDescription: "Build a 10-minute mindfulness meditation practice.",
  outcome: "Reduced stress and improved focus",
  state: GoalState.paused,
  themeColor: "#6366F1",
  iconName: "book-open",
  category: GoalCategory.Learning,
};

// Macro goal 3 — Learning, completed, with NO linked habits. Exercises the
// empty-state path (a macro goal with zero habits yet).
const sampleMacroGoal3 = {
  id: BigInt(3),
  owner: mockPrincipal,
  createdAt: now,
  updatedAt: now,
  wish:
    "I want to read one chapter of a non-fiction book every night so that I can finish twelve books this year and broaden my perspective on how other people think and solve hard problems",
  wishDescription: "Read one chapter nightly.",
  outcome: "Twelve books finished this year",
  state: GoalState.completed,
  themeColor: "#F59E0B",
  iconName: "book",
  category: GoalCategory.Learning,
};

// ─── Habits (the daily keystone action) ───────────────────────────────────────
// Habits are linked to a parent macro goal via `goalId` (required) and inherit
// the parent's category. They carry the full schedule, Lock-In, obstacle, and
// ifThenPlan fields.

// Habit 1 — linked to macro goal 1 (Health). Active, Lock-In enabled.
const sampleHabit1 = {
  id: BigInt(11),
  owner: mockPrincipal,
  goalId: BigInt(1), // parent macro goal
  createdAt: now,
  updatedAt: now,
  wish: sampleMacroGoal1.wish,
  wishDescription: sampleMacroGoal1.wishDescription,
  outcome: sampleMacroGoal1.outcome,
  ifThenPlan: "If I feel tired, then I will start with just 5 minutes of walking.",
  obstacleTemplateId: BigInt(1),
  state: GoalState.active,
  isLockIn: true,
  themeColor: "#10B981",
  iconName: "running",
  lastEditedAt: undefined,
  startTime: "06:00",
  endTime: "07:00",
  startTimeMinutes: BigInt(6 * 60), // 06:00
  endTimeMinutes: BigInt(7 * 60), // 07:00
  lockInDurationMinutes: BigInt(30),
  scheduledDays: ["mon", "tue", "wed", "thu", "fri"],
  category: GoalCategory.Health, // inherited from parent
};

// Habit 2 — linked to macro goal 1 (Health). Active, no Lock-In.
const sampleHabit2 = {
  id: BigInt(12),
  owner: mockPrincipal,
  goalId: BigInt(1), // parent macro goal
  createdAt: now,
  updatedAt: now,
  wish: "I want to stretch for 10 minutes every evening so that I can stay flexible",
  wishDescription: "10-minute evening stretch routine.",
  outcome: "Improved flexibility and fewer injuries",
  ifThenPlan: "If I forget, then I will stretch right before brushing my teeth.",
  obstacleTemplateId: undefined,
  state: GoalState.active,
  isLockIn: false,
  themeColor: "#10B981",
  iconName: "activity",
  lastEditedAt: undefined,
  startTime: "21:00",
  endTime: "21:10",
  startTimeMinutes: BigInt(21 * 60), // 21:00
  endTimeMinutes: BigInt(21 * 10), // 21:10
  lockInDurationMinutes: BigInt(0),
  scheduledDays: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
  category: GoalCategory.Health, // inherited from parent
};

// Habit 3 — linked to macro goal 2 (Learning). Paused.
const sampleHabit3 = {
  id: BigInt(13),
  owner: mockPrincipal,
  goalId: BigInt(2), // parent macro goal
  createdAt: now,
  updatedAt: now,
  wish: sampleMacroGoal2.wish,
  wishDescription: sampleMacroGoal2.wishDescription,
  outcome: sampleMacroGoal2.outcome,
  ifThenPlan: "If I miss the morning, then I will meditate during lunch break.",
  obstacleTemplateId: undefined,
  state: GoalState.paused,
  isLockIn: false,
  themeColor: "#6366F1",
  iconName: "book-open",
  lastEditedAt: undefined,
  startTime: "07:00",
  endTime: "07:10",
  startTimeMinutes: BigInt(7 * 60), // 07:00
  endTimeMinutes: BigInt(7 * 60 + 10), // 07:10
  lockInDurationMinutes: BigInt(0),
  scheduledDays: ["mon", "wed", "fri"],
  category: GoalCategory.Learning, // inherited from parent
};

// All habits, indexed by parent goalId for listHabitsByParent lookups.
const allHabits = [sampleHabit1, sampleHabit2, sampleHabit3];

// All macro goals, indexed by id for getMacroGoal lookups.
const allMacroGoals = [sampleMacroGoal1, sampleMacroGoal2, sampleMacroGoal3];

const sampleCheckIn = {
  id: BigInt(1),
  owner: mockPrincipal,
  goalId: BigInt(11), // linked to sampleHabit1
  checkInType: CheckInType.success,
  obstacleTemplateId: undefined,
  timestamp: now,
  executedIfThen: false,
  lockInStartedAt: undefined,
  lockInEndedAt: undefined,
};

const sampleConnection = {
  id: BigInt(1),
  status: ConnectionStatus.accepted,
  createdAt: now,
  toPrincipal: mockPrincipal,
  fromPrincipal: mockPrincipal,
};

// Rich timeline check-ins for the GoalInsightSheet — 14 days of varied data
const buildTimelineCheckIns = (goalId: bigint) => [
  // Today — executed backup plan (revival success)
  {
    id: BigInt(100),
    owner: mockPrincipal,
    goalId,
    checkInType: CheckInType.success,
    obstacleTemplateId: undefined,
    timestamp: now - BigInt(2 * 60 * 60 * 1_000) * BigInt(1_000_000), // 2h ago
    executedIfThen: true,
    lockInStartedAt: undefined,
    lockInEndedAt: undefined,
    customObstacleNote: undefined,
  },
  // Yesterday — normal success
  {
    id: BigInt(101),
    owner: mockPrincipal,
    goalId,
    checkInType: CheckInType.success,
    obstacleTemplateId: undefined,
    timestamp: now - dayNs - BigInt(3 * 60 * 60 * 1_000) * BigInt(1_000_000),
    executedIfThen: false,
    lockInStartedAt: undefined,
    lockInEndedAt: undefined,
    customObstacleNote: undefined,
  },
  // 2 days ago — skipped with note
  {
    id: BigInt(102),
    owner: mockPrincipal,
    goalId,
    checkInType: CheckInType.skip,
    obstacleTemplateId: BigInt(0), // "Low Energy" preset
    timestamp: now - BigInt(2) * dayNs - BigInt(1 * 60 * 60 * 1_000) * BigInt(1_000_000),
    executedIfThen: false,
    lockInStartedAt: undefined,
    lockInEndedAt: undefined,
    customObstacleNote: "Had a particularly draining work meeting that ran late into the evening.",
  },
  // 3 days ago — missed (missedCheckIn)
  {
    id: BigInt(103),
    owner: mockPrincipal,
    goalId,
    checkInType: CheckInType.missedCheckIn,
    obstacleTemplateId: BigInt(2),
    timestamp: now - BigInt(3) * dayNs,
    executedIfThen: false,
    lockInStartedAt: undefined,
    lockInEndedAt: undefined,
    customObstacleNote: undefined,
  },
  // 4 days ago — normal success
  {
    id: BigInt(104),
    owner: mockPrincipal,
    goalId,
    checkInType: CheckInType.success,
    obstacleTemplateId: undefined,
    timestamp: now - BigInt(4) * dayNs - BigInt(4 * 60 * 60 * 1_000) * BigInt(1_000_000),
    executedIfThen: false,
    lockInStartedAt: undefined,
    lockInEndedAt: undefined,
    customObstacleNote: undefined,
  },
  // 5 days ago — skipped, no note
  {
    id: BigInt(105),
    owner: mockPrincipal,
    goalId,
    checkInType: CheckInType.skip,
    obstacleTemplateId: BigInt(1),
    timestamp: now - BigInt(5) * dayNs,
    executedIfThen: false,
    lockInStartedAt: undefined,
    lockInEndedAt: undefined,
    customObstacleNote: undefined,
  },
  // 6 days ago — revival success
  {
    id: BigInt(106),
    owner: mockPrincipal,
    goalId,
    checkInType: CheckInType.success,
    obstacleTemplateId: undefined,
    timestamp: now - BigInt(6) * dayNs - BigInt(2 * 60 * 60 * 1_000) * BigInt(1_000_000),
    executedIfThen: true,
    lockInStartedAt: undefined,
    lockInEndedAt: undefined,
    customObstacleNote: undefined,
  },
];

export const mockBackend: backendInterface = {
  // ─── Macro goal CRUD ────────────────────────────────────────────────────────
  createMacroGoal: async (request) => ({
    __kind__: "ok" as const,
    ok: {
      id: BigInt(99),
      owner: mockPrincipal,
      createdAt: BigInt(Date.now()) * BigInt(1_000_000),
      updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
      wish: request.wish,
      wishDescription: request.wishDescription,
      outcome: request.outcome,
      state: GoalState.active,
      themeColor: request.themeColor,
      iconName: request.iconName,
      category: request.category,
    },
  }),

  getMacroGoal: async (goalId) => {
    const found = allMacroGoals.find((g) => g.id === goalId);
    return found ? { ...found } : null;
  },

  updateMacroGoal: async (goalId, request) => {
    const found = allMacroGoals.find((g) => g.id === goalId);
    if (!found) {
      return { __kind__: "err" as const, err: "Macro goal not found" };
    }
    return {
      __kind__: "ok" as const,
      ok: {
        ...found,
        id: goalId,
        themeColor: request.themeColor ?? found.themeColor,
        iconName: request.iconName ?? found.iconName,
        updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
      },
    };
  },

  // ─── Habit CRUD ─────────────────────────────────────────────────────────────
  createHabit: async (request) => {
    const parent = allMacroGoals.find((g) => g.id === request.goalId);
    if (!parent) {
      return { __kind__: "err" as const, err: "Parent macro goal not found" };
    }
    return {
      __kind__: "ok" as const,
      ok: {
        id: BigInt(99),
        owner: mockPrincipal,
        goalId: request.goalId,
        createdAt: BigInt(Date.now()) * BigInt(1_000_000),
        updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
        // Wish / wishDescription / outcome / category are inherited from the
        // parent macro goal — the habit does not carry its own copy of these
        // in the request, but the public shape includes them (mirrored from
        // the parent so consumers can render a habit standalone).
        wish: parent.wish,
        wishDescription: parent.wishDescription,
        outcome: parent.outcome,
        category: parent.category,
        ifThenPlan: request.ifThenPlan,
        obstacleTemplateId: request.obstacleTemplateId,
        state: GoalState.active,
        isLockIn: request.isLockIn,
        themeColor: request.themeColor ?? parent.themeColor,
        iconName: request.iconName ?? parent.iconName,
        lastEditedAt: undefined,
        startTime: request.startTime,
        endTime: request.endTime,
        startTimeMinutes: request.startTimeMinutes ?? BigInt(0),
        endTimeMinutes: request.endTimeMinutes ?? BigInt(0),
        lockInDurationMinutes: request.lockInDurationMinutes ?? BigInt(0),
        scheduledDays: request.scheduledDays ?? ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      },
    };
  },

  getHabit: async (habitId) => {
    const found = allHabits.find((h) => h.id === habitId);
    return found ? { ...found } : null;
  },

  listHabitsByParent: async (parentGoalId) => ({
    __kind__: "ok" as const,
    ok: allHabits
      .filter((h) => h.goalId === parentGoalId)
      .map((h) => ({ ...h })),
  }),

  updateHabit: async (habitId, request) => {
    const found = allHabits.find((h) => h.id === habitId);
    if (!found) {
      return { __kind__: "err" as const, err: "Habit not found" };
    }
    return {
      __kind__: "ok" as const,
      ok: {
        ...found,
        id: habitId,
        isLockIn: request.isLockIn ?? found.isLockIn,
        startTime: request.startTime ?? found.startTime,
        endTime: request.endTime ?? found.endTime,
        startTimeMinutes: request.startTimeMinutes ?? found.startTimeMinutes,
        endTimeMinutes: request.endTimeMinutes ?? found.endTimeMinutes,
        lockInDurationMinutes: request.lockInDurationMinutes ?? found.lockInDurationMinutes,
        scheduledDays: request.scheduledDays ?? found.scheduledDays,
        ifThenPlan: request.ifThenPlan ?? found.ifThenPlan,
        themeColor: request.themeColor ?? found.themeColor,
        iconName: request.iconName ?? found.iconName,
        lastEditedAt: BigInt(Date.now()) * BigInt(1_000_000),
        updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
      },
    };
  },

  // ─── List endpoints ─────────────────────────────────────────────────────────
  // listMyGoals returns GoalWithHabitsPublic[] — macro goals grouped with
  // their linked habits. Macro goal 3 has zero habits (empty state).
  listMyGoals: async () =>
    allMacroGoals.map((goal) => ({
      goal: { ...goal },
      habits: allHabits
        .filter((h) => h.goalId === goal.id)
        .map((h) => ({ ...h })),
    })),

  // Reusable goals for the WOOP wizard step-2 goal-reuse chips. Returns the
  // canonical ReusableGoalPublic shape ({ id, wish, wishDescription, state,
  // category }) so the wizard's parseWish + wishDescription-fill logic
  // exercises against realistic data. Uses the same assembled-wish format as
  // the macro goals so parseWish succeeds and the chip tap fills goalAction +
  // goalReason.
  listMyReusableGoals: async () =>
    allMacroGoals.map((g) => ({
      id: g.id,
      wish: g.wish,
      wishDescription: g.wishDescription,
      state: g.state,
      category: g.category,
    })),

  // ─── Obstacle templates ────────────────────────────────────────────────────
  // resolveObstacleLabel mirrors the real backend find-or-create: given a
  // labelText, return the existing mock obstacle template whose title matches
  // case-insensitively, or create and return a new one. Obstacles are locked to
  // the seven built-in OBSTACLE_TEMPLATES, so a built-in label always resolves
  // to one reusable template id rather than creating a duplicate per pick. The
  // sampleObstacle ("Low Energy", id BigInt(1)) is the seeded store.
  resolveObstacleLabel: async (request) => {
    const label = request.labelText.trim();
    const existing = [sampleObstacle].find(
      (t) => t.title.toLowerCase() === label.toLowerCase(),
    );
    if (existing) {
      return { ...existing };
    }
    return {
      id: BigInt(10),
      title: request.labelText,
      owner: mockPrincipal,
      description: "",
    };
  },

  // ─── Goal state ────────────────────────────────────────────────────────────
  updateGoalState: async () => true,

  // ─── Goal deletion (hard-delete) ───────────────────────────────────────────
  // deleteGoal permanently removes a macro goal AND its linked habits from the
  // in-memory mock store. Mirrors the backend signature
  //   (goalId : GoalId) -> async { #ok; #err : Text }
  // Hard-delete is final: no soft-delete / recoverable state. The mock mutates
  // the allMacroGoals / allHabits arrays in place so subsequent listMyGoals,
  // listMyReusableGoals, and getMacroGoal reads reflect the deletion — matching
  // the real canister's destructive semantics for frontend dev and tests.
  deleteGoal: async (goalId) => {
    const macroIdx = allMacroGoals.findIndex((g) => g.id === goalId);
    if (macroIdx === -1) {
      return { __kind__: "err" as const, err: "Goal not found" };
    }
    // Remove the macro goal and every habit linked to it.
    allMacroGoals.splice(macroIdx, 1);
    for (let i = allHabits.length - 1; i >= 0; i--) {
      if (allHabits[i].goalId === goalId) {
        allHabits.splice(i, 1);
      }
    }
    return { __kind__: "ok" as const, ok: null };
  },

  // ─── Habit deletion (hard-delete) ───────────────────────────────────────────
  // deleteHabit permanently removes a single habit from the in-memory mock store.
  // Mirrors the backend signature
  //   (habitId : GoalId) -> async { #ok; #err : Text }
  // Unlike deleteGoal, this only removes the habit itself — the parent macro
  // goal and any sibling habits are left intact. The mock mutates allHabits in
  // place so subsequent listMyGoals, listHabitsByParent, and getHabit reads
  // reflect the deletion — matching the real canister's destructive semantics
  // for frontend dev and tests.
  deleteHabit: async (habitId) => {
    const habitIdx = allHabits.findIndex((h) => h.id === habitId);
    if (habitIdx === -1) {
      return { __kind__: "err" as const, err: "Habit not found" };
    }
    allHabits.splice(habitIdx, 1);
    return { __kind__: "ok" as const, ok: null };
  },

  // ─── Check-ins ─────────────────────────────────────────────────────────────
  recordCheckIn: async (request) => ({
    id: BigInt(99),
    owner: mockPrincipal,
    goalId: request.goalId,
    checkInType: request.checkInType,
    obstacleTemplateId: request.obstacleTemplateId,
    timestamp: BigInt(Date.now()) * BigInt(1_000_000),
    lockInStartedAt: request.lockInStartedAt,
    lockInEndedAt: request.lockInEndedAt,
    executedIfThen: request.executedIfThen,
  }),

  markCheckInIfThenUsed: async () => ({ __kind__: "ok" as const, ok: null }),

  recordInteraction: async (checkInId, interactionType) => ({
    id: BigInt(99),
    interactionType,
    fromPrincipal: mockPrincipal,
    checkInId,
    timestamp: BigInt(Date.now()) * BigInt(1_000_000),
  }),

  getCheckInsForGoal: async () => [{ ...sampleCheckIn }],

  getCheckInsForGoalTimeline: async (goalId, _fromTimestamp) =>
    buildTimelineCheckIns(goalId),

  getCheckInsForPeriod: async (goalId, _from, _to) => [
    {
      id: BigInt(1),
      owner: mockPrincipal,
      goalId,
      checkInType: CheckInType.success,
      obstacleTemplateId: undefined,
      timestamp: BigInt(Date.now()) * BigInt(1_000_000),
      executedIfThen: false,
      lockInStartedAt: undefined,
      lockInEndedAt: undefined,
    },
  ],

  listMyCheckIns: async () => [sampleCheckIn],

  deleteCheckIn: async (_checkInId) => ({ __kind__: "ok", ok: null }),

  getInteractionCount: async () => BigInt(3),

  // ─── Analytics ──────────────────────────────────────────────────────────────
  getAnalytics: async (_timezoneOffsetMinutes: bigint) => ({
    categoryBreakdown: [
      {
        category: GoalCategory.Health,
        successes: BigInt(17),
        total: BigInt(20),
        rate: 0.85,
      },
      {
        category: GoalCategory.Learning,
        successes: BigInt(6),
        total: BigInt(9),
        rate: 0.67,
      },
    ],
    dayOfWeek: [
      {
        dayOfWeek: BigInt(1),
        dayName: "Monday",
        successes: BigInt(3),
        total: BigInt(4),
        rate: 0.75,
      },
      {
        dayOfWeek: BigInt(2),
        dayName: "Tuesday",
        successes: BigInt(4),
        total: BigInt(4),
        rate: 1,
      },
      {
        dayOfWeek: BigInt(3),
        dayName: "Wednesday",
        successes: BigInt(2),
        total: BigInt(4),
        rate: 0.5,
      },
      {
        dayOfWeek: BigInt(4),
        dayName: "Thursday",
        successes: BigInt(4),
        total: BigInt(4),
        rate: 1,
      },
      {
        dayOfWeek: BigInt(5),
        dayName: "Friday",
        successes: BigInt(3),
        total: BigInt(4),
        rate: 0.75,
      },
      {
        dayOfWeek: BigInt(6),
        dayName: "Saturday",
        successes: BigInt(4),
        total: BigInt(5),
        rate: 0.8,
      },
      {
        dayOfWeek: BigInt(0),
        dayName: "Sunday",
        successes: BigInt(3),
        total: BigInt(4),
        rate: 0.75,
      },
    ],
    bestDayOfWeek: BigInt(2),
    worstDayOfWeek: BigInt(3),
    overallIfThenEffectiveness: {
      usedPlan: {
        successes: BigInt(9),
        total: BigInt(10),
        rate: 0.9,
      },
      notUsedPlan: {
        successes: BigInt(14),
        total: BigInt(19),
        rate: 0.74,
      },
    },
    habits: [
      {
        habitId: BigInt(11),
        habitName: "Run 5K every morning",
        category: GoalCategory.Health,
        shownUpDays: BigInt(17),
        ifThenEffectiveness: {
          usedPlan: {
            successes: BigInt(5),
            total: BigInt(5),
            rate: 1,
          },
          notUsedPlan: {
            successes: BigInt(12),
            total: BigInt(15),
            rate: 0.8,
          },
        },
        predictedObstacle: {
          obstacleTemplateId: BigInt(1),
          obstacleName: "Low Energy",
          count: BigInt(3),
        },
        actualObstacles: [
          {
            obstacleTemplateId: BigInt(1),
            obstacleName: "Low Energy",
            count: BigInt(3),
          },
          {
            obstacleTemplateId: BigInt(2),
            obstacleName: "No Time",
            count: BigInt(1),
          },
        ],
      },
      {
        habitId: BigInt(13),
        habitName: "Meditate daily",
        category: GoalCategory.Learning,
        shownUpDays: BigInt(6),
        ifThenEffectiveness: {
          usedPlan: {
            successes: BigInt(4),
            total: BigInt(5),
            rate: 0.8,
          },
          notUsedPlan: {
            successes: BigInt(2),
            total: BigInt(4),
            rate: 0.5,
          },
        },
        predictedObstacle: undefined,
        actualObstacles: [],
      },
    ],
  }),

  // ─── Profile ────────────────────────────────────────────────────────────────
  getMyProfile: async () => ({
    id: mockPrincipal,
    username: "alex_cumulative",
    displayName: "Alex",
    avatarShape: Variant_Star_Pentagon_Triangle_Hexagon_Square.Hexagon,
    avatarColor: "#10B981",
    avatarColorMode: AvatarColorMode.Fill,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    role: UserRole.user,
    timezoneOffsetMinutes: 0n,
  }),

  getUserProfile: async () => ({
    id: mockPrincipal,
    username: "alex_cumulative",
    displayName: "Demo User",
    avatarShape: null,
    avatarColor: null,
    avatarColorMode: AvatarColorMode.Fill,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    role: UserRole.user,
    timezoneOffsetMinutes: 0n,
  }),

  register: async (username) => ({
    id: mockPrincipal,
    username,
    displayName: username,
    avatarShape: null,
    avatarColor: null,
    avatarColorMode: AvatarColorMode.Fill,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    role: UserRole.user,
    timezoneOffsetMinutes: 0n,
  }),

  updateMyProfile: async (
    displayName,
    avatarShape,
    avatarColor,
    avatarColorMode,
    bio,
    email,
    timezoneOffsetMinutes,
  ) => ({
    __kind__: "ok" as const,
    ok: {
      id: mockPrincipal,
      username: "alex_cumulative",
      displayName: displayName ?? "",
      avatarShape: avatarShape ?? null,
      avatarColor: avatarColor ?? null,
      avatarColorMode: avatarColorMode ?? AvatarColorMode.Fill,
      bio: bio ?? undefined,
      email: email ?? undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      role: UserRole.user,
      timezoneOffsetMinutes: timezoneOffsetMinutes ?? 0n,
    },
  }),

  isUsernameAvailable: async (username: string) => username !== "alex_cumulative",

  setTimezone: async () => undefined,

  listAllUsers: async () => [],

  // ─── Connections / partners ─────────────────────────────────────────────────
  listConnections: async () => [sampleConnection],

  listPendingRequests: async () => [],

  sendConnectionRequest: async (target) => ({
    id: BigInt(99),
    status: ConnectionStatus.pending,
    createdAt: BigInt(Date.now()) * BigInt(1_000_000),
    toPrincipal: target,
    fromPrincipal: mockPrincipal,
  }),

  respondToConnection: async () => true,

  getPartnerFeed: async () => [
    {
      checkIn: sampleCheckIn,
      goalName: "Run 5K every morning",
      partnerDisplayName: "Jordan",
      partnerAvatarShape: Variant_Star_Pentagon_Triangle_Hexagon_Square.Star,
      partnerAvatarColor: "#F59E0B",
      partnerAvatarColorMode: AvatarColorMode.Fill,
      highFiveCount: BigInt(2),
    },
  ],

  getPartnerHabits: async (_target) => ({
    __kind__: "ok" as const,
    ok: {
      profile: {
        id: mockPrincipal,
        username: "jordan_h",
        displayName: "Jordan",
        avatarShape: Variant_Star_Pentagon_Triangle_Hexagon_Square.Star,
        avatarColor: "#F59E0B",
        avatarColorMode: AvatarColorMode.Fill,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        role: UserRole.user,
        timezoneOffsetMinutes: 0n,
      },
      habits: [{ ...sampleHabit1 }, { ...sampleHabit3 }],
    },
  }),

  listPartnerOverviews: async () => [
    {
      activeHabitCount: BigInt(2),
      currentStreak: BigInt(5),
      profile: {
        id: mockPrincipal,
        username: "jordan_h",
        displayName: "Jordan",
        avatarShape: Variant_Star_Pentagon_Triangle_Hexagon_Square.Star,
        avatarColor: "#F59E0B",
        avatarColorMode: AvatarColorMode.Fill,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        role: UserRole.user,
        timezoneOffsetMinutes: 0n,
      },
    },
    {
      activeHabitCount: BigInt(1),
      currentStreak: BigInt(3),
      profile: {
        id: mockPrincipalSam,
        username: "sam_runs",
        displayName: "Sam",
        avatarShape: Variant_Star_Pentagon_Triangle_Hexagon_Square.Hexagon,
        avatarColor: "#10B981",
        avatarColorMode: AvatarColorMode.Fill,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        role: UserRole.user,
        timezoneOffsetMinutes: 0n,
      },
    },
  ],

  // ─── OQL ────────────────────────────────────────────────────────────────────
  getApiDoc: async () => "{}",

  devReset: async () => {},

  execute: async (_qJson: string) => ({
    hasMore: false,
    rows: [],
  }),

  schema: async () => "{}",
};
