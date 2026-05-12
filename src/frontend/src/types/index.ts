export type UserRole = "user" | "admin";
export type GoalState = "active" | "completed" | "archived";
export type CheckInType = "success" | "skip" | "inProgress" | "failedLockIn";
export type ConnectionStatus = "pending" | "accepted" | "rejected";

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  goalLimit: number;
}

export interface Goal {
  id: string;
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
  startTime?: string;
  endTime?: string;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface CheckIn {
  id: string;
  goalId: string;
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
  highFiveCount: number;
}

export interface GoalAnalytics {
  goalId: string;
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

export interface ObstacleTemplate {
  id: string;
  label: string;
  description: string;
}

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
];
