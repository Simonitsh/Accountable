import { GoalCategory } from "@/backend";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/useBackend";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  OBSTACLE_EVIDENCE_MIN,
  aggregateObstacles,
  rankActualObstacles,
  rankExpectedObstacles,
  totalActualOccurrences,
} from "@/lib/insights";
import type {
  AnalyticsSummary,
  CategoryStat,
  IfThenEffectiveness,
} from "@/types/index";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarDays,
  CloudOff,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Palette,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

// ─── React Query hook ────────────────────────────────────────────────────────
// Fetches the Insights summary from the backend. The page renders polished
// placeholder sections for this step; this hook keeps the data contract ready
// so real values can be wired in during a follow-up step without reshaping.
function useInsights() {
  const { actor, actorReady } = useBackend();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const timezoneOffsetMinutes = profile?.timezoneOffsetMinutes ?? 0n;

  const query = useQuery<AnalyticsSummary>({
    queryKey: ["analytics", timezoneOffsetMinutes.toString()],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getAnalytics(timezoneOffsetMinutes);
    },
    // Wait for the profile before the first request: firing with the default
    // offset 0 would bucket check-ins into the wrong local day, then refetch
    // once the real offset arrives. Gate on the profile having loaded so the
    // first request already carries the correct offset.
    enabled: !!actor && actorReady && !profileLoading && !!profile,
  });

  // TanStack Query v5 reports `isLoading` as false for a DISABLED query, so
  // while the profile is still loading the insights query is disabled and
  // `isLoading` stays false — the page would skip the skeleton and flash the
  // warm "gathering data" placeholders. Treat the profile-loading window as
  // loading too so the skeleton covers the whole wait.
  return { ...query, isLoading: profileLoading || query.isLoading };
}

// ─── Category metadata ───────────────────────────────────────────────────────
const CATEGORY_ROWS = [
  { category: GoalCategory.Health, label: "Health", icon: HeartPulse },
  { category: GoalCategory.Learning, label: "Learning", icon: GraduationCap },
  { category: GoalCategory.Social, label: "Social", icon: Users },
  {
    category: GoalCategory.Productivity,
    label: "Productivity",
    icon: Briefcase,
  },
  { category: GoalCategory.Leisure, label: "Leisure", icon: Palette },
] as const;

// ─── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          backgroundColor: "oklch(var(--color-accent-success) / 0.12)",
          boxShadow:
            "inset 2px 2px 5px rgba(0,0,0,0.4), inset -2px -2px 5px rgba(255,255,255,0.04)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Highlight card ──────────────────────────────────────────────────────────
// Minimum data points on EITHER side of the used-vs-not-used comparison before
// we surface a real number. Below this, the warm "gathering data" state stays.
const MIN_DATA_POINTS = 3;

// The if-then card needs a deeper history than the rest of the page before it
// compares the two sides — 20 days on each side. Kept separate from
// MIN_DATA_POINTS so the other sections keep their lighter gate.
const IF_THEN_MIN_PER_SIDE = 20;

function HighlightCard({
  effectiveness,
}: {
  effectiveness?: IfThenEffectiveness;
}) {
  const used = effectiveness?.usedPlan;
  const notUsed = effectiveness?.notUsedPlan;

  const hasEnoughData =
    !!used &&
    !!notUsed &&
    used.total >= BigInt(IF_THEN_MIN_PER_SIDE) &&
    notUsed.total >= BigInt(IF_THEN_MIN_PER_SIDE);

  // Default to the warm gathering state; only override when there's enough
  // data on both sides to make the comparison meaningful.
  let headline = "Your plans are taking shape";
  let subtitle =
    "We're gathering how often your if-then plans help you follow through. Soon you'll see your momentum here.";
  let followThroughValue = "—";
  let progressWidth = "0%";
  let caption = `${
    used?.total ?? 0n
  } of ${IF_THEN_MIN_PER_SIDE} days with your plan so far.`;

  if (hasEnoughData) {
    const usedPct = Math.round(used.rate * 100);
    const notUsedPct = Math.round(notUsed.rate * 100);

    // Plain percentages only — no multiplier, no rounding up. A clear
    // difference needs the plan side to lead by at least 10 points; anything
    // else (including the plan side being lower) stays neutral and never
    // grades the user.
    headline =
      usedPct >= notUsedPct + 10
        ? "Your plan tends to help"
        : "No clear difference yet";
    subtitle = `You followed through ${usedPct}% of the time on days you used your plan, and ${notUsedPct}% on days you didn't.`;
    followThroughValue = `${usedPct}%`;
    progressWidth = `${usedPct}%`;
    caption = `Based on ${used.total} days with your plan and ${notUsed.total} without. This shows a pattern, not a cause.`;
  }

  return (
    <div className="card-neumorphic p-5" data-ocid="insights.highlight_card">
      <div className="flex items-center gap-2 text-accent-success">
        <Sparkles className="w-4 h-4" />
        <span className="text-xs font-body uppercase tracking-wider text-muted-foreground">
          If-then plans
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "oklch(var(--color-accent-success) / 0.14)",
            boxShadow:
              "inset 3px 3px 6px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(255,255,255,0.05)",
          }}
        >
          <Zap className="w-7 h-7 text-accent-success" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-foreground leading-snug">
            {headline}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">Follow-through</span>
          <span className="text-accent-success font-semibold">
            {followThroughValue}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: progressWidth }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{caption}</p>
      </div>
    </div>
  );
}

