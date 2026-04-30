import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type GoalId = bigint;
export type Timestamp = bigint;
export interface RecordCheckInRequest {
    goalId: GoalId;
    checkInType: CheckInType;
    obstacleTemplateId?: ObstacleTemplateId;
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
    wish: string;
    wishDescription: string;
    ifThenPlan: string;
    obstacleTemplateId?: ObstacleTemplateId;
    outcome: string;
}
export type ObstacleTemplateId = bigint;
export type ConnectionId = bigint;
export interface AnalyticsSummary {
    goals: Array<GoalAnalytics>;
    dailySuccessRate30Days: Array<number>;
}
export interface GoalPublic {
    id: GoalId;
    owner: UserId;
    createdAt: Timestamp;
    wish: string;
    wishDescription: string;
    ifThenPlan: string;
    updatedAt: Timestamp;
    state: GoalState;
    obstacleTemplateId?: ObstacleTemplateId;
    outcome: string;
}
export interface UserProfilePublic {
    id: UserId;
    username: string;
    role: UserRole;
    tier: SubscriptionTier;
    goalLimit: bigint;
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
export interface CheckIn {
    id: CheckInId;
    owner: UserId;
    goalId: GoalId;
    checkInType: CheckInType;
    obstacleTemplateId?: ObstacleTemplateId;
    timestamp: Timestamp;
}
export interface FeedItem {
    checkIn: CheckIn;
    goalName: string;
    partnerDisplayName: string;
    highFiveCount: bigint;
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
export interface AdminAuditEntry {
    limit: bigint;
    targetPrincipal: UserId;
    setBy: UserId;
    timestamp: Timestamp;
}
export interface UpdateGoalRequest {
    wish?: string;
    wishDescription?: string;
    ifThenPlan?: string;
}
export enum CheckInType {
    skip = "skip",
    success = "success"
}
export enum ConnectionStatus {
    pending = "pending",
    rejected = "rejected",
    accepted = "accepted"
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
export enum SubscriptionTier {
    tier1 = "tier1",
    tier2 = "tier2",
    tier3 = "tier3"
}
export enum UserRole {
    admin = "admin",
    user = "user"
}
export interface backendInterface {
    createGoal(request: CreateGoalRequest): Promise<GoalPublic>;
    createObstacleTemplate(request: CreateObstacleRequest): Promise<ObstacleTemplate>;
    getAdminAuditLog(): Promise<Array<AdminAuditEntry>>;
    getAnalytics(): Promise<AnalyticsSummary>;
    getCheckInsForGoal(goalId: GoalId): Promise<Array<CheckIn>>;
    getGoal(goalId: GoalId): Promise<GoalPublic | null>;
    getInteractionCount(checkInId: CheckInId): Promise<bigint>;
    getMyProfile(): Promise<UserProfilePublic>;
    getPartnerFeed(): Promise<Array<FeedItem>>;
    getUserProfile(target: UserId): Promise<UserProfilePublic | null>;
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
    setUserGoalLimit(target: UserId, limit: bigint): Promise<void>;
    updateGoal(goalId: GoalId, request: UpdateGoalRequest): Promise<{
        __kind__: "ok";
        ok: GoalPublic;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateGoalState(goalId: GoalId, newState: GoalState): Promise<boolean>;
}
