import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePartnerHabits } from "../hooks/usePartnerHabits";
import type { HabitPublic } from "../types";
import { CATEGORY_DETAILS } from "../types";

interface PartnerHabitDetailProps {
  /** Partner principal as a string (the overview's `key`). */
  target: string;
  /** 1-based index of the parent overview card, for stable ocid markers. */
  index: number;
}

const SUCCESS_COLOR = "#10B981";
const SKIP_COLOR = "#0369A1";
const LOCK_IN_AMBER = "#F59E0B";

function categoryMeta(category: HabitPublic["category"]) {
  const found = CATEGORY_DETAILS.find((c) => c.id === category);
  return {
    label: found?.title ?? "Uncategorized",
    description: found?.description ?? "",
  };
}

function formatTime(timeStr: string | undefined): string | null {
  if (!timeStr || timeStr.trim() === "") return null;
  return timeStr;
}

function keystoneText(goal: HabitPublic): string {
  const raw = goal.wishDescription || goal.wish;
  if (raw.startsWith("Every day, I will ")) {
    return `I will ${raw.slice("Every day, I will ".length)}`;
  }
  if (raw.startsWith("Every day ,")) {
    return `I will ${raw.slice("Every day ,".length).trimStart()}`;
  }
  return raw;
}

/** A single partner habit rendered with the same neumorphic treatment as the
 *  user's own habits — read-only (no swipe/check-in affordances). */
function PartnerHabitCard({
  goal,
  index,
}: {
  goal: HabitPublic;
  index: number;
}) {
  const meta = categoryMeta(goal.category);
  const title = keystoneText(goal);
  const wish = goal.wish?.trim() || null;
  const isLockIn = goal.isLockIn;
  const startTime = formatTime(goal.startTime);
  const endTime = formatTime(goal.endTime);
  const scheduledDays =
    goal.scheduledDays && goal.scheduledDays.length > 0
      ? goal.scheduledDays
      : null;

  return (
    <article
      className="card-neumorphic bg-card rounded-xl p-4 flex flex-col gap-3"
      data-ocid={`partners.habit.item.${index + 1}`}
      aria-label={`Partner habit: ${title}`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-display text-base font-semibold text-foreground leading-snug line-clamp-2 flex-1 min-w-0">
          {title}
        </h4>
        {isLockIn && (
          <span
            className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold"
            style={{
              background: "rgba(245,158,11,0.14)",
              border: "1px solid rgba(245,158,11,0.45)",
              color: LOCK_IN_AMBER,
            }}
            aria-label="Lock-In habit"
          >
            LOCK-IN
          </span>
        )}
      </div>

      {/* Wish / description */}
      {wish && wish !== title && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {wish}
        </p>
      )}

      {/* Category badge */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{
            background: "rgba(107,114,128,0.15)",
            border: "1px solid rgba(107,114,128,0.3)",
            color: "oklch(var(--muted-foreground))",
          }}
          aria-label={`Category: ${meta.label}`}
        >
          {meta.label}
        </span>

        {/* State badge */}
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{
            background:
              goal.state === "active"
                ? "oklch(var(--color-accent-success) / 0.12)"
                : "rgba(107,114,128,0.15)",
            border:
              goal.state === "active"
                ? "1px solid oklch(var(--color-accent-success) / 0.4)"
                : "1px solid rgba(107,114,128,0.3)",
            color:
              goal.state === "active"
                ? SUCCESS_COLOR
                : "oklch(var(--muted-foreground))",
          }}
          aria-label={`State: ${goal.state}`}
        >
          {goal.state === "active" ? "Active" : String(goal.state)}
        </span>
      </div>

      {/* Schedule summary */}
      {(startTime || endTime || scheduledDays) && (
        <div
          className="flex items-center gap-2 flex-wrap text-xs font-mono"
          style={{ color: "oklch(var(--muted-foreground))" }}
        >
          {startTime && endTime && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md"
              style={{
                background: "rgba(107,114,128,0.12)",
                border: "1px solid rgba(107,114,128,0.25)",
              }}
            >
              {startTime}–{endTime}
            </span>
          )}
          {scheduledDays && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md"
              style={{
                background: "rgba(107,114,128,0.12)",
                border: "1px solid rgba(107,114,128,0.25)",
              }}
            >
              {scheduledDays.join(" · ")}
            </span>
          )}
        </div>
      )}

      {/* Outcome (if-then plan) */}
      {goal.ifThenPlan && goal.ifThenPlan.trim() !== "" && (
        <div
          className="text-xs leading-relaxed rounded-lg px-3 py-2"
          style={{
            background: "oklch(var(--color-accent-skip) / 0.08)",
            border: "1px solid oklch(var(--color-accent-skip) / 0.25)",
            color: "oklch(var(--foreground) / 0.85)",
          }}
        >
          <span
            className="font-mono font-semibold"
            style={{ color: SKIP_COLOR }}
          >
            If-Then:{" "}
          </span>
          {goal.ifThenPlan.trim()}
        </div>
      )}
    </article>
  );
}

