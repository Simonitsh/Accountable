import { GoalCategory } from "@/backend";
import { useBackend } from "@/hooks/useBackend";
import { useUserProfile } from "@/hooks/useUserProfile";
import type {
  AnalyticsSummary,
  CategoryStat,
  IfThenEffectiveness,
  ObstacleStat,
} from "@/types/index";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarDays,
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
  const { data: profile } = useUserProfile();
  const timezoneOffsetMinutes = profile?.timezoneOffsetMinutes ?? 0n;

  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", timezoneOffsetMinutes.toString()],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.getAnalytics(timezoneOffsetMinutes);
    },
    enabled: !!actor && actorReady,
  });
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
    used.total >= MIN_DATA_POINTS &&
    notUsed.total >= MIN_DATA_POINTS;

  // Default to the warm gathering state; only override when there's enough
  // data on both sides to make the comparison meaningful.
  let headline = "Your plans are taking shape";
  let subtitle =
    "We're gathering how often your if-then plans help you follow through. Soon you'll see your momentum here.";
  let followThroughValue = "—";
  let progressWidth = "0%";
  let caption = "Keep going — every small win builds the picture.";

  if (hasEnoughData) {
    const usedRate = used.rate;
    const notUsedRate = notUsed.rate;
    const multiplier =
      notUsedRate > 0 ? usedRate / notUsedRate : Number.POSITIVE_INFINITY;
    const usedPct = Math.round(usedRate * 100);
    const notUsedPct = Math.round(notUsedRate * 100);

    if (usedRate > notUsedRate) {
      // Favorable — prefer a clean multiplier, but fall back to a plain
      // comparison when the "didn't use it" side is too low for a multiplier
      // to read sensibly (it would blow up into a nonsensical number).
      if (notUsedRate >= 0.1 && multiplier >= 1.5 && multiplier <= 5) {
        const rounded = Math.round(multiplier);
        headline = `${rounded}x more likely to follow through`;
        subtitle = `When you use your if-then plan, you follow through ${rounded}× more often than on days you don't.`;
      } else {
        headline = "Your plan makes follow-through easier";
        subtitle = `You follow through ${usedPct}% of the time with your plan, versus ${notUsedPct}% without it.`;
      }
      followThroughValue = `${usedPct}%`;
      progressWidth = `${usedPct}%`;
      caption = `Based on ${used.total} days with your plan and ${notUsed.total} without.`;
    } else {
      // Flat or unfavorable — never a grade. Reframe as encouragement to keep
      // using the plan, matching the page's forward-looking tone.
      headline = "Keep using your plan";
      subtitle =
        "Every time you use your if-then plan, you're building a habit that sticks. The momentum is still growing.";
      followThroughValue = `${usedPct}%`;
      progressWidth = `${usedPct}%`;
      caption = `You've followed through ${used.total} times with your plan so far — keep it up.`;
    }
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
  // A day is only meaningful once it has enough check-ins behind it.
  const dayStat = (index?: bigint) =>
    data?.dayOfWeek.find((s) => s.dayOfWeek === index);

  const bestStat = dayStat(data?.bestDayOfWeek);
  const worstStat = dayStat(data?.worstDayOfWeek);

  const bestReady =
    !!bestStat && bestStat.total >= MIN_DATA_POINTS && !!bestStat.dayName;
  const worstReady =
    !!worstStat && worstStat.total >= MIN_DATA_POINTS && !!worstStat.dayName;

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
          label="Worst day"
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

          // Three states per category:
          //  - no stat at all → no habits yet → "nothing here yet"
          //  - stat but too little data → warm gathering state
          //  - enough data → real rate + progress
          let value = "—";
          let progressWidth = "0%";
          let hint: string | null = null;

          if (stat) {
            if (stat.total >= MIN_DATA_POINTS) {
              const pct = Math.round(stat.rate * 100);
              value = `${pct}%`;
              progressWidth = `${pct}%`;
            } else {
              hint = "Gathering a little more data…";
            }
          } else {
            hint = "Nothing here yet";
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
// Aggregate obstacle counts across ALL of the user's habits (not per-habit),
// summing by obstacle name so the section reads across the whole practice.
// Used for the ACTUAL-obstacles column only: the backend already pools the
// predicted side once into AnalyticsSummary.predictedObstaclePool.
function aggregateObstacles(obstacles: ObstacleStat[]): ObstacleStat[] {
  const byName = new Map<string, ObstacleStat>();
  for (const obstacle of obstacles) {
    const existing = byName.get(obstacle.obstacleName);
    if (existing) {
      existing.count = existing.count + obstacle.count;
    } else {
      byName.set(obstacle.obstacleName, { ...obstacle });
    }
  }
  return [...byName.values()].sort((a, b) => Number(b.count - a.count));
}

function ObstaclesSection({ data }: { data?: AnalyticsSummary }) {
  const habits = data?.habits ?? [];

  // Predicted obstacles are pooled once by the backend and read straight from
  // the summary — no client-side re-pooling. Actual obstacles come from the
  // check-ins that actually got in the way, so they are still pooled here
  // across ALL habits and ranked by genuine count.
  const predicted = useMemo(() => data?.predictedObstaclePool ?? [], [data]);
  const actual = useMemo(
    () => aggregateObstacles(habits.flatMap((h) => h.actualObstacles)),
    [habits],
  );

  // Gate on enough total check-in history across all habits before surfacing
  // any real obstacle, and require at least one obstacle to show.
  const totalShownUp = habits.reduce((sum, h) => sum + h.shownUpDays, 0n);
  const hasEnoughData =
    totalShownUp >= BigInt(MIN_DATA_POINTS) &&
    (predicted.length > 0 || actual.length > 0);

  const predictedRows = hasEnoughData ? predicted.slice(0, 2) : [];
  const actualRows = hasEnoughData ? actual.slice(0, 2) : [];

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
              {predictedRows.length > 0 ? (
                predictedRows.map((o) => (
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

function ObstacleRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/40">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-skip shrink-0" />
      <span className="text-sm text-foreground">{label}</span>
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

// ─── Main page ───────────────────────────────────────────────────────────────
export function InsightsPage() {
  const { data } = useInsights();
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
      </motion.div>
    </div>
  );
}