// ─── Best / worst day ────────────────────────────────────────────────────────
function DayCard({
  label,
  icon,
  accent,
  value,
  caption,
}: {
  label: string;
  icon: React.ReactNode;
  accent: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="card-neumorphic p-4 flex-1 min-w-0">
      <div className="flex items-center gap-2 text-xs font-body uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`font-display text-xl font-semibold mt-3 ${accent}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{caption}</p>
    </div>
  );
}

function BestWorstDaySection({ data }: { data?: AnalyticsSummary }) {
  // The backend already decides whether a standout day exists: it returns
  // null (undefined) until there is enough data behind the comparison, so the
  // frontend trusts that result instead of re-gating on its own threshold.
  const dayStat = (index?: bigint) =>
    data?.dayOfWeek.find((s) => s.dayOfWeek === index);

  const bestStat = dayStat(data?.bestDayOfWeek);
  const worstStat = dayStat(data?.worstDayOfWeek);

  const bestReady = !!bestStat && !!bestStat.dayName;
  const worstReady = !!worstStat && !!worstStat.dayName;

  const bestValue = bestReady ? bestStat.dayName : "—";
  const worstValue = worstReady ? worstStat.dayName : "—";

  const bestCaption = bestReady
    ? "Your strongest follow-through day so far."
    : "We'll show your standout day here once there's enough data.";
  const worstCaption = worstReady
    ? "A gentle heads-up — this day could use a little extra support."
    : "We'll show your standout day here once there's enough data.";

  return (
    <section className="px-4 pt-6" data-ocid="insights.day_section">
      <SectionHeading
        icon={<CalendarDays className="w-4 h-4 text-accent-success" />}
        title="Your week, at a glance"
        subtitle="Which days tend to go best and worst for you"
      />
      <div className="mt-4 flex gap-3">
        <DayCard
          label="Best day"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          accent="text-accent-success"
          value={bestValue}
          caption={bestCaption}
        />
        <DayCard
          label="Toughest day"
          icon={<CalendarDays className="w-3.5 h-3.5" />}
          accent="text-accent-skip"
          value={worstValue}
          caption={worstCaption}
        />
      </div>
    </section>
  );
}

