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
    currentStreak: bigint;
}
export interface CreateGoalRequest {
    startTime?: string;
    intentTimeMinutes?: bigint;
    endTimeMinutes?: bigint;
    emailNotifications?: boolean;
    endTime?: string;
    scheduledDays?: Array<string>;
    startTimeMinutes?: bigint;
    wish: string;
    themeColor?: string;
    wishDescription: string;
    iconName?: string;
    ifThenPlan: string;
    obstacleTemplateId?: ObstacleTemplateId;
    category: GoalCategory;
    isLockIn: boolean;
    reminderOffset?: bigint;
    intentTime?: string;
    outcome: string;
    lockInDurationMinutes?: bigint;
}
export interface AnalyticsSummary {
    goals: Array<GoalAnalytics>;
    dailySuccessRate30Days: Array<number>;
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
export type AvatarColor = string | null;
export type GoalId = bigint;
export type ObstacleTemplateId = bigint;
export type ConnectionId = bigint;
export interface GoalPublic {
    id: GoalId;
    startTime?: string;
    intentTimeMinutes: bigint;
    endTimeMinutes: bigint;
    emailNotifications: boolean;
    endTime?: string;
    scheduledDays: Array<string>;
    owner: UserId;
    lastEditedAt?: Timestamp;
    startTimeMinutes: bigint;
    createdAt: Timestamp;
    wish: string;
    themeColor?: string;
    wishDescription: string;
    iconName?: string;
    ifThenPlan: string;
    updatedAt: Timestamp;
    state: GoalState;
    obstacleTemplateId?: ObstacleTemplateId;
    category: GoalCategory;
    isLockIn: boolean;
    reminderOffset?: bigint;
    intentTime?: string;
    outcome: string;
    lockInDurationMinutes: bigint;
    lastEmailSentAt: bigint;
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
export type InteractionId = bigint;
export interface FeedItem {
    checkIn: CheckIn;
    goalName: string;
    partnerDisplayName: string;
    partnerAvatarColor: AvatarColor;
    highFiveCount: bigint;
    partnerAvatarColorMode: AvatarColorMode;
    partnerAvatarShape: AvatarShape;
}
export interface UpdateGoalRequest {
    startTime?: string;
    intentTimeMinutes?: bigint;
    endTimeMinutes?: bigint;
    emailNotifications?: boolean;
    endTime?: string;
    scheduledDays?: Array<string>;
    timezoneOffsetMinutes: bigint;
    startTimeMinutes?: bigint;
    wish?: string;
    themeColor?: string;
    isTimeEdit?: boolean;
    wishDescription?: string;
    iconName?: string;
    ifThenPlan?: string;
    category?: GoalCategory;
    isLockIn?: boolean;
    reminderOffset?: bigint;
    intentTime?: string;
    outcome?: string;
    lockInDurationMinutes?: bigint;
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
    abandoned = "abandoned",
    paused = "paused"
}
export enum InteractionType {
    highFive = "highFive"
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
    createGoal(request: CreateGoalRequest): Promise<{
        __kind__: "ok";
        ok: GoalPublic;
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
    devReset(): Promise<void>;
    getAnalytics(): Promise<AnalyticsSummary>;
    getCheckInsForGoal(goalId: GoalId): Promise<Array<CheckIn>>;
    getCheckInsForGoalTimeline(goalId: GoalId, fromTimestamp: bigint): Promise<Array<CheckIn>>;
    getCheckInsForPeriod(goalId: GoalId, fromTimestamp: bigint, toTimestamp: bigint): Promise<Array<CheckIn>>;
    getGoal(goalId: GoalId): Promise<GoalPublic | null>;
    getInteractionCount(checkInId: CheckInId): Promise<bigint>;
    getMyProfile(): Promise<UserProfilePublic>;
    getPartnerFeed(): Promise<Array<FeedItem>>;
    getUserProfile(target: UserId): Promise<UserProfilePublic | null>;
    isUsernameAvailable(username: string): Promise<boolean>;
    listAllUsers(): Promise<Array<UserProfilePublic>>;
    listConnections(): Promise<Array<ConnectionPublic>>;
    listMyCheckIns(): Promise<Array<CheckIn>>;
    listMyGoals(): Promise<Array<GoalPublic>>;
    listMyObstacleTemplates(): Promise<Array<ObstacleTemplate>>;
    listPendingRequests(): Promise<Array<ConnectionPublic>>;
    recordCheckIn(request: RecordCheckInRequest): Promise<CheckIn>;
    recordInteraction(checkInId: CheckInId, interactionType: InteractionType): Promise<Interaction>;
    register(username: string): Promise<UserProfilePublic>;
    respondToConnection(connectionId: ConnectionId, accept: boolean): Promise<boolean>;
    sendConnectionRequest(target: UserId): Promise<ConnectionPublic>;
    setTimezone(tz: string): Promise<void>;
    updateGoal(goalId: GoalId, request: UpdateGoalRequest): Promise<{
        __kind__: "ok";
        ok: GoalPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateGoalState(goalId: GoalId, newState: GoalState): Promise<boolean>;
    updateMyProfile(displayName: string | null, avatarShape: AvatarShape, avatarColor: AvatarColor, avatarColorMode: AvatarColorMode | null, bio: string | null, email: string | null, timezoneOffsetMinutes: bigint | null): Promise<{
        __kind__: "ok";
        ok: UserProfilePublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
}
