import {
  CheckInType,
  ConnectionStatus,
  GoalState,
  InteractionType,
  UserRole,
} from "../backend";
import type { backendInterface } from "../backend";

const mockPrincipal = { toText: () => "aaaaa-aa", __brand: "Principal" } as any;

const now = BigInt(Date.now()) * BigInt(1_000_000);
const dayNs = BigInt(24 * 60 * 60 * 1_000) * BigInt(1_000_000);

const sampleObstacle = {
  id: BigInt(1),
  title: "Low Energy",
  owner: mockPrincipal,
  description: "Feeling too tired to take action",
};

const sampleGoal1 = {
  id: BigInt(1),
  owner: mockPrincipal,
  createdAt: now,
  updatedAt: now,
  wish: "Run 5K every morning",
  wishDescription: "I want to build a daily running habit to improve my fitness and mental clarity.",
  outcome: "Feel energized and clear-headed every day",
  ifThenPlan: "If I feel tired, then I will start with just 5 minutes of walking.",
  obstacleTemplateId: BigInt(1),
  state: GoalState.active,
  isLockIn: false,
  themeColor: "#10B981",
  iconName: "running",
};

const sampleGoal2 = {
  id: BigInt(2),
  owner: mockPrincipal,
  createdAt: now,
  updatedAt: now,
  wish: "Meditate daily",
  wishDescription: "Build a 10-minute mindfulness meditation practice.",
  outcome: "Reduced stress and improved focus",
  ifThenPlan: "If I miss the morning, then I will meditate during lunch break.",
  obstacleTemplateId: undefined,
  state: GoalState.paused,
  isLockIn: false,
};

const sampleCheckIn = {
  id: BigInt(1),
  owner: mockPrincipal,
  goalId: BigInt(1),
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
  // 3 days ago — missed (failedLockIn treated as missed)
  {
    id: BigInt(103),
    owner: mockPrincipal,
    goalId,
    checkInType: CheckInType.failedLockIn,
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
  createGoal: async (request) => ({
    __kind__: "ok" as const,
    ok: {
      id: BigInt(99),
      owner: mockPrincipal,
      createdAt: BigInt(Date.now()) * BigInt(1_000_000),
      updatedAt: BigInt(Date.now()) * BigInt(1_000_000),
      wish: request.wish,
      wishDescription: request.wishDescription,
      outcome: request.outcome,
      ifThenPlan: request.ifThenPlan,
      obstacleTemplateId: request.obstacleTemplateId,
      state: GoalState.active,
      isLockIn: request.isLockIn ?? false,
      startTime: request.startTime,
      endTime: request.endTime,
      themeColor: request.themeColor,
      iconName: request.iconName,
    },
  }),

  createObstacleTemplate: async (request) => ({
    id: BigInt(10),
    title: request.title,
    owner: mockPrincipal,
    description: request.description,
  }),

  devReset: async () => {},

  getAnalytics: async () => ({
    goals: [
      {
        totalMissed: BigInt(2),
        completionRate: 0.85,
        goalName: "Run 5K every morning",
        goalId: BigInt(1),
        totalSkips: BigInt(1),
        longestStreak: BigInt(7),
        totalSuccesses: BigInt(17),
        currentStreak: BigInt(5),
      },
    ],
    dailySuccessRate30Days: Array.from({ length: 30 }, (_, i) =>
      Math.random() > 0.2 ? 1 : 0
    ),
  }),

  getCheckInsForGoal: async () => [{ ...sampleCheckIn }],

  getCheckInsForGoalTimeline: async (goalId, _fromTimestamp) =>
    buildTimelineCheckIns(goalId),

  getGoal: async (goalId) => (goalId === BigInt(1) ? { ...sampleGoal1 } : null),

  getInteractionCount: async () => BigInt(3),

  getMyProfile: async () => ({
    id: mockPrincipal,
    username: "alex_cumulative",
    displayName: "Alex",
    avatarEmoji: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    role: UserRole.user,
  }),

  getPartnerFeed: async () => [
    {
      checkIn: sampleCheckIn,
      goalName: "Run 5K every morning",
      partnerDisplayName: "Jordan",
      highFiveCount: BigInt(2),
    },
  ],

  getUserProfile: async () => ({
    id: mockPrincipal,
    username: "alex_cumulative",
    displayName: "Demo User",
    avatarEmoji: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    role: UserRole.user,
  }),

  listAllUsers: async () => [],

  listConnections: async () => [sampleConnection],

  listMyCheckIns: async () => [sampleCheckIn],

  listMyGoals: async () => [
    { ...sampleGoal1 },
    { ...sampleGoal2 },
  ],

  listMyObstacleTemplates: async () => [sampleObstacle],

  listPendingRequests: async () => [],

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
    customObstacleNote: request.customObstacleNote,
  }),

  recordInteraction: async (checkInId, interactionType) => ({
    id: BigInt(99),
    interactionType,
    fromPrincipal: mockPrincipal,
    checkInId,
    timestamp: BigInt(Date.now()) * BigInt(1_000_000),
  }),

  register: async (username) => ({
    id: mockPrincipal,
    username,
    displayName: username,
    avatarEmoji: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    role: UserRole.user,
  }),

  respondToConnection: async () => true,

  sendConnectionRequest: async (target) => ({
    id: BigInt(99),
    status: ConnectionStatus.pending,
    createdAt: BigInt(Date.now()) * BigInt(1_000_000),
    toPrincipal: target,
    fromPrincipal: mockPrincipal,
  }),

  setTimezone: async () => undefined,

  updateGoal: async (goalId, request) => ({
    __kind__: "ok",
    ok: {
      ...sampleGoal1,
      id: goalId,
      isLockIn: request.isLockIn ?? false,
      startTime: request.startTime,
      endTime: request.endTime,
      wish: request.wish ?? sampleGoal1.wish,
      wishDescription: request.wishDescription ?? sampleGoal1.wishDescription,
      ifThenPlan: request.ifThenPlan ?? sampleGoal1.ifThenPlan,
    },
  }),

  updateGoalState: async () => true,

  deleteCheckIn: async (_checkInId) => ({ __kind__: "ok", ok: null }),

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

  isUsernameAvailable: async (username: string) => username !== "alex_cumulative",

  updateMyProfile: async (displayName, _avatarEmoji) => ({
    id: mockPrincipal,
    username: "alex_cumulative",
    displayName: displayName ?? "",
    avatarEmoji: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    role: UserRole.user,
  }),
};