// ─── Category breakdown ──────────────────────────────────────────────────────
function CategoryBreakdownSection({ data }: { data?: AnalyticsSummary }) {
  const statByCategory = useMemo(() => {
    const map = new Map<GoalCategory, CategoryStat>();
    for (const stat of data?.categoryBreakdown ?? []) {
      map.set(stat.category, stat);
    }
    return map;
  }, [data]);

  return (
    <section className="px-4 pt-6" data-ocid="insights.category_section">
      <SectionHeading
        icon={<Lightbulb className="w-4 h-4 text-accent-success" />}
        title="Progress by category"
        subtitle="How you're doing across Health, Learning, Social, Productivity, and Leisure"
      />
      <div className="card-neumorphic mt-4 p-4 flex flex-col gap-4">
        {CATEGORY_ROWS.map((cat) => {
          const Icon = cat.icon;
          const stat = statByCategory.get(cat.category);

          // Three states per category, driven by the backend's habitCount:
          //  - no habits in the category → "Nothing here yet"
          //  - habits but too little check-in data → warm gathering state
          //  - enough data → real rate + progress
          let value = "—";
          let progressWidth = "0%";
          let hint: string | null = null;

          if (!stat || stat.habitCount === 0n) {
            hint = "Nothing here yet";
          } else if (stat.total < BigInt(MIN_DATA_POINTS)) {
            hint = "Gathering a little more data…";
          } else {
            const pct = Math.round(stat.rate * 100);
            value = `${pct}%`;
            progressWidth = `${pct}%`;
          }

          return (
            <div key={cat.category} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "oklch(var(--muted) / 0.6)",
                  boxShadow:
                    "inset 2px 2px 4px rgba(0,0,0,0.4), inset -1px -1px 3px rgba(255,255,255,0.04)",
                }}
              >
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-body font-medium text-foreground">
                    {cat.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{value}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: progressWidth }}
                  />
                </div>
                {hint && (
                  <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Your category progress will appear here as you check in.
        </p>
      </div>
    </section>
  );
}

// ─── Obstacles: what gets in the way vs expected ─────────────────────────────
// The ranking and aggregation live in lib/insights.ts as pure helpers so they
// can be unit-tested. This section only reads their results.
function ObstaclesSection({ data }: { data?: AnalyticsSummary }) {
  const habits = data?.habits ?? [];

  // Predicted obstacles are pooled once by the backend and read straight from
  // the summary — no client-side re-pooling. Actual obstacles come from the
  // check-ins that actually got in the way, so they are pooled here across ALL
  // habits and ranked by genuine count.
  const predicted = useMemo(() => data?.predictedObstaclePool ?? [], [data]);
  const actual = useMemo(
    () => aggregateObstacles(habits.flatMap((h) => h.actualObstacles)),
    [habits],
  );

  // Gate on obstacle evidence: only surface real rows once the total number of
  // recorded actual obstacle occurrences across all habits reaches the
  // threshold.
  const hasEnoughData =
    totalActualOccurrences(actual) >= BigInt(OBSTACLE_EVIDENCE_MIN);

  const expectedRows = hasEnoughData
    ? rankExpectedObstacles(predicted, actual)
    : [];
  const actualRows = hasEnoughData ? rankActualObstacles(actual) : [];

  return (
    <section className="px-4 pt-6" data-ocid="insights.obstacles_section">
      <SectionHeading
        icon={<Zap className="w-4 h-4 text-accent-success" />}
        title="What gets in the way"
        subtitle="The obstacles you expected versus the ones that actually show up"
      />
      <div className="card-neumorphic mt-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-body uppercase tracking-wider text-muted-foreground mb-2">
              Expected
            </p>
            <div className="flex flex-col gap-2">
              {expectedRows.length > 0 ? (
                expectedRows.map((o) => (
                  <ObstacleRow key={o.obstacleName} label={o.obstacleName} />
                ))
              ) : (
                <>
                  <PlaceholderObstacle label="—" />
                  <PlaceholderObstacle label="—" />
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-body uppercase tracking-wider text-muted-foreground mb-2">
              Actual
            </p>
            <div className="flex flex-col gap-2">
              {actualRows.length > 0 ? (
                actualRows.map((o) => (
                  <ObstacleRow
                    key={o.obstacleName}
                    label={o.obstacleName}
                    count={o.count}
                  />
                ))
              ) : (
                <PlaceholderObstacle label="No repeats yet" />
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          {hasEnoughData
            ? "Spotting the patterns that get in the way helps you plan around them."
            : "Understanding what really gets in the way helps you plan around it. We'll surface that here soon."}
        </p>
      </div>
    </section>
  );
}

function ObstacleRow({ label, count }: { label: string; count?: bigint }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/40">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-skip shrink-0" />
      <span className="text-sm text-foreground min-w-0 truncate">{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          ×{count.toString()}
        </span>
      )}
    </div>
  );
}

function PlaceholderObstacle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/40">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-skip shrink-0" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────
// Layout-matched placeholders so the page keeps its shape while the summary
// loads, instead of flashing the warm "gathering data" copy.
function InsightsSkeleton() {
  const blocks = Array.from({ length: 4 }, (_, i) => `insights-skeleton-${i}`);
  return (
    <div
      className="flex flex-col gap-6 px-4 pt-4"
      data-ocid="insights.loading_state"
      aria-busy="true"
    >
      {blocks.map((id) => (
        <div key={id} className="card-neumorphic p-5">
          <Skeleton className="h-4 w-28" />
          <div className="mt-4 flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          <Skeleton className="mt-5 h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────
// Neutral, non-alarming recovery state — a failed request must never read as
// "Your plans are taking shape".
function InsightsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-4 pt-6" data-ocid="insights.error_state" role="alert">
      <div className="card-neumorphic p-6 flex flex-col items-center text-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "oklch(var(--muted) / 0.6)",
            boxShadow:
              "inset 2px 2px 5px rgba(0,0,0,0.4), inset -2px -2px 5px rgba(255,255,255,0.04)",
          }}
        >
          <CloudOff className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="font-display text-base font-semibold text-foreground">
          Couldn't load your insights — try again
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={onRetry}
          data-ocid="insights.retry_button"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function InsightsPage() {
  const { data, isError, isLoading, refetch } = useInsights();
  const prefersReducedMotion = useReducedMotion();

  const container = useMemo(
    () => ({
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.05 },
      },
    }),
    [],
  );

  const item = useMemo(
    () => ({
      hidden: { opacity: 0, y: 12 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
      },
    }),
    [],
  );

  return (
    <div className="min-h-screen bg-background pb-32" data-ocid="insights.page">
      {/* Page heading */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
          Insights
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          A gentle look at how your plans are working
        </p>
      </div>

      <motion.div
        variants={container}
        initial={prefersReducedMotion ? false : "hidden"}
        animate="show"
        className="flex flex-col"
      >
        {isLoading ? (
          <InsightsSkeleton />
        ) : isError ? (
          <InsightsError onRetry={() => void refetch()} />
        ) : (
          <>
            <motion.div variants={item} className="px-4 pt-4">
              <HighlightCard effectiveness={data?.overallIfThenEffectiveness} />
            </motion.div>

            <motion.div variants={item}>
              <BestWorstDaySection data={data} />
            </motion.div>

            <motion.div variants={item}>
              <CategoryBreakdownSection data={data} />
            </motion.div>

            <motion.div variants={item}>
              <ObstaclesSection data={data} />
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
