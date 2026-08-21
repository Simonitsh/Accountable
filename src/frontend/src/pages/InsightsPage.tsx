import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/useBackend";
import type { AnalyticsSummary, GoalAnalytics } from "@/types/index";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Route,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

// ─── Shared neumorphic surface style ──────────────────────────────────────────
const NEUMORPHIC = {
  boxShadow: "-4px -4px 10px rgba(65,65,75,0.5), 7px 7px 18px rgba(0,0,0,0.85)",
  borderTop: "1px solid rgba(255,255,255,0.12)",
  borderLeft: "1px solid rgba(255,255,255,0.06)",
} as const;

// ─── Entrance choreography ────────────────────────────────────────────────────
const EASE = [0.22, 1, 0.36, 1] as const;

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
      style={NEUMORPHIC}
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

// ─── Hero insight slot ────────────────────────────────────────────────────────
function HeroInsightSlot() {
  return (
    <div
      className="bg-card rounded-2xl p-6 relative overflow-hidden"
      style={{
        ...NEUMORPHIC,
        boxShadow:
          "-6px -6px 16px rgba(65,65,75,0.55), 10px 10px 26px rgba(0,0,0,0.9)",
      }}
      data-ocid="insights.hero_slot"
    >
      {/* Soft emerald wash — calm, not a stat */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, oklch(var(--color-accent-success) / 0.16), transparent 70%)",
        }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0"
          style={{
            boxShadow:
              "inset 2px 2px 5px rgba(0,0,0,0.4), inset -2px -2px 5px rgba(255,255,255,0.04)",
          }}
        >
          <Sparkles className="w-5 h-5 text-accent-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-foreground">
            Your most important insight
          </p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            This is where your biggest win will live — the one pattern that
            keeps your momentum going.
          </p>
        </div>
      </div>

      {/* Tasteful skeleton body */}
      <div className="relative mt-5 flex flex-col gap-3">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <div className="flex items-center gap-2 mt-1">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// ─── Insight card slot ────────────────────────────────────────────────────────
interface InsightSlotProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}

function InsightSlot({ icon, title, description, accent }: InsightSlotProps) {
  return (
    <div
      className="bg-card rounded-xl p-4 flex items-start gap-3"
      style={NEUMORPHIC}
      data-ocid="insights.insight_slot"
    >
      <div
        className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"
        style={{
          boxShadow:
            "inset 2px 2px 5px rgba(0,0,0,0.4), inset -2px -2px 5px rgba(255,255,255,0.04)",
        }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {description}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-2/3 rounded-md" />
        </div>
      </div>
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
      style={NEUMORPHIC}
      data-ocid={`insights.goal_card.${index + 1}`}
    >
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-ocid={`insights.goal_toggle.${index + 1}`}
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
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-border/20 pt-4"
              data-ocid={`insights.goal_detail.${index + 1}`}
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
          </motion.div>
        )}
      </AnimatePresence>
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
export function InsightsPage() {
  const { data, isLoading } = useAnalytics();
  const { successColor, mutedColor } = useCssColors();
  const reduceMotion = useReducedMotion();

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

  // Entrance variants — disabled entirely under reduced motion
  const entrance = reduceMotion
    ? { initial: false, animate: {}, transition: undefined }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3, ease: EASE },
      };

  const stagger = (delay: number) =>
    reduceMotion ? {} : { transition: { duration: 0.3, ease: EASE, delay } };

  const insightSlots = [
    {
      icon: <Route className="w-5 h-5" />,
      title: "If-then effectiveness",
      description: "See which planned responses actually carried you through.",
      accent: "oklch(var(--color-accent-success))",
    },
    {
      icon: <CalendarDays className="w-5 h-5" />,
      title: "Your best day",
      description: "Spot the day of the week your momentum peaks.",
      accent: "oklch(var(--color-accent-skip))",
    },
    {
      icon: <Layers className="w-5 h-5" />,
      title: "Category breakdown",
      description: "How your energy flows across each area of life.",
      accent: "oklch(var(--color-accent-social))",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Obstacle pattern",
      description: "The recurring hurdle to plan around next.",
      accent: "oklch(var(--color-accent-missed))",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-32" data-ocid="insights.page">
      {/* Page heading */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Insights
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Patterns that keep your momentum going
        </p>
      </div>

      {/* ── Hero insight slot ─────────────────────────────────────────────── */}
      <motion.section
        className="px-4 pt-4"
        data-ocid="insights.hero_section"
        {...entrance}
      >
        <HeroInsightSlot />
      </motion.section>

      {/* ── Insight card slots ────────────────────────────────────────────── */}
      <section
        className="px-4 pt-4 flex flex-col gap-3"
        data-ocid="insights.slots_section"
      >
        {insightSlots.map((slot, i) => (
          <motion.div
            key={slot.title}
            {...entrance}
            {...stagger(0.06 * (i + 1))}
          >
            <InsightSlot {...slot} />
          </motion.div>
        ))}
      </section>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <motion.section
        className="px-4 pt-6 pb-2"
        data-ocid="insights.stats_strip"
        {...entrance}
        {...stagger(0.3)}
      >
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
      </motion.section>

      {/* ── 30-day trend chart ────────────────────────────────────────────── */}
      <motion.section
        className="px-4 pt-4 pb-2"
        data-ocid="insights.chart_section"
        {...entrance}
        {...stagger(0.38)}
      >
        <div className="bg-card rounded-xl p-4" style={NEUMORPHIC}>
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
              Check in a few times to unlock your momentum curve.
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
      </motion.section>

      {/* ── Per-goal breakdown ─────────────────────────────────────────────── */}
      <motion.section
        className="px-4 pt-4 flex flex-col gap-3"
        data-ocid="insights.goals_section"
        {...entrance}
        {...stagger(0.46)}
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
            style={NEUMORPHIC}
            data-ocid="insights.empty_state"
          >
            <div
              className="w-14 h-14 rounded-full bg-muted flex items-center justify-center"
              style={{
                boxShadow:
                  "inset 2px 2px 5px rgba(0,0,0,0.4), inset -2px -2px 5px rgba(255,255,255,0.04)",
              }}
            >
              <Sparkles className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-display text-base font-semibold text-foreground">
                Your insights are on the way
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Check in a few times to unlock your insights and see your
                momentum take shape.
              </p>
            </div>
          </div>
        ) : (
          summary.goals.map((goal, i) => (
            <GoalAnalyticsCard key={goal.goalId} goal={goal} index={i} />
          ))
        )}
      </motion.section>
    </div>
  );
}
