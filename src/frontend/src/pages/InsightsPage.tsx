import { useBackend } from "@/hooks/useBackend";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { AnalyticsSummary } from "@/types/index";
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
  { id: "Health", label: "Health", icon: HeartPulse },
  { id: "Learning", label: "Learning", icon: GraduationCap },
  { id: "Social", label: "Social", icon: Users },
  { id: "Productivity", label: "Productivity", icon: Briefcase },
  { id: "Leisure", label: "Leisure", icon: Palette },
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
function HighlightCard() {
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
            Your plans are taking shape
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            We&apos;re gathering how often your if-then plans help you follow
            through. Soon you&apos;ll see your momentum here.
          </p>
        </div>
      </div>

      {/* Placeholder progress — shaped for overallIfThenEffectiveness */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">Follow-through</span>
          <span className="text-accent-success font-semibold">—</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: "0%" }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Keep going — every small win builds the picture.
        </p>
      </div>
    </div>
  );
}

// ─── Best / worst day ────────────────────────────────────────────────────────
function DayCard({
  label,
  icon,
  accent,
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  accent: string;
  placeholder: string;
}) {
  return (
    <div className="card-neumorphic p-4 flex-1 min-w-0">
      <div className="flex items-center gap-2 text-xs font-body uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`font-display text-xl font-semibold mt-3 ${accent}`}>
        {placeholder}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        We&apos;ll show your standout day here once there&apos;s enough data.
      </p>
    </div>
  );
}

function BestWorstDaySection() {
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
          placeholder="—"
        />
        <DayCard
          label="Worst day"
          icon={<CalendarDays className="w-3.5 h-3.5" />}
          accent="text-accent-skip"
          placeholder="—"
        />
      </div>
    </section>
  );
}

// ─── Category breakdown ──────────────────────────────────────────────────────
function CategoryBreakdownSection() {
  return (
    <section className="px-4 pt-6" data-ocid="insights.category_section">
      <SectionHeading
        icon={<Lightbulb className="w-4 h-4 text-accent-success" />}
        title="Progress by category"
        subtitle="How you&apos;re doing across Health, Learning, Social, Productivity, and Leisure"
      />
      <div className="card-neumorphic mt-4 p-4 flex flex-col gap-4">
        {CATEGORY_ROWS.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.id} className="flex items-center gap-3">
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
                  <span className="text-xs text-muted-foreground">—</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: "0%" }}
                  />
                </div>
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
function ObstaclesSection() {
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
              <PlaceholderObstacle label="—" />
              <PlaceholderObstacle label="—" />
            </div>
          </div>
          <div>
            <p className="text-xs font-body uppercase tracking-wider text-muted-foreground mb-2">
              Actual
            </p>
            <div className="flex flex-col gap-2">
              <PlaceholderObstacle label="—" />
              <PlaceholderObstacle label="—" />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Understanding what really gets in the way helps you plan around it.
          We&apos;ll surface that here soon.
        </p>
      </div>
    </section>
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
  useInsights();
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
          <HighlightCard />
        </motion.div>

        <motion.div variants={item}>
          <BestWorstDaySection />
        </motion.div>

        <motion.div variants={item}>
          <CategoryBreakdownSection />
        </motion.div>

        <motion.div variants={item}>
          <ObstaclesSection />
        </motion.div>
      </motion.div>
    </div>
  );
}
