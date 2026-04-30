import type { backendInterface } from "../backend";
import {
  CheckInType,
  ConnectionStatus,
  GoalState,
  InteractionType,
  SubscriptionTier,
  UserRole,
} from "../backend";

const mockPrincipal = { toText: () => "aaaaa-aa", __brand: "Principal" } as any;

const now = BigInt(Date.now()) * BigInt(1_000_000);

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
};

const sampleCheckIn = {
  id: BigInt(1),
  owner: mockPrincipal,
  goalId: BigInt(1),
  checkInType: CheckInType.success,
  obstacleTemplateId: undefined,
  timestamp: now,
};

const sampleConnection = {
  id: BigInt(1),
  status: ConnectionStatus.accepted,
  createdAt: now,
  toPrincipal: mockPrincipal,
  fromPrincipal: mockPrincipal,
};

export const mockBackend: backendInterface = {
  createGoal: async (request) => ({
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
  }),

  createObstacleTemplate: async (request) => ({
    id: BigInt(10),
    title: request.title,
    owner: mockPrincipal,
    description: request.description,
  }),

  getAdminAuditLog: async () => [],

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

  getCheckInsForGoal: async () => [sampleCheckIn],

  getGoal: async (goalId) => (goalId === BigInt(1) ? sampleGoal1 : null),

  getInteractionCount: async () => BigInt(3),

  getMyProfile: async () => ({
    id: mockPrincipal,
    username: "alex_cumulative",
    role: UserRole.user,
    tier: SubscriptionTier.tier1,
    goalLimit: BigInt(3),
  }),

  getPartnerFeed: async () => [
    {
      checkIn: sampleCheckIn,
      goalName: "Run 5K every morning",
      partnerDisplayName: "Jordan",
      highFiveCount: BigInt(2),
    },
  ],

  getUserProfile: async () => null,

  listAllUsers: async () => [],

  listConnections: async () => [sampleConnection],

  listMyCheckIns: async () => [sampleCheckIn],

  listMyGoals: async () => [sampleGoal1, sampleGoal2],

  listMyObstacleTemplates: async () => [sampleObstacle],

  listPendingRequests: async () => [],

  recordCheckIn: async (request) => ({
    id: BigInt(99),
    owner: mockPrincipal,
    goalId: request.goalId,
    checkInType: request.checkInType,
    obstacleTemplateId: request.obstacleTemplateId,
    timestamp: BigInt(Date.now()) * BigInt(1_000_000),
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
    role: UserRole.user,
    tier: SubscriptionTier.tier1,
    goalLimit: BigInt(3),
  }),

  respondToConnection: async () => true,

  sendConnectionRequest: async (target) => ({
    id: BigInt(99),
    status: ConnectionStatus.pending,
    createdAt: BigInt(Date.now()) * BigInt(1_000_000),
    toPrincipal: target,
    fromPrincipal: mockPrincipal,
  }),

  setUserGoalLimit: async () => undefined,

  updateGoal: async (goalId, request) => ({
    __kind__: "ok",
    ok: {
      ...sampleGoal1,
      id: goalId,
      wish: request.wish ?? sampleGoal1.wish,
      wishDescription: request.wishDescription ?? sampleGoal1.wishDescription,
      ifThenPlan: request.ifThenPlan ?? sampleGoal1.ifThenPlan,
    },
  }),

  updateGoalState: async () => true,
};
