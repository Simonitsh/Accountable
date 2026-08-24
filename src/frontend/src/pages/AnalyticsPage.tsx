import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/useBackend";
import type { AnalyticsSummary, GoalAnalytics } from "@/types/index";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── CSS variable reader ───────────────────────────────────────────────────────
function useCssColors() {
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const successRaw = style.getPropertyValue("--color-accent-success").trim();
    const mutedRaw = style.getPropertyValue("--muted-foreground").trim();
    const successColor = successRaw.startsWith("oklch")
      ? successRaw
      : `oklch(${successRaw})`;
    const mutedColor = mutedRaw.startsWith("oklch")
      ? mutedRaw
      : `oklch(${mutedRaw})`;
    return { successColor, mutedColor };
  }, []);
}

// ─── React Query hook ─────────────────────────────────────────────────────────
function useAnalytics() {
  const { actor, isFetching } = useBackend();
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics"],
    queryFn: async () => {
      if (!actor) return { goals: [], dailySuccessRate30Days: [] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (
        actor as unknown as Record<string, () => Promise<AnalyticsSummary>>
      ).getAnalytics();
    },
    enabled: !!actor && !isFetching,
    placeholderData: { goals: [], dailySuccessRate30Days: [] },
  });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  glowClass?: string;
}

function StatCard({ label, value, icon, glowClass }: StatCardProps) {
  return (
    <div
      className={`bg-card rounded-xl p-4 flex flex-col gap-2 flex-1 min-w-0 ${glowClass ?? ""}`}
      style={{
        boxShadow:
          "-4px -4px 10px rgba(65,65,75,0.5), 7px 7px 18px rgba(0,0,0,0.85)",
        borderTop: "1px solid rgba(255,255,255,0.12)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-body uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <span className="font-display text-2xl font-semibold text-foreground truncate">
        {value}
      </span>
    </div>
  );
}

// ─── Goal Analytics Card ──────────────────────────────────────────────────────
function GoalAnalyticsCard({
  goal,
  index,
}: { goal: GoalAnalytics; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const completionRate =
    goal.successCount + goal.skipCount + goal.missedCount > 0
      ? Math.round(
          (goal.successCount /
            (goal.successCount + goal.skipCount + goal.missedCount)) *
            100,
        )
      : 0;

  return (
    <div
      className="bg-card rounded-xl overflow-hidden transition-smooth"
      style={{
        boxShadow:
          "-4px -4px 10px rgba(65,65,75,0.5), 7px 7px 18px rgba(0,0,0,0.85)",
        borderTop: "1px solid rgba(255,255,255,0.12)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
      data-ocid={`analytics.goal_card.${index + 1}`}
    >
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-ocid={`analytics.goal_toggle.${index + 1}`}
      >
        {/* Consistency run badge */}
        <div
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 transition-smooth ${
            goal.currentStreak > 0
              ? "shadow-glow-success text-accent-success"
              : "bg-muted text-muted-foreground"
          }`}
          style={
            goal.currentStreak > 0
              ? {
                  backgroundColor: "oklch(var(--color-accent-success) / 0.12)",
                  boxShadow:
                    "0 0 10px 2px oklch(var(--color-accent-success) / 0.2)",
                }
              : undefined
          }
          title={`Days consistent: ${goal.currentStreak}`}
        >
          <Zap
            className={`w-3.5 h-3.5 ${goal.currentStreak > 0 ? "text-accent-success" : "opacity-40"}`}
          />
          <span>{goal.currentStreak}</span>
        </div>

        {/* Goal name + completion */}
        <div className="flex-1 min-w-0">
          <p className="font-display text-sm font-semibold text-foreground truncate">
            {goal.goalName}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {completionRate}%
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded stats */}
      {expanded && (
        <div
          className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-border/20 pt-4"
          data-ocid={`analytics.goal_detail.${index + 1}`}
        >
          <StatMini
            label="Successes"
            value={goal.successCount}
            colorClass="text-accent-success"
          />
          <StatMini
            label="Skips"
            value={goal.skipCount}
            colorClass="text-accent-skip"
          />
          <StatMini
            label="Missed"
            value={goal.missedCount}
            colorClass="text-accent-missed"
          />
        </div>
      )}
    </div>
  );
}

function StatMini({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`font-display text-xl font-bold ${colorClass}`}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
interface TooltipPayload {
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-popover border border-border/40 rounded-lg px-3 py-2 text-xs"
      style={{
        boxShadow:
          "-3px -3px 8px rgba(65,65,75,0.4), 5px 5px 14px rgba(0,0,0,0.8)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <p className="text-muted-foreground">Day {label}</p>
      <p className="text-accent-success font-semibold mt-0.5">
        {Math.round((payload[0].value ?? 0) * 100)}% success
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();
  const { successColor, mutedColor } = useCssColors();

  const summary = data ?? { goals: [], dailySuccessRate30Days: [] };

  // Derived stats
  const activeGoals = summary.goals.length;
  const totalCheckInsThisWeek = summary.goals.reduce(
    (sum, g) => sum + g.successCount + g.skipCount,
    0,
  );
  const overallRate =
    activeGoals > 0
      ? Math.round(
          (summary.goals.reduce(
            (sum, g) =>
              sum +
              (g.successCount + g.skipCount + g.missedCount > 0
                ? g.successCount /
                  (g.successCount + g.skipCount + g.missedCount)
                : 0),
            0,
          ) /
            activeGoals) *
            100,
        )
      : 0;

  // Build chart data — last 30 days
  const chartData = summary.dailySuccessRate30Days.map((rate, i) => ({
    day: i + 1,
    rate: typeof rate === "number" ? rate : 0,
  }));

  const hasData = summary.goals.length > 0;

  return (
    <div
      className="min-h-screen bg-background pb-32"
      data-ocid="analytics.page"
    >
      {/* Page heading */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your 30-day performance overview
        </p>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <section className="px-4 pt-4 pb-2" data-ocid="analytics.stats_strip">
        {isLoading ? (
          <div className="flex gap-3">
            <Skeleton className="h-20 flex-1 rounded-xl" />
            <Skeleton className="h-20 flex-1 rounded-xl" />
            <Skeleton className="h-20 flex-1 rounded-xl" />
          </div>
        ) : (
          <div className="flex gap-3">
            <StatCard
              label="Active Goals"
              value={activeGoals}
              icon={<Target className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Completion"
              value={`${overallRate}%`}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              glowClass={overallRate >= 70 ? "shadow-glow-success" : ""}
            />
            <StatCard
              label="Check-ins"
              value={totalCheckInsThisWeek}
              icon={<TrendingUp className="w-3.5 h-3.5" />}
            />
          </div>
        )}
      </section>

      {/* ── 30-day trend chart ───────────────────────────────────────────────── */}
      <section className="px-4 pt-4 pb-2" data-ocid="analytics.chart_section">
        <div
          className="bg-card rounded-xl p-4"
          style={{
            boxShadow:
              "-4px -4px 10px rgba(65,65,75,0.5), 7px 7px 18px rgba(0,0,0,0.85)",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              30-Day Success Rate
            </h2>
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              No data yet — start checking in!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={successColor}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={successColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(128,128,128,0.15)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: mutedColor }}
                  axisLine={false}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 10, fill: mutedColor }}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke={successColor}
                  strokeWidth={2}
                  fill="url(#successGrad)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: successColor,
                    stroke: "oklch(0.16 0 0)",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Per-goal breakdown ───────────────────────────────────────────────── */}
      <section
        className="px-4 pt-4 flex flex-col gap-3"
        data-ocid="analytics.goals_section"
      >
        <div className="flex items-center gap-2">
          <Zap
            className="w-4 h-4"
            style={{ color: "oklch(var(--color-accent-success))" }}
          />
          <h2 className="font-display text-sm font-semibold text-foreground">
            Days Consistent — Per Goal
          </h2>
        </div>

        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </>
        ) : !hasData ? (
          <div
            className="bg-card rounded-xl flex flex-col items-center justify-center gap-3 py-12 px-6 text-center"
            style={{
              boxShadow:
                "-4px -4px 10px rgba(65,65,75,0.5), 7px 7px 18px rgba(0,0,0,0.85)",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
            }}
            data-ocid="analytics.empty_state"
          >
            <div
              className="w-14 h-14 rounded-full bg-muted flex items-center justify-center"
              style={{
                boxShadow:
                  "inset 2px 2px 5px rgba(0,0,0,0.4), inset -2px -2px 5px rgba(255,255,255,0.04)",
              }}
            >
              <BarChart3 className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-display text-base font-semibold text-foreground">
                No goals yet
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Create your first WOOP goal on the Dashboard to see your
                analytics here.
              </p>
            </div>
          </div>
        ) : (
          summary.goals.map((goal, i) => (
            <GoalAnalyticsCard key={goal.goalId} goal={goal} index={i} />
          ))
        )}
      </section>
    </div>
  );
}
