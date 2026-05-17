import { X, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { CheckInType } from "../backend";
import type { CheckIn, GoalPublic } from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";
import { OBSTACLE_TEMPLATES } from "../types";

// ─── Accent colours (matching index.css semantic tokens) ─────────────────────
const SUCCESS_COLOR = "#10B981"; // Emerald Green
const SKIP_COLOR = "#0369A1"; // Ocean Blue
const MISSED_COLOR = "#6B7280"; // Muted grey

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert IC nanosecond timestamp → "HH:MM" in the user's local timezone. */
function formatTime(nanoTs: bigint): string {
  const ms = Number(nanoTs / 1_000_000n);
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Format date label for a group header: "Today", "Yesterday", or "Mon 12 May". */
function formatDateLabel(nanoTs: bigint): string {
  const ms = Number(nanoTs / 1_000_000n);
  const d = new Date(ms);
  const now = new Date();

  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === todayStr) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Return the string label for an obstacleTemplateId (bigint index). */
function obstacleLabel(id?: bigint): string {
  if (id === undefined || id === null) return "Unspecified";
  const idx = Number(id);
  return OBSTACLE_TEMPLATES[idx]?.label ?? "Unspecified";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TimelineNodeCircle({
  type,
  isRevival,
}: {
  type: CheckInType;
  isRevival: boolean;
}) {
  const isSuccess = type === CheckInType.success;
  const isSkip = type === CheckInType.skip;
  const isMissedLockIn =
    type === CheckInType.missedCheckIn || type === CheckInType.missedCheckOut;

  if (isSuccess) {
    return (
      <div
        className="relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: "rgba(16,185,129,0.15)",
          border: `2px solid ${SUCCESS_COLOR}`,
          boxShadow: "0 0 0 3px rgba(16,185,129,0.08)",
        }}
        aria-hidden="true"
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{ background: SUCCESS_COLOR }}
        />
        {isRevival && (
          <div
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{
              background: "oklch(var(--card))",
              border: `1px solid ${SUCCESS_COLOR}`,
            }}
          >
            <Zap
              className="w-2.5 h-2.5"
              style={{ color: SUCCESS_COLOR }}
              strokeWidth={2.5}
            />
          </div>
        )}
      </div>
    );
  }

  if (isSkip || isMissedLockIn) {
    return (
      <div
        className="relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: "rgba(3,105,161,0.15)",
          border: `2px solid ${SKIP_COLOR}`,
          boxShadow: "0 0 0 3px rgba(3,105,161,0.08)",
        }}
        aria-hidden="true"
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{ background: SKIP_COLOR }}
        />
      </div>
    );
  }

  // inProgress → hollow grey
  return (
    <div
      className="flex-shrink-0 w-8 h-8 rounded-full"
      style={{
        border: `2px solid ${MISSED_COLOR}`,
        background: "transparent",
        boxShadow: "0 0 0 3px rgba(107,114,128,0.08)",
      }}
      aria-hidden="true"
    />
  );
}