/**
 * Expanded partner view — shows the partner's actual habits as designed
 * neumorphic cards. Reuses CATEGORY_DETAILS and the same neumorphic card
 * classes as the user's own habits for visual consistency.
 *
 * Loading, error, empty, and success states are all handled inline so the
 * overview card's expansion never feels broken.
 */
export function PartnerHabitDetail({ target, index }: PartnerHabitDetailProps) {
  const { data, isLoading, isError, isFetching } = usePartnerHabits(target);

  // Loading state — skeleton cards
  if (isLoading || (isFetching && !data)) {
    return (
      <div
        className="flex flex-col items-center justify-center py-8 gap-3"
        data-ocid={`partners.habit.loading_state.${index + 1}`}
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2
          size={20}
          className="animate-spin"
          style={{ color: "oklch(var(--color-accent-social))" }}
          aria-hidden="true"
        />
        <p className="text-xs text-muted-foreground font-mono">
          Loading habits…
        </p>
      </div>
    );
  }

  // Error state — partner not a partner, profile not found, etc.
  if (isError || (data && data.__kind__ === "err")) {
    const err = data?.__kind__ === "err" ? data.err : "unknown";
    const message =
      err === "notPartner"
        ? "You can only view habits for accepted, mutual partners."
        : err === "profileNotFound"
          ? "This partner's profile could not be found."
          : "Couldn't load this partner's habits right now.";
    return (
      <div
        className="flex flex-col items-center justify-center py-8 gap-2 text-center"
        data-ocid={`partners.habit.error_state.${index + 1}`}
        role="alert"
      >
        <span className="text-2xl" aria-hidden="true">
          ⚠️
        </span>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
          {message}
        </p>
      </div>
    );
  }

  const habits = data?.__kind__ === "ok" ? data.ok.habits : [];

  // Empty state — partner has no habits
  if (habits.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-8 gap-2 text-center"
        data-ocid={`partners.habit.empty_state.${index + 1}`}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-neumorphic-inset"
          style={{ background: "oklch(var(--muted))" }}
          aria-hidden="true"
        >
          <span className="text-xl opacity-50">🌱</span>
        </div>
        <p className="text-sm font-display font-semibold text-foreground">
          No active habits yet
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
          This partner hasn't set up any habits to share. Check back later.
        </p>
      </div>
    );
  }

  // Success — habit cards
  return (
    <div
      className="flex flex-col gap-3 pt-3"
      data-ocid={`partners.habit.list.${index + 1}`}
    >
      <AnimatePresence mode="popLayout">
        {habits.map((goal, i) => (
          <motion.div
            key={String(goal.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, delay: Math.min(i * 0.05, 0.25) }}
          >
            <PartnerHabitCard goal={goal} index={i} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
