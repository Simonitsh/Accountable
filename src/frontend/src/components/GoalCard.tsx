import {
  CheckCircle2,
  ChevronsLeft,
  SkipForward,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import type { CheckIn, Goal, GoalAnalytics } from "../types";
import { SkipModal } from "./SkipModal";

interface GoalCardProps {
  goal: Goal;
  checkInToday: CheckIn | undefined;
  analytics?: GoalAnalytics;
  index: number;
  onCheckIn: (goalId: string) => void;
  onSkip: (goalId: string, obstacleId: string) => void;
  isCheckingIn?: boolean;
  isSkipping?: boolean;
}

const SWIPE_THRESHOLD = 60; // px

export function GoalCard({
  goal,
  checkInToday,
  analytics,
  index,
  onCheckIn,
  onSkip,
  isCheckingIn = false,
  isSkipping = false,
}: GoalCardProps) {
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const dragStartX = useRef<number>(0);
  const isDragging = useRef(false);

  const isCheckedIn = !!checkInToday;
  const isSuccess = checkInToday?.checkInType === "success";
  const isSkipped = checkInToday?.checkInType === "skip";

  const consistencyDays = analytics?.currentStreak ?? 0;
  const successCount = analytics?.successCount ?? 0;
  const totalDays =
    (analytics?.successCount ?? 0) +
    (analytics?.skipCount ?? 0) +
    (analytics?.missedCount ?? 0);
  const completionRate =
    totalDays > 0 ? Math.round((successCount / totalDays) * 100) : 0;

  function handleSkipConfirm(obstacleId: string) {
    onSkip(goal.id, obstacleId);
    setShowSkipModal(false);
  }

  // ── Touch handlers ───────────────────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    if (isCheckedIn) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(false);
    setSwipeX(0);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (isCheckedIn) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Only track horizontal swipe if horizontal delta dominates
    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      setIsSwiping(true);
      setSwipeX(Math.max(dx, -SWIPE_THRESHOLD * 1.5));
    }
  }

  function onTouchEnd() {
    if (isCheckedIn) return;
    if (swipeX < -SWIPE_THRESHOLD) {
      setShowSkipModal(true);
    }
    setSwipeX(0);
    setIsSwiping(false);
  }

  // ── Mouse drag handlers (desktop testing) ───────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if (isCheckedIn) return;
    dragStartX.current = e.clientX;
    isDragging.current = true;
    setIsSwiping(false);
    setSwipeX(0);
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || isCheckedIn) return;
    const dx = e.clientX - dragStartX.current;
    if (dx < 0) {
      setIsSwiping(true);
      setSwipeX(Math.max(dx, -SWIPE_THRESHOLD * 1.5));
    }
  }

  function onMouseUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (swipeX < -SWIPE_THRESHOLD) {
      setShowSkipModal(true);
    }
    setSwipeX(0);
    setIsSwiping(false);
  }

  function handleCardClick() {
    if (isCheckedIn || isCheckingIn || isSkipping || isSwiping) return;
    onCheckIn(goal.id);
  }

  // Clamp swipe progress 0→1 for affordance opacity
  const swipeProgress = Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.08, duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl"
        data-ocid={`goal.card.${index + 1}`}
      >
        {/* Skip affordance hint — left edge Electric Cyan bar */}
        <div
          className="absolute left-0 top-0 bottom-0 flex items-center justify-center z-10 rounded-l-2xl pointer-events-none"
          style={{
            width: 36,
            opacity: swipeProgress,
            backgroundColor: `oklch(var(--color-accent-skip) / ${0.15 * swipeProgress})`,
            transition: isSwiping ? "none" : "opacity 0.3s ease",
          }}
        >
          <ChevronsLeft
            className="w-5 h-5"
            style={{ color: "oklch(var(--color-accent-skip))" }}
          />
        </div>

        {/* Card body — translates on swipe */}
        <button
          type="button"
          tabIndex={isCheckedIn ? -1 : 0}
          aria-label={isCheckedIn ? goal.wish : `Log check-in for ${goal.wish}`}
          onClick={handleCardClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseEnter={() => setIsPressed(false)}
          className="relative select-none w-full text-left bg-transparent border-0 p-0"
          style={{
            cursor: isCheckedIn ? "default" : "pointer",
            transform: `translateX(${swipeX}px)`,
            transition: isSwiping
              ? "none"
              : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
            borderRadius: "1rem",
            padding: "1.25rem",
            // True neumorphic shadow logic
            ...(isSuccess
              ? {
                  backgroundColor: "oklch(var(--color-accent-success) / 0.08)",
                  boxShadow: `
                    0 0 18px 4px oklch(var(--color-accent-success) / 0.28),
                    6px 6px 12px rgba(0,0,0,0.5),
                    -4px -4px 10px rgba(255,255,255,0.04)
                  `,
                }
              : isSkipped
                ? {
                    backgroundColor: "oklch(var(--color-accent-skip) / 0.07)",
                    boxShadow: `
                      0 0 14px 3px oklch(var(--color-accent-skip) / 0.25),
                      6px 6px 12px rgba(0,0,0,0.5),
                      -4px -4px 10px rgba(255,255,255,0.04)
                    `,
                  }
                : isPressed
                  ? {
                      backgroundColor: "oklch(var(--card))",
                      boxShadow: `
                        inset 2px 2px 5px rgba(0,0,0,0.5),
                        inset -2px -2px 5px rgba(255,255,255,0.04)
                      `,
                    }
                  : {
                      backgroundColor: "oklch(var(--card))",
                      boxShadow: `
                        6px 6px 12px rgba(0,0,0,0.5),
                        -4px -4px 10px rgba(255,255,255,0.04)
                      `,
                    }),
          }}
          onPointerDown={() => !isCheckedIn && setIsPressed(true)}
          onPointerUp={() => setIsPressed(false)}
        >
          {/* Status badge */}
          {isCheckedIn && (
            <div
              className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono uppercase tracking-wider"
              style={
                isSuccess
                  ? {
                      backgroundColor:
                        "oklch(var(--color-accent-success) / 0.15)",
                      color: "oklch(var(--color-accent-success))",
                    }
                  : {
                      backgroundColor: "oklch(var(--color-accent-skip) / 0.12)",
                      color: "oklch(var(--color-accent-skip))",
                    }
              }
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  Done
                </>
              ) : (
                <>
                  <SkipForward className="w-3 h-3" />
                  Skipped
                </>
              )}
            </div>
          )}

          {/* Goal info */}
          <div className="pr-20 mb-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Keystone Habit
            </p>
            <h3 className="font-display text-xl font-semibold text-foreground leading-tight line-clamp-2">
              {goal.wish}
            </h3>
            {goal.wishDescription && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                {goal.wishDescription}
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4">
            {consistencyDays > 0 && (
              <div className="flex items-center gap-1.5">
                <Zap
                  className="w-4 h-4"
                  style={{ color: "oklch(var(--color-accent-success))" }}
                />
                <span className="font-display text-sm font-semibold text-foreground">
                  {consistencyDays}
                </span>
                <span className="text-xs text-muted-foreground">
                  days consistent
                </span>
              </div>
            )}
            {totalDays > 0 && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="font-display text-sm font-semibold text-foreground">
                  {completionRate}%
                </span>
                <span className="text-xs text-muted-foreground">
                  completion
                </span>
              </div>
            )}
            {consistencyDays === 0 && totalDays === 0 && (
              <span className="text-xs text-muted-foreground italic">
                Day 1 of cumulative consistency.
              </span>
            )}
          </div>

          {/* Tap / swipe hint for unchecked cards */}
          {!isCheckedIn && (
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                boxShadow:
                  "inset 1px 1px 3px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex items-center gap-2">
                {isCheckingIn ? (
                  <span
                    className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin"
                    style={{ color: "oklch(var(--color-accent-success))" }}
                  />
                ) : (
                  <Zap
                    className="w-3.5 h-3.5"
                    style={{ color: "oklch(var(--color-accent-success))" }}
                  />
                )}
                <span className="text-xs font-mono text-muted-foreground">
                  {isCheckingIn ? "Logging…" : "Tap to log success"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <ChevronsLeft
                  className="w-3.5 h-3.5"
                  style={{ color: "oklch(var(--color-accent-skip) / 0.6)" }}
                />
                <span
                  className="text-xs font-mono"
                  style={{ color: "oklch(var(--color-accent-skip) / 0.6)" }}
                >
                  Swipe to skip
                </span>
              </div>
            </div>
          )}

          {/* Already checked in footer */}
          {isCheckedIn && (
            <div
              className="rounded-xl py-2.5 px-4 text-center text-xs font-mono"
              style={
                isSuccess
                  ? {
                      backgroundColor:
                        "oklch(var(--color-accent-success) / 0.08)",
                      color: "oklch(var(--color-accent-success) / 0.7)",
                    }
                  : {
                      backgroundColor:
                        "oklch(var(--color-accent-missed) / 0.08)",
                      color: "oklch(var(--color-accent-missed))",
                    }
              }
              data-ocid={`goal.checked_in_state.${index + 1}`}
            >
              {isSuccess
                ? "✓ Checked in — building cumulative consistency."
                : "Skipped for today — come back tomorrow."}
            </div>
          )}
        </button>
      </motion.div>

      {/* Skip Modal */}
      <SkipModal
        goal={goal}
        open={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        onConfirm={handleSkipConfirm}
        isLoading={isSkipping}
      />
    </>
  );
}
