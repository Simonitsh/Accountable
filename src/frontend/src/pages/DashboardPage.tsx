import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, Target } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GoalCard } from "../components/GoalCard";
import WoopWizard from "../components/WoopWizard";
import { useBackend } from "../hooks/useBackend";
import { useUserProfile } from "../hooks/useUserProfile";
import type { CheckIn, CheckInType, Goal, GoalAnalytics } from "../types";
import { TIER_GOAL_LIMITS, TIER_LABELS } from "../types";

// ─── Types matching backend ────────────────────────────────────────────────────
interface GoalPublic {
  id: string;
  owner: string;
  wish: string;
  wishDescription: string;
  outcome: string;
  obstacleTemplateId: [] | [string];
  ifThenPlan: string;
  state: { active: null } | { completed: null } | { archived: null };
  createdAt: bigint;
  updatedAt: bigint;
}

interface BackendCheckIn {
  id: string;
  goalId: string;
  owner: string;
  checkInType: { success: null } | { skip: null };
  obstacleTemplateId: [] | [string];
  timestamp: bigint;
}

interface RecordCheckInRequest {
  goalId: string;
  checkInType: { success: null } | { skip: null };
  obstacleTemplateId: [] | [string];
}

// ─── Normalizers ──────────────────────────────────────────────────────────────
function normalizeGoal(g: GoalPublic): Goal {
  return {
    id: g.id,
    owner: g.owner,
    wish: g.wish,
    wishDescription: g.wishDescription,
    outcome: g.outcome,
    obstacleTemplateId: g.obstacleTemplateId[0] ?? undefined,
    ifThenPlan: g.ifThenPlan,
    state:
      "active" in g.state
        ? "active"
        : "completed" in g.state
          ? "completed"
          : "archived",
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

function normalizeCheckIn(c: BackendCheckIn): CheckIn {
  return {
    id: c.id,
    goalId: c.goalId,
    owner: c.owner,
    checkInType: ("success" in c.checkInType
      ? "success"
      : "skip") as CheckInType,
    obstacleTemplateId: c.obstacleTemplateId[0] ?? undefined,
    timestamp: c.timestamp,
  };
}

function isTodayTimestamp(ts: bigint): boolean {
  const ms = Number(ts / 1_000_000n);
  const d = new Date(ms);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ─── Mock data for UI development (used when actor unavailable) ───────────────
const MOCK_GOALS: Goal[] = [
  {
    id: "mock-1",
    owner: "mock",
    wish: "30-Minute Deep Work Session",
    wishDescription:
      "Uninterrupted focus to move my most important project forward.",
    outcome: "Ship meaningful work daily, build a deep-work habit.",
    obstacleTemplateId: "distraction",
    ifThenPlan:
      "If I feel distracted, I will close all tabs and set a 30-min timer.",
    state: "active",
    createdAt: BigInt(Date.now()) * 1_000_000n,
    updatedAt: BigInt(Date.now()) * 1_000_000n,
  },
  {
    id: "mock-2",
    owner: "mock",
    wish: "20-Minute Morning Run",
    wishDescription: "Start the day with movement to energize body and mind.",
    outcome: "Build cardiovascular fitness and mental resilience.",
    obstacleTemplateId: "low_energy",
    ifThenPlan:
      "If I feel too tired, I will do just 5 minutes — starting is the hardest part.",
    state: "active",
    createdAt: BigInt(Date.now()) * 1_000_000n,
    updatedAt: BigInt(Date.now()) * 1_000_000n,
  },
];

// ─── Daily Progress Ring ───────────────────────────────────────────────────────
interface ProgressRingProps {
  completed: number;
  total: number;
  isComplete: boolean;
}

function ProgressRing({ completed, total, isComplete }: ProgressRingProps) {
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? completed / total : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      data-ocid="dashboard.progress_ring"
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(var(--muted))"
          strokeWidth={strokeWidth}
          opacity={0.5}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(var(--color-accent-success))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)",
            filter: isComplete
              ? "drop-shadow(0 0 8px oklch(var(--color-accent-success) / 0.7))"
              : "drop-shadow(0 0 4px oklch(var(--color-accent-success) / 0.35))",
          }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold leading-none"
          style={{
            fontSize: "1.25rem",
            color: isComplete
              ? "oklch(var(--color-accent-success))"
              : "oklch(var(--foreground))",
          }}
        >
          {completed}/{total}
        </span>
        <span className="text-xs text-muted-foreground mt-0.5 font-mono">
          today
        </span>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────────
export function DashboardPage() {
  const [showWoop, setShowWoop] = useState(false);
  const { actor, isFetching } = useBackend();
  const { data: profile } = useUserProfile();
  const queryClient = useQueryClient();

  // ── Fetch goals ──
  const { data: rawGoals, isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["myGoals"],
    queryFn: async () => {
      if (!actor || !("listMyGoals" in actor)) return MOCK_GOALS;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (actor as any).listMyGoals();
        return (result as GoalPublic[]).map(normalizeGoal);
      } catch {
        return MOCK_GOALS;
      }
    },
    enabled: !isFetching,
    staleTime: 30_000,
  });

  // ── Fetch today's check-ins ──
  const { data: rawCheckIns, isLoading: checkInsLoading } = useQuery<CheckIn[]>(
    {
      queryKey: ["myCheckIns"],
      queryFn: async () => {
        if (!actor || !("listMyCheckIns" in actor)) return [];
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (actor as any).listMyCheckIns();
          return (result as BackendCheckIn[]).map(normalizeCheckIn);
        } catch {
          return [];
        }
      },
      enabled: !isFetching,
      staleTime: 30_000,
    },
  );

  const goals = rawGoals ?? [];
  const checkIns = rawCheckIns ?? [];
  const isLoading = goalsLoading || checkInsLoading;

  // Map goalId → today's check-in
  const todayCheckInMap = useMemo(() => {
    const map = new Map<string, CheckIn>();
    for (const c of checkIns) {
      if (isTodayTimestamp(c.timestamp)) {
        map.set(c.goalId, c);
      }
    }
    return map;
  }, [checkIns]);

  // Per-goal analytics (derived from check-ins)
  const analyticsMap = useMemo(() => {
    const map = new Map<string, GoalAnalytics>();
    for (const g of goals) {
      const goalCheckIns = checkIns.filter((c) => c.goalId === g.id);
      const successCount = goalCheckIns.filter(
        (c) => c.checkInType === "success",
      ).length;
      const skipCount = goalCheckIns.filter(
        (c) => c.checkInType === "skip",
      ).length;
      // Consistency run: consecutive success days backwards from today
      let consistencyRun = 0;
      const dayMs = 86_400_000;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let d = 0; d < 365; d++) {
        const dayStart = today.getTime() - d * dayMs;
        const dayEnd = dayStart + dayMs;
        const dayHit = goalCheckIns.some((c) => {
          const ms = Number(c.timestamp / 1_000_000n);
          return ms >= dayStart && ms < dayEnd && c.checkInType === "success";
        });
        if (dayHit) consistencyRun++;
        else if (d > 0) break;
      }
      map.set(g.id, {
        goalId: g.id,
        goalName: g.wish,
        successCount,
        skipCount,
        missedCount: 0,
        currentStreak: consistencyRun,
      });
    }
    return map;
  }, [goals, checkIns]);

  // ── Check-in mutation ──
  const [checkingInGoalId, setCheckingInGoalId] = useState<string | null>(null);
  const [skippingGoalId, setSkippingGoalId] = useState<string | null>(null);

  const checkInMutation = useMutation({
    mutationFn: async (req: RecordCheckInRequest) => {
      if (!actor || !("recordCheckIn" in actor)) {
        return { ok: true };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).recordCheckIn(req);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
      const type = "success" in variables.checkInType ? "success" : "skip";
      if (type === "success") {
        toast.success("Checked in! Keep building consistency.");
      } else {
        toast.info("Skip logged — every honest check-in counts.");
      }
    },
    onError: () => {
      toast.error("Check-in failed. Please try again.");
    },
    onSettled: () => {
      setCheckingInGoalId(null);
      setSkippingGoalId(null);
    },
  });

  function handleCheckIn(goalId: string) {
    setCheckingInGoalId(goalId);
    checkInMutation.mutate({
      goalId,
      checkInType: { success: null },
      obstacleTemplateId: [],
    });
  }

  function handleSkip(goalId: string, obstacleId: string) {
    setSkippingGoalId(goalId);
    checkInMutation.mutate({
      goalId,
      checkInType: { skip: null },
      obstacleTemplateId: [obstacleId],
    });
  }

  // ── Tier info ──
  const tier = profile?.tier ?? 1;
  const goalLimit = TIER_GOAL_LIMITS[tier];
  const activeGoalCount = goals.filter((g) => g.state === "active").length;
  const approachingLimit = activeGoalCount >= Math.floor(goalLimit * 0.8);

  const todayCompleted = [...todayCheckInMap.values()].filter(
    (c) => c.checkInType === "success",
  ).length;
  const totalActive = goals.filter((g) => g.state === "active").length;
  const hasSkipToday = [...todayCheckInMap.values()].some(
    (c) => c.checkInType === "skip",
  );
  const isAllComplete = totalActive > 0 && todayCompleted === totalActive;

  // Derive first name from profile username
  const firstName = profile?.username
    ? (() => {
        const word = profile.username.split(" ")[0];
        return word.charAt(0).toUpperCase() + word.slice(1);
      })()
    : null;

  // Behavioral hook message
  function getBehavioralMessage(): string | null {
    if (isLoading) return null;
    if (totalActive === 0) return null;
    if (todayCompleted === totalActive) return "Day won. Disconnect and rest.";
    if (hasSkipToday && todayCompleted < totalActive)
      return `Smart pivot, ${firstName ?? "you"}. Valid obstacle.`;
    if (todayCompleted > 0 && todayCompleted < totalActive)
      return `${todayCompleted}/${totalActive} complete. Momentum is building.`;
    return `Ready to execute, ${firstName ?? "you"}?`;
  }

  const behavioralMessage = getBehavioralMessage();

  return (
    <div className="flex flex-col gap-6 px-4 pb-6">
      {/* Date + greeting header */}
      <div className="pt-2">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="font-display text-2xl font-bold text-foreground mt-1">
          Today&apos;s Dashboard
        </h1>
      </div>

      {/* Tier warning */}
      {approachingLimit && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-4 py-3 flex items-center justify-between border"
          style={{
            backgroundColor: "oklch(var(--color-accent-social) / 0.08)",
            borderColor: "oklch(var(--color-accent-social) / 0.25)",
          }}
          data-ocid="dashboard.tier_warning"
        >
          <div>
            <p className="text-sm font-display font-semibold text-foreground">
              {activeGoalCount}/{goalLimit} goals — {TIER_LABELS[tier]} plan
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upgrade to track more habits simultaneously
            </p>
          </div>
          <ChevronRight
            className="w-4 h-4"
            style={{ color: "oklch(var(--color-accent-social))" }}
          />
        </motion.div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4" data-ocid="dashboard.loading_state">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="rounded-2xl p-5 animate-pulse"
              style={{
                backgroundColor: "oklch(var(--card))",
                boxShadow:
                  "6px 6px 12px rgba(0,0,0,0.5), -4px -4px 10px rgba(255,255,255,0.04)",
              }}
            >
              <div className="h-3 w-24 rounded-full bg-muted mb-3" />
              <div className="h-6 w-3/4 rounded-full bg-muted mb-2" />
              <div className="h-4 w-1/2 rounded-full bg-muted mb-6" />
              <div className="h-10 rounded-xl bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && goals.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl"
          style={{
            backgroundColor: "oklch(var(--card))",
            boxShadow:
              "6px 6px 12px rgba(0,0,0,0.5), -4px -4px 10px rgba(255,255,255,0.04)",
          }}
          data-ocid="dashboard.empty_state"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{
              backgroundColor: "oklch(var(--color-accent-success) / 0.1)",
              boxShadow:
                "0 0 32px 4px oklch(var(--color-accent-success) / 0.15)",
            }}
          >
            <Target
              className="w-8 h-8"
              style={{ color: "oklch(var(--color-accent-success))" }}
            />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2">
            No active goals yet
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
            Build your first keystone habit using the WOOP framework — backed by
            decades of behavioral science research.
          </p>
          <button
            type="button"
            onClick={() => setShowWoop(true)}
            className="flex items-center gap-2 rounded-xl px-6 py-3 font-display font-semibold text-sm transition-smooth"
            style={{
              backgroundColor: "oklch(var(--color-accent-success) / 0.14)",
              color: "oklch(var(--color-accent-success))",
              boxShadow:
                "0 0 16px 2px oklch(var(--color-accent-success) / 0.2)",
            }}
            data-ocid="dashboard.create_first_goal_button"
          >
            <Plus className="w-4 h-4" />
            Create Your First Goal
          </button>
        </motion.div>
      )}

      {/* Dynamic Behavioral Hook + Progress Ring */}
      {!isLoading && totalActive > 0 && (
        <div
          className="rounded-2xl px-5 py-5 flex flex-col items-center gap-4"
          style={{
            background: "oklch(0.18 0.01 260)",
            boxShadow:
              "inset 2px 2px 6px oklch(0.12 0.01 260), inset -2px -2px 6px oklch(0.24 0.01 260)",
          }}
          data-ocid="dashboard.progress_section"
        >
          {/* Behavioral Hook text */}
          {behavioralMessage && (
            <motion.p
              key={behavioralMessage}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              style={{
                color: "oklch(0.58 0.02 260)",
                fontSize: "0.95rem",
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: "0.01em",
                textAlign: "center",
              }}
              data-ocid="dashboard.behavioral_hook"
            >
              {behavioralMessage}
            </motion.p>
          )}

          {/* Progress Ring */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <ProgressRing
              completed={todayCompleted}
              total={totalActive}
              isComplete={isAllComplete}
            />
          </motion.div>
        </div>
      )}

      {/* Goal cards */}
      {!isLoading && goals.length > 0 && (
        <div className="space-y-4" data-ocid="dashboard.goal_list">
          {goals
            .filter((g) => g.state === "active")
            .map((goal, index) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                checkInToday={todayCheckInMap.get(goal.id)}
                analytics={analyticsMap.get(goal.id)}
                index={index}
                onCheckIn={handleCheckIn}
                onSkip={handleSkip}
                isCheckingIn={
                  checkingInGoalId === goal.id && checkInMutation.isPending
                }
                isSkipping={
                  skippingGoalId === goal.id && checkInMutation.isPending
                }
              />
            ))}
        </div>
      )}

      {/* Floating Action Button */}
      {!isLoading && goals.length > 0 && activeGoalCount < goalLimit && (
        <motion.button
          type="button"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", damping: 20 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowWoop(true)}
          className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center transition-smooth"
          style={{
            backgroundColor: "oklch(var(--color-accent-success) / 0.18)",
            boxShadow:
              "0 0 24px 4px oklch(var(--color-accent-success) / 0.25), 6px 6px 12px rgba(0,0,0,0.5), -4px -4px 10px rgba(255,255,255,0.04)",
          }}
          aria-label="Create new goal"
          data-ocid="dashboard.fab_button"
        >
          <Plus
            className="w-6 h-6"
            style={{ color: "oklch(var(--color-accent-success))" }}
          />
        </motion.button>
      )}

      {/* WOOP Wizard */}
      <WoopWizard
        open={showWoop}
        onClose={() => setShowWoop(false)}
        onGoalCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["myGoals"] })
        }
      />
    </div>
  );
}