function TimelineItem({ checkIn }: { checkIn: CheckIn }) {
  const isSuccess = checkIn.checkInType === CheckInType.success;
  const isSkip = checkIn.checkInType === CheckInType.skip;
  const isMissedCheckIn = checkIn.checkInType === CheckInType.missedCheckIn;
  const isMissedCheckOut = checkIn.checkInType === CheckInType.missedCheckOut;
  const isMissedLockIn = isMissedCheckIn || isMissedCheckOut;
  const _isMissed = checkIn.checkInType === CheckInType.inProgress;

  const time = formatTime(checkIn.timestamp);
  const isRevival = isSuccess && checkIn.executedIfThen;

  let primaryText: string;
  let primaryColor: string;

  if (isSuccess) {
    primaryText = isRevival
      ? `Executed If-Then plan at ${time}`
      : `Executed at ${time}`;
    primaryColor = SUCCESS_COLOR;
  } else if (isSkip) {
    primaryText = `Skipped at ${time}`;
    primaryColor = SKIP_COLOR;
  } else if (isMissedCheckIn) {
    primaryText = `Missed start window at ${time}`;
    primaryColor = SKIP_COLOR;
  } else if (isMissedCheckOut) {
    primaryText = `Missed check-out at ${time}`;
    primaryColor = SKIP_COLOR;
  } else {
    primaryText = "Missed \u2022 No action taken";
    primaryColor = MISSED_COLOR;
  }

  return (
    <div className="flex gap-3" data-ocid="goal_insight.timeline_item">
      {/* Node */}
      <TimelineNodeCircle type={checkIn.checkInType} isRevival={isRevival} />

      {/* Content */}
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center gap-1.5">
          {isRevival && (
            <Zap
              className="w-3 h-3 flex-shrink-0"
              style={{ color: SUCCESS_COLOR }}
              strokeWidth={2.5}
              aria-hidden="true"
            />
          )}
          <p
            className="text-sm font-display font-medium leading-snug"
            style={{ color: primaryColor }}
          >
            {primaryText}
            {(isSkip || isMissedLockIn) &&
              (checkIn.obstacleTemplateId !== undefined &&
              checkIn.obstacleTemplateId !== null ? (
                <>
                  {" \u2022 "}
                  <span style={{ color: "#F97316" }}>
                    {obstacleLabel(checkIn.obstacleTemplateId)}
                  </span>
                </>
              ) : isMissedLockIn ? (
                <>
                  {" \u2022 "}
                  <span style={{ color: "oklch(var(--muted-foreground))" }}>
                    No reason logged
                  </span>
                </>
              ) : null)}
          </p>
        </div>

        {/* Sub-bubble for custom obstacle note (skip or missed lock-in) */}
        {(isSkip || isMissedLockIn) && checkIn.customObstacleNote && (
          <div
            className="mt-2 rounded-xl px-3 py-2 max-w-xs"
            style={{
              background: "rgba(3,105,161,0.08)",
              border: "1px solid rgba(3,105,161,0.2)",
            }}
            data-ocid="goal_insight.custom_note_bubble"
          >
            <p
              className="text-xs italic leading-relaxed"
              style={{ color: "oklch(var(--muted-foreground))" }}
            >
              &ldquo;{checkIn.customObstacleNote}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Group check-ins by calendar day (newest day first). */
function groupByDay(
  checkIns: CheckIn[],
): Array<{ label: string; items: CheckIn[] }> {
  const map = new Map<string, CheckIn[]>();
  for (const ci of checkIns) {
    const ms = Number(ci.timestamp / 1_000_000n);
    const key = new Date(ms).toDateString();
    const bucket = map.get(key) ?? [];
    bucket.push(ci);
    map.set(key, bucket);
  }
  // Sort day keys descending (newest day first) regardless of backend order
  const sortedEntries = Array.from(map.entries()).sort(([keyA], [keyB]) => {
    const dateA = new Date(keyA).getTime();
    const dateB = new Date(keyB).getTime();
    return dateB - dateA;
  });
  return sortedEntries.map(([, items]) => ({
    label: formatDateLabel(items[0].timestamp),
    items,
  }));
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-5" data-ocid="goal_insight.loading_state">
      {[...Array(5)].map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array, no reordering possible
        <div key={i} className="flex gap-3 items-start">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 animate-pulse"
            style={{ background: "oklch(var(--muted) / 0.5)" }}
          />
          <div className="flex-1 space-y-2 pt-1">
            <div
              className="h-3 rounded-full animate-pulse"
              style={{
                background: "oklch(var(--muted) / 0.5)",
                width: `${55 + (i % 3) * 15}%`,
              }}
            />
            {i % 2 === 0 && (
              <div
                className="h-2.5 rounded-full animate-pulse"
                style={{
                  background: "oklch(var(--muted) / 0.35)",
                  width: "40%",
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface GoalInsightSheetProps {
  goal: GoalPublic;
  isOpen: boolean;
  onClose: () => void;
}

export function GoalInsightSheet({
  goal,
  isOpen,
  onClose,
}: GoalInsightSheetProps) {
  const { actor, actorReady } = useBackend();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the last 14 days of check-ins when the sheet opens
  useEffect(() => {
    if (!isOpen || !actorReady || !actor) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const now = BigInt(Date.now()) * 1_000_000n; // ms → ns
    const fourteenDaysNs = BigInt(14 * 24 * 60 * 60 * 1_000) * 1_000_000n;
    const fromTimestamp = now - fourteenDaysNs;

    actor
      .getCheckInsForGoalTimeline(goal.id, fromTimestamp)
      .then((data) => {
        if (!cancelled) {
          // Sort newest first (backend may already do this, but ensure it)
          const sorted = [...data].sort((a, b) =>
            a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0,
          );
          const goalCreatedDateStr = goal.createdAt
            ? new Date(Number(goal.createdAt / 1_000_000n)).toDateString()
            : null;
          const todayStr = new Date().toDateString();
          const filtered =
            goal.isLockIn && goalCreatedDateStr === todayStr
              ? sorted.filter((ci) => {
                  const ciDateStr = new Date(
                    Number(ci.timestamp / 1_000_000n),
                  ).toDateString();
                  const isPhantom =
                    (ci.checkInType === CheckInType.inProgress ||
                      ci.checkInType === CheckInType.missedCheckIn ||
                      ci.checkInType === CheckInType.missedCheckOut) &&
                    ciDateStr === todayStr;
                  return !isPhantom;
                })
              : sorted;
          setCheckIns(filtered);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load timeline. Tap to retry.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, actorReady, actor, goal.id, goal.createdAt, goal.isLockIn]);

  // Reset state when sheet is closed so it re-fetches on next open
  useEffect(() => {
    if (!isOpen) {
      setCheckIns([]);
      setError(null);
    }
  }, [isOpen]);

  const groups = groupByDay(checkIns);
  const isEmpty = !isLoading && !error && checkIns.length === 0;

  // wishDescription is the keystone habit name (required, non-nullable in GoalPublic).
  // wish is the macro goal — shown below the habit name in muted text.
  const habitName = goal.wishDescription || goal.wish || "Habit";
  const macroWish = goal.wish;
  const outcome = goal.outcome;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────────── */}
          <motion.div
            key="goal-insight-backdrop"
            className="fixed inset-0 z-40"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(3px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            data-ocid="goal_insight.backdrop"
          />

          {/* ── Bottom Sheet ─────────────────────────────────────────────── */}
          <motion.div
            key="goal-insight-sheet"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col"
            style={{
              background: "oklch(var(--card))",
              maxHeight: "88dvh",
              boxShadow:
                "0 -10px 40px rgba(0,0,0,0.75), 0 -2px 10px rgba(0,0,0,0.5)",
              borderTop: "1px solid rgba(255,255,255,0.13)",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              borderRight: "none",
              borderBottom: "none",
              paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.28 }}
            data-ocid="goal_insight.dialog"
          >
            {/* Drag handle pill */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "oklch(var(--muted-foreground) / 0.3)" }}
              />
            </div>

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div
              className="flex-shrink-0 px-6 pt-3 pb-5"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Habit name — prominent */}
                  <h2
                    className="font-display text-xl font-bold leading-tight truncate"
                    style={{ color: "oklch(var(--foreground))" }}
                    data-ocid="goal_insight.habit_name"
                  >
                    {habitName}
                  </h2>

                  {/* Macro wish + outcome — muted, smaller */}
                  <div className="mt-1.5 space-y-0.5">
                    {macroWish && (
                      <p
                        className="text-sm font-body leading-snug line-clamp-2"
                        style={{ color: "oklch(var(--muted-foreground))" }}
                        data-ocid="goal_insight.macro_wish"
                      >
                        <span
                          className="text-xs font-mono uppercase tracking-widest mr-1.5"
                          style={{
                            color: "oklch(var(--muted-foreground) / 0.6)",
                          }}
                        >
                          Wish
                        </span>
                        {macroWish}
                      </p>
                    )}
                    {outcome && (
                      <p
                        className="text-sm font-body leading-snug line-clamp-2"
                        style={{ color: "oklch(var(--muted-foreground))" }}
                        data-ocid="goal_insight.outcome"
                      >
                        <span
                          className="text-xs font-mono uppercase tracking-widest mr-1.5"
                          style={{
                            color: "oklch(var(--muted-foreground) / 0.6)",
                          }}
                        >
                          Obstacles
                        </span>
                        {outcome}
                      </p>
                    )}
                  </div>
                </div>

                {/* Close button */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Goal Insight"
                  data-ocid="goal_insight.close_button"
                  className="flex-shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Timeline section (scrollable) ─────────────────────────── */}
            <div
              className="flex-1 overflow-y-auto px-6 pt-5"
              style={{ overscrollBehavior: "contain" }}
              data-ocid="goal_insight.timeline_section"
            >
              {/* Loading skeleton */}
              {isLoading && <TimelineSkeleton />}

              {/* Error state */}
              {!isLoading && error && (
                <div
                  className="flex flex-col items-center justify-center gap-3 py-10 text-center"
                  data-ocid="goal_insight.error_state"
                >
                  <p
                    className="text-sm"
                    style={{ color: "oklch(var(--muted-foreground))" }}
                  >
                    {error}
                  </p>
                </div>
              )}

              {/* Empty state */}
              {isEmpty && (
                <div
                  className="flex flex-col items-center justify-center gap-3 py-12 text-center"
                  data-ocid="goal_insight.empty_state"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-1"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span
                      className="text-2xl select-none"
                      style={{ color: "oklch(var(--muted-foreground) / 0.5)" }}
                    >
                      ⬤
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed max-w-[220px]"
                    style={{ color: "oklch(var(--muted-foreground))" }}
                  >
                    No check-ins yet. Your timeline will fill as you build your
                    habit.{" "}
                    <span style={{ color: "oklch(var(--foreground) / 0.5)" }}>
                      Start building your timeline.
                    </span>
                  </p>
                </div>
              )}

              {/* Timeline groups */}
              {!isLoading && !error && groups.length > 0 && (
                <div className="relative">
                  {/* Vertical connecting line — spans full content height */}
                  <div
                    className="absolute left-[15px] top-0 bottom-0 w-[2px] pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                    }}
                    aria-hidden="true"
                  />

                  <div className="flex flex-col gap-0">
                    {groups.map((group, gi) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: groups keyed by stable date string position
                      <div key={gi} className="mb-4">
                        {/* Day label */}
                        <div
                          className="mb-3 ml-11"
                          data-ocid={`goal_insight.day_group.${gi + 1}`}
                        >
                          <span
                            className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{
                              color: "oklch(var(--muted-foreground))",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            {group.label}
                          </span>
                        </div>

                        {/* Check-in items */}
                        <div className="ml-3 flex flex-col gap-0">
                          {group.items.map((ci, ii) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: items within a day group, stable order
                            <TimelineItem key={`${gi}-${ii}`} checkIn={ci} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom spacer for scroll comfort */}
              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
