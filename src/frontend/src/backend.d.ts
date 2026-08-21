import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Timestamp = bigint;
export interface RecordCheckInRequest {
    timezoneOffsetMinutes: bigint;
    goalId: GoalId;
    checkInType: CheckInType;
    obstacleTemplateId?: ObstacleTemplateId;
    executedIfThen: boolean;
    lockInStartedAt?: bigint;
    lockInEndedAt?: bigint;
    customObstacleNote?: string;
}
export interface GoalAnalytics {
    totalMissed: bigint;
    completionRate: number;
    goalName: string;
    goalId: GoalId;
    totalSkips: bigint;
    longestStreak: bigint;
    totalSuccesses: bigint;
    daysInWindow: bigint;
    daysShownUp: bigint;
    currentStreak: bigint;
}
export interface AnalyticsSummary {
    successRateWithPlan: number;
    plannedObstacle?: ObstacleStat;
    plannedMatchesActual: boolean;
    goals: Array<GoalAnalytics>;
    checkInsWithoutPlan: bigint;
    dailySuccessRate30Days: Array<number>;
    categoryStats: Array<CategoryStat>;
    successRateWithoutPlan: number;
    daysInWindow: bigint;
    actualObstacle?: ObstacleStat;
    daysShownUp: bigint;
    successRateByWeekday: Array<number>;
    checkInsWithPlan: bigint;
}
export interface CreateMacroGoalRequest {
    wish: string;
    themeColor?: string;
    wishDescription: string;
    iconName?: string;
    category: GoalCategory;
    outcome: string;
}
export interface ReusableGoalPublic {
    id: GoalId;
    wish: string;
    wishDescription: string;
    state: GoalState;
    category: GoalCategory;
}
export interface PartnerOverview {
    activeHabitCount: bigint;
    profile: UserProfilePublic;
    currentStreak: bigint;
}
export interface CategoryStat {
    activeHabits: bigint;
    completionRate: number;
    totalSkips: bigint;
    category: GoalCategory;
    totalSuccesses: bigint;
}
export interface CreateHabitRequest {
    startTime?: string;
    endTimeMinutes?: bigint;
    endTime?: string;
    scheduledDays?: Array<string>;
    startTimeMinutes?: bigint;
    goalId: GoalId;
    themeColor?: string;
    wishDescription?: string;
    iconName?: string;
    ifThenPlan: string;
    obstacleTemplateId?: ObstacleTemplateId;
    isLockIn: boolean;
    lockInDurationMinutes?: bigint;
}
export interface CheckIn {
    id: CheckInId;
    owner: UserId;
    goalId: GoalId;
    checkInType: CheckInType;
    obstacleTemplateId?: ObstacleTemplateId;
    timestamp: Timestamp;
    executedIfThen: boolean;
    lockInStartedAt?: bigint;
    lockInEndedAt?: bigint;
    customObstacleNote?: string;
}
export type AvatarShape = Variant_Star_Pentagon_Triangle_Hexagon_Square | null;
export interface Cell {
    value: Value;
    name: string;
}
export interface ConnectionPublic {
    id: ConnectionId;
    status: ConnectionStatus;
    createdAt: Timestamp;
    toPrincipal: UserId;
    fromPrincipal: UserId;
}
export type CheckInId = bigint;
export interface Interaction {
    id: InteractionId;
    interactionType: InteractionType;
    fromPrincipal: UserId;
    checkInId: CheckInId;
    timestamp: Timestamp;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export interface UpdateHabitRequest {
    startTime?: string;
    endTimeMinutes?: bigint;
    endTime?: string;
    scheduledDays?: Array<string>;
    timezoneOffsetMinutes: bigint;
    startTimeMinutes?: bigint;
    themeColor?: string;
    isTimeEdit?: boolean;
    iconName?: string;
    ifThenPlan?: string;
    isLockIn?: boolean;
    lockInDurationMinutes?: bigint;
}
export type GoalId = bigint;
export type AvatarColor = string | null;
export type ObstacleTemplateId = bigint;
export type ConnectionId = bigint;
export interface UpdateMacroGoalRequest {
    themeColor?: string;
    iconName?: string;
}
export interface UserProfilePublic {
    id: UserId;
    bio?: string;
    timezone: string;
    username: string;
    displayName: string;
    timezoneOffsetMinutes: bigint;
    role: UserRole;
    email?: string;
    avatarColor: AvatarColor;
    avatarColorMode: AvatarColorMode;
    avatarShape: AvatarShape;
}
export interface CreateObstacleRequest {
    title: string;
    description: string;
}
export type UserId = Principal;
export interface ObstacleTemplate {
    id: ObstacleTemplateId;
    title: string;
    owner: UserId;
    description: string;
}
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type InteractionId = bigint;
export interface GoalWithHabitsPublic {
    goal: MacroGoalPublic;
    habits: Array<HabitPublic>;
}
export interface FeedItem {
    checkIn: CheckIn;
    goalName: string;
    partnerDisplayName: string;
    partnerAvatarColor: AvatarColor;
    highFiveCount: bigint;
    partnerAvatarColorMode: AvatarColorMode;
    partnerAvatarShape: AvatarShape;
}
export interface PartnerHabitDetail {
    habits: Array<HabitPublic>;
    profile: UserProfilePublic;
}
export interface MacroGoalPublic {
    id: GoalId;
    owner: UserId;
    createdAt: Timestamp;
    wish: string;
    themeColor?: string;
    wishDescription: string;
    iconName?: string;
    updatedAt: Timestamp;
    state: GoalState;
    category: GoalCategory;
    outcome: string;
}
export interface HabitPublic {
    id: GoalId;
    startTime?: string;
    endTimeMinutes: bigint;
    endTime?: string;
    scheduledDays: Array<string>;
    owner: UserId;
    lastEditedAt?: Timestamp;
    startTimeMinutes: bigint;
    createdAt: Timestamp;
    wish: string;
    goalId: GoalId;
    themeColor?: string;
    wishDescription: string;
    iconName?: string;
    ifThenPlan: string;
    updatedAt: Timestamp;
    state: GoalState;
    obstacleTemplateId?: ObstacleTemplateId;
    category: GoalCategory;
    isLockIn: boolean;
    outcome: string;
    lockInDurationMinutes: bigint;
}
export interface ObstacleStat {
    id: ObstacleTemplateId;
    title: string;
}
export enum AvatarColorMode {
    Fill = "Fill",
    BorderOnly = "BorderOnly"
}
export enum CheckInType {
    skip = "skip",
    missedCheckIn = "missedCheckIn",
    missedCheckOut = "missedCheckOut",
    success = "success",
    inProgress = "inProgress"
}
export enum ConnectionStatus {
    pending = "pending",
    rejected = "rejected",
    accepted = "accepted"
}
export enum GoalCategory {
    Productivity = "Productivity",
    Learning = "Learning",
    Health = "Health",
    Social = "Social",
    Leisure = "Leisure"
}
export enum GoalState {
    active = "active",
    completed = "completed",
    paused = "paused"
}
export enum InteractionType {
    highFive = "highFive"
}
export enum PartnerHabitError {
    notPartner = "notPartner",
    profileNotFound = "profileNotFound"
}
export enum UserRole {
    admin = "admin",
    user = "user"
}
export enum Variant_Star_Pentagon_Triangle_Hexagon_Square {
    Star = "Star",
    Pentagon = "Pentagon",
    Triangle = "Triangle",
    Hexagon = "Hexagon",
    Square = "Square"
}
export interface backendInterface {
    createHabit(request: CreateHabitRequest): Promise<{
        __kind__: "ok";
        ok: HabitPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createMacroGoal(request: CreateMacroGoalRequest): Promise<{
        __kind__: "ok";
        ok: MacroGoalPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createObstacleTemplate(request: CreateObstacleRequest): Promise<ObstacleTemplate>;
    deleteCheckIn(checkInId: CheckInId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: {
            __kind__: "sealed";
            sealed: string;
        } | {
            __kind__: "notFound";
            notFound: null;
        } | {
            __kind__: "unauthorized";
            unauthorized: null;
        };
    }>;
    deleteGoal(goalId: GoalId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteHabit(habitId: GoalId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    devReset(): Promise<void>;
    execute(qJson: string): Promise<Result>;
    getAnalytics(timezoneOffsetMinutes: bigint): Promise<AnalyticsSummary>;
    getCheckInsForGoal(goalId: GoalId): Promise<Array<CheckIn>>;
    getCheckInsForGoalTimeline(goalId: GoalId, fromTimestamp: bigint): Promise<Array<CheckIn>>;
    getCheckInsForPeriod(goalId: GoalId, fromTimestamp: bigint, toTimestamp: bigint): Promise<Array<CheckIn>>;
    getHabit(habitId: GoalId): Promise<HabitPublic | null>;
    getInteractionCount(checkInId: CheckInId): Promise<bigint>;
    getMacroGoal(goalId: GoalId): Promise<MacroGoalPublic | null>;
    getMyProfile(): Promise<UserProfilePublic>;
    getPartnerFeed(): Promise<Array<FeedItem>>;
    getPartnerHabits(target: Principal): Promise<{
        __kind__: "ok";
        ok: PartnerHabitDetail;
    } | {
        __kind__: "err";
        err: PartnerHabitError;
    }>;
    getUserProfile(target: UserId): Promise<UserProfilePublic | null>;
    isUsernameAvailable(username: string): Promise<boolean>;
    listAllUsers(): Promise<Array<UserProfilePublic>>;
    listConnections(): Promise<Array<ConnectionPublic>>;
    listHabitsByParent(parentGoalId: GoalId): Promise<{
        __kind__: "ok";
        ok: Array<HabitPublic>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listMyCheckIns(): Promise<Array<CheckIn>>;
    listMyGoals(): Promise<Array<GoalWithHabitsPublic>>;
    listMyObstacleTemplates(): Promise<Array<ObstacleTemplate>>;
    listMyReusableGoals(): Promise<Array<ReusableGoalPublic>>;
    listPartnerOverviews(): Promise<Array<PartnerOverview>>;
    listPendingRequests(): Promise<Array<ConnectionPublic>>;
    recordCheckIn(request: RecordCheckInRequest): Promise<CheckIn>;
    recordInteraction(checkInId: CheckInId, interactionType: InteractionType): Promise<Interaction>;
    register(username: string): Promise<UserProfilePublic>;
    respondToConnection(connectionId: ConnectionId, accept: boolean): Promise<boolean>;
    schema(): Promise<string>;
    sendConnectionRequest(target: UserId): Promise<ConnectionPublic>;
    setTimezone(tz: string): Promise<void>;
    updateGoalState(goalId: GoalId, newState: GoalState): Promise<boolean>;
    updateHabit(habitId: GoalId, request: UpdateHabitRequest): Promise<{
        __kind__: "ok";
        ok: HabitPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateMacroGoal(goalId: GoalId, request: UpdateMacroGoalRequest): Promise<{
        __kind__: "ok";
        ok: MacroGoalPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateMyProfile(displayName: string | null, avatarShape: AvatarShape, avatarColor: AvatarColor, avatarColorMode: AvatarColorMode | null, bio: string | null, email: string | null, timezoneOffsetMinutes: bigint | null): Promise<{
        __kind__: "ok";
        ok: UserProfilePublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
}
