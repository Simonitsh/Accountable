import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AnalyticsSummary {
    categoryBreakdown: Array<CategoryStat>;
    dayOfWeek: Array<DayOfWeekStat>;
    bestDayOfWeek?: bigint;
    overallIfThenEffectiveness: IfThenEffectiveness;
    habits: Array<HabitAnalytics>;
    worstDayOfWeek?: bigint;
}
export type AvatarColor = string | null;
export type AvatarShape = Variant_Star_Pentagon_Triangle_Hexagon_Square | null;
export interface CategoryStat {
    successes: bigint;
    total: bigint;
    rate: number;
    category: GoalCategory;
}
export interface Cell {
    value: Value;
    name: string;
}
export interface CheckIn {
    id: CheckInId;
    owner: UserId;
    note?: string;
    goalId: GoalId;
    checkInType: CheckInType;
    obstacleTemplateId?: ObstacleTemplateId;
    timestamp: Timestamp;
    executedIfThen: boolean;
    lockInStartedAt?: bigint;
    lockInEndedAt?: bigint;
}
export type CheckInId = bigint;
export type ConnectionId = bigint;
export interface ConnectionPublic {
    id: ConnectionId;
    status: ConnectionStatus;
    createdAt: Timestamp;
    toPrincipal: UserId;
    fromPrincipal: UserId;
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
export interface CreateMacroGoalRequest {
    wish: string;
    wishDescription: string;
    iconName?: string;
    category: GoalCategory;
    outcome: string;
}
export interface DayOfWeekStat {
    successes: bigint;
    total: bigint;
    dayOfWeek: bigint;
    rate: number;
    dayName: string;
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
export interface FollowThroughRate {
    successes: bigint;
    total: bigint;
    rate: number;
}
export type GoalId = bigint;
export interface GoalWithHabitsPublic {
    goal: MacroGoalPublic;
    habits: Array<HabitPublic>;
}
export interface HabitAnalytics {
    ifThenEffectiveness: IfThenEffectiveness;
    predictedObstacle?: ObstacleStat;
    habitName: string;
    habitId: GoalId;
    actualObstacles: Array<ObstacleStat>;
    shownUpDays: bigint;
    category: GoalCategory;
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
    ifThenPlan: string;
    updatedAt: Timestamp;
    state: GoalState;
    obstacleTemplateId?: ObstacleTemplateId;
    category: GoalCategory;
    isLockIn: boolean;
    outcome: string;
    lockInDurationMinutes: bigint;
}
export interface IfThenEffectiveness {
    notUsedPlan: FollowThroughRate;
    usedPlan: FollowThroughRate;
}
export interface Interaction {
    id: InteractionId;
    interactionType: InteractionType;
    fromPrincipal: UserId;
    checkInId: CheckInId;
    timestamp: Timestamp;
}
export type InteractionId = bigint;
export interface MacroGoalPublic {
    id: GoalId;
    owner: UserId;
    createdAt: Timestamp;
    wish: string;
    wishDescription: string;
    iconName?: string;
    updatedAt: Timestamp;
    state: GoalState;
    category: GoalCategory;
    outcome: string;
}
export interface ObstacleStat {
    obstacleName: string;
    count: bigint;
    obstacleTemplateId?: ObstacleTemplateId;
}
export interface ObstacleTemplate {
    id: ObstacleTemplateId;
    title: string;
    owner: UserId;
    description: string;
}
export type ObstacleTemplateId = bigint;
export interface PartnerHabitDetail {
    habits: Array<HabitPublic>;
    profile: UserProfilePublic;
}
export interface PartnerOverview {
    activeHabitCount: bigint;
    profile: UserProfilePublic;
    currentStreak: bigint;
}
export interface RecordCheckInRequest {
    timezoneOffsetMinutes: bigint;
    note?: string;
    goalId: GoalId;
    checkInType: CheckInType;
    obstacleTemplateId?: ObstacleTemplateId;
    executedIfThen: boolean;
    lockInStartedAt?: bigint;
    lockInEndedAt?: bigint;
}
export interface ResolveObstacleRequest {
    labelText: string;
}
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export interface ReusableGoalPublic {
    id: GoalId;
    wish: string;
    wishDescription: string;
    state: GoalState;
    category: GoalCategory;
}
export type Timestamp = bigint;
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
    obstacleTemplateId?: ObstacleTemplateId;
    isLockIn?: boolean;
    lockInDurationMinutes?: bigint;
}
export interface UpdateMacroGoalRequest {
    iconName?: string;
}
export type UserId = Principal;
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
export enum Variant_notFound_unauthorized {
    notFound = "notFound",
    unauthorized = "unauthorized"
}
export interface backendInterface {
    /**
     * / Create a habit inside an existing macro goal. `request.goalId` is
     * / REQUIRED — the habit must reference an existing macro goal owned by the
     * / caller. The habit inherits the parent's category; wish/outcome are
     * / sourced from the parent and read-only. The habit's wishDescription
     * / (displayed name) defaults to the parent's, but is overridden by
     * / `request.wishDescription` when the caller supplies one.
     */
    createHabit(request: CreateHabitRequest): Promise<{
        __kind__: "ok";
        ok: HabitPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Create a macro goal (a container). Captured by the goal wizard:
     * / category, wish, outcome (wishDescription). Does NOT accept Lock-In or
     * / schedule fields.
     */
    createMacroGoal(request: CreateMacroGoalRequest): Promise<{
        __kind__: "ok";
        ok: MacroGoalPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
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
    /**
     * / Permanently delete a macro goal and all of its child habits in a single
     * / atomic operation. Removes every child habit's check-ins, timeline
     * / entries, and feed interactions before removing the habits and the goal
     * / itself. All-or-nothing: partial failure cannot leave dangling habits.
     * / Hard-delete is final — no soft-delete or recoverable state.
     */
    deleteGoal(goalId: GoalId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Permanently delete a single habit in one atomic operation. Removes the
     * / habit's check-ins, timeline entries, and feed interactions before
     * / removing the habit itself. All-or-nothing: partial failure cannot leave
     * / dangling check-ins. Hard-delete is final — no soft-delete or recoverable
     * / state. Scoped to one habit — does not touch the parent macro goal or
     * / sibling habits.
     */
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
    getApiDoc(): Promise<string>;
    getCheckInsForGoal(goalId: GoalId): Promise<Array<CheckIn>>;
    getCheckInsForGoalTimeline(goalId: GoalId, fromTimestamp: bigint): Promise<Array<CheckIn>>;
    getCheckInsForPeriod(goalId: GoalId, fromTimestamp: bigint, toTimestamp: bigint): Promise<Array<CheckIn>>;
    /**
     * / Retrieve a habit by ID. Only the owning caller can see it.
     */
    getHabit(habitId: GoalId): Promise<HabitPublic | null>;
    getInteractionCount(checkInId: CheckInId): Promise<bigint>;
    /**
     * / Retrieve a macro goal by ID. Only the owning caller can see it.
     */
    getMacroGoal(goalId: GoalId): Promise<MacroGoalPublic | null>;
    getMyProfile(): Promise<UserProfilePublic>;
    getPartnerFeed(): Promise<Array<FeedItem>>;
    /**
     * / Returns the full habit detail for a single partner. Returns #notPartner
     * / for any non-partner, pending-only, or unconnected caller — no habit data
     * / leaks.
     */
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
    /**
     * / List habits linked to a specific macro goal (by parent goalId).
     */
    listHabitsByParent(parentGoalId: GoalId): Promise<{
        __kind__: "ok";
        ok: Array<HabitPublic>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listMyCheckIns(): Promise<Array<CheckIn>>;
    /**
     * / List the caller's macro goals, each grouped with its linked habits.
     * / Supports the dashboard grouping requirement.
     */
    listMyGoals(): Promise<Array<GoalWithHabitsPublic>>;
    /**
     * / Returns the caller's reusable macro goals for the wizard chips.
     * / Each entry exposes id, wish, wishDescription, state, and category.
     */
    listMyReusableGoals(): Promise<Array<ReusableGoalPublic>>;
    /**
     * / Returns an overview row for every accepted, mutual partner of the
     * / caller. Each row has the partner's profile, active habit count, and
     * / current streak. Pending requests and non-partners are never included.
     */
    listPartnerOverviews(): Promise<Array<PartnerOverview>>;
    listPendingRequests(): Promise<Array<ConnectionPublic>>;
    markCheckInIfThenUsed(checkInId: CheckInId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: Variant_notFound_unauthorized;
    }>;
    recordCheckIn(request: RecordCheckInRequest): Promise<CheckIn>;
    recordInteraction(checkInId: CheckInId, interactionType: InteractionType): Promise<Interaction>;
    register(username: string): Promise<UserProfilePublic>;
    /**
     * / Resolves a built-in obstacle label to one of the seven fixed built-in
     * / obstacles. The match is case-insensitive on the built-in title. If the
     * / label is not one of the seven built-ins, the call traps — a custom
     * / obstacle can never be created. Returns the matching built-in
     * / `ObstacleTemplate` with its stable id.
     */
    resolveObstacleLabel(request: ResolveObstacleRequest): Promise<ObstacleTemplate>;
    respondToConnection(connectionId: ConnectionId, accept: boolean): Promise<boolean>;
    schema(): Promise<string>;
    sendConnectionRequest(target: UserId): Promise<ConnectionPublic>;
    setTimezone(tz: string): Promise<void>;
    /**
     * / Transition a goal (macro or habit) to a new state.
     */
    updateGoalState(goalId: GoalId, newState: GoalState): Promise<boolean>;
    /**
     * / Update an editable habit. wish/wishDescription/outcome/category are
     * / immutable (sourced from the parent macro goal).
     */
    updateHabit(habitId: GoalId, request: UpdateHabitRequest): Promise<{
        __kind__: "ok";
        ok: HabitPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    /**
     * / Update an editable macro goal. Only cosmetic fields are editable;
     * / wish/wishDescription/outcome/category are immutable after creation.
     */
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
