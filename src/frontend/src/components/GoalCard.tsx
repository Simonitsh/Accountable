import { Check, Pause } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { GoalPublic } from "../backend.d.ts";
import type { GoalAnalytics } from "../types";
import { getGoalIcon } from "../utils/goalIcons";
import { SkipModal } from "./SkipModal";

// ─── Accent constants ──────────────────────────────────────────────────────────
const SUCCESS_COLOR = "#10B981"; // Emerald Green
const SKIP_COLOR = "#0369A1"; // Ocean Blue
const GREY_COLOR = "#4B5563"; // No check-in

const SWIPE_THRESHOLD = 60;

export type DayStatus = "success" | "skip" | "none";

interface GoalCardProps {
  goal: GoalPublic;
  /** undefined = active (unswiped), present = done */
  checkInToday?: { checkInType: "success" | "skip" } | undefined;
  analytics?: GoalAnalytics;
  index: number;
  weekHistory?: DayStatus[]; // 7 entries: [6daysAgo, ..., today]
  weekHistoryLoading?: boolean;
  /** Only active cards can be swiped */
  mode: "active" | "done";
  onCheckIn?: (
    goalId: bigint,
    type: "success" | "skip",
    obstacleId?: bigint,
  ) => void;
  /** Called when card in Done tab is tapped */
  onDoneCardTap?: (goalId: bigint) => void;
  /** Called when Phase-1 exit animation completes → triggers Phase 2 */
  onExitComplete?: (goalId: bigint) => void;
  isDarkMode: boolean;
  isCheckingIn?: boolean;
  isSkipping?: boolean;
  /** Animate entrance with bounce (used when card returns from Done) */
  animateIn?: boolean;
  /** Direction for exit animation when card leaves the active list */
  exitDirection?: "left" | "right" | null;
  /** True while the card is playing its Phase-1 exit animation */
  isExiting?: boolean;
  /** Direction the card entered from when appearing in Done tab */
  entryFrom?: "left" | "right" | null;
}

export function GoalCard({
  goal,
  checkInToday,
  analytics: _analytics,
  index,
  weekHistory,
  weekHistoryLoading = false,
  mode,
  onCheckIn,
  onDoneCardTap,
  onExitComplete,
  isDarkMode,
  isCheckingIn = false,
  isSkipping = false,
  animateIn = false,
  exitDirection = null,
  isExiting = false,
  entryFrom = null,
}: GoalCardProps) {
  const [showSkipModal, setShowSkipModal] = useState(false);

  // ── Drag state ───────────────────────────────────────────────────────────────
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragDirection = dragX > 0 ? "right" : dragX < 0 ? "left" : null;
  const dragProgress = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const cardRef = useRef<HTMLButtonElement>(null);
  const pointerStartX = useRef(0);
  const pointerStartY = useRef(0);
  const isPointerDown = useRef(false);
  const isHorizontalSwipe = useRef(false);
  const dragXRef = useRef(0);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isSuccess = checkInToday?.checkInType === "success";
  const isSkipped = checkInToday?.checkInType === "skip";
  const goalIcon = getGoalIcon(goal.iconName);
  const themeColor = goal.themeColor;
  const keystoneText = goal.wishDescription || goal.wish;

  const cardBgIdle = themeColor
    ? `color-mix(in srgb, ${themeColor} 8%, oklch(var(--card)))`
    : "oklch(var(--card))";

  // ── Card style ────────────────────────────────────────────────────────────────
  function getCardStyle(): React.CSSProperties {
    const embossed = isDarkMode
      ? "-5px -5px 14px rgba(70,70,80,0.55), 8px 8px 20px rgba(0,0,0,0.9)"
      : "-5px -5px 14px rgba(90,90,100,0.6), 8px 8px 20px rgba(0,0,0,0.75)";
    const litBorderOpacity = isDarkMode ? 0.12 : 0.18;
    const litBorder = `1px solid rgba(255,255,255,${litBorderOpacity})`;

    if (mode === "done" && isSuccess) {
      return {
        background: cardBgIdle,
        boxShadow: embossed,
        border: `2px solid ${SUCCESS_COLOR}`,
        cursor: "pointer",
      };
    }
    if (mode === "done" && isSkipped) {
      return {
        background: cardBgIdle,
        boxShadow: embossed,
        border: `2px solid ${SKIP_COLOR}`,
        cursor: "pointer",
      };
    }

    // Active/Idle — dragging applies color overlay
    let bgStyle = cardBgIdle;
    if (isDragging && dragProgress > 0) {
      const overlayColor =
        dragDirection === "right"
          ? `rgba(16, 185, 129, ${0.18 * dragProgress})`
          : dragDirection === "left"
            ? `rgba(3, 105, 161, ${0.18 * dragProgress})`
            : "transparent";
      bgStyle = `color-mix(in srgb, ${overlayColor} 100%, ${cardBgIdle})`;
    }

    return {
      background: bgStyle,
      boxShadow: embossed,
      borderLeft: "4px solid transparent",
      borderTop: litBorder,
      borderRight: "none",
      borderBottom: "none",
    };
  }

  // ── Pointer handlers (active cards only) ──────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (mode !== "active" || isExiting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    isHorizontalSwipe.current = false;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isPointerDown.current || mode !== "active" || isExiting) return;
    e.preventDefault();
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;
    if (!isHorizontalSwipe.current && Math.abs(dx) > 6) {
      if (Math.abs(dy) > Math.abs(dx)) {
        isPointerDown.current = false;
        return;
      }
      isHorizontalSwipe.current = true;
      setIsDragging(true);
    }
    if (isHorizontalSwipe.current) {
      const clamped = Math.max(
        -(SWIPE_THRESHOLD * 1.5),
        Math.min(SWIPE_THRESHOLD * 1.5, dx),
      );
      dragXRef.current = clamped;
      setDragX(clamped);
    }
  }

  function onPointerUp() {
    // Done mode: only trigger tap if it was a tap (not a scroll drag)
    if (mode === "done") {
      isPointerDown.current = false;
      dragXRef.current = 0;
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipe.current = false;
      // Tap on the card surface does nothing — only the yellow Undo button triggers undo
      return;
    }

    if (!isPointerDown.current || isExiting) return;
    isPointerDown.current = false;

    const finalDragX = dragXRef.current;
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
    isHorizontalSwipe.current = false;

    if (finalDragX >= SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate([15]);
      onCheckIn?.(goal.id, "success");
    } else if (finalDragX <= -SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate([15]);
      setShowSkipModal(true);
    }
  }

  function onPointerCancel() {
    if (mode !== "active") return;
    isPointerDown.current = false;
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
    isHorizontalSwipe.current = false;
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {};
  }, []);

  // ── Skip modal confirm ────────────────────────────────────────────────────────
  function handleSkipConfirm(obstacleTemplateId?: bigint) {
    onCheckIn?.(goal.id, "skip", obstacleTemplateId);
    setShowSkipModal(false);
  }

  // ── Icon color ────────────────────────────────────────────────────────────────
  const iconColor =
    mode === "done" && isSuccess
      ? SUCCESS_COLOR
      : mode === "done" && isSkipped
        ? SKIP_COLOR
        : (themeColor ?? "oklch(var(--muted-foreground))");

  // ── Swipe icon opacity ────────────────────────────────────────────────────────
  const swipeIconOpacity = Math.max(0, (dragProgress - 0.3) / 0.7);

  // ── Week history color balls ──────────────────────────────────────────────────
  const today = new Date();
  const WEEK_SLOTS = ["w0", "w1", "w2", "w3", "w4", "w5", "w6"] as const;
  const weekSlotData = WEEK_SLOTS.map((id, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const label = d.toLocaleDateString("en-US", { weekday: "short" }).charAt(0);
    const status = (weekHistory?.[i] ?? "none") as DayStatus;
    return { id, label, status };
  });

  function getBallColor(status: DayStatus): string {
    if (status === "success") return SUCCESS_COLOR;
    if (status === "skip") return SKIP_COLOR;
    return GREY_COLOR;
  }

  // ── Animation variants ───────────────────────────────────────────────────────
  const EXIT_DURATION_MS = 320; // slightly longer than CSS duration for safety
  const EXIT_DURATION = 0.28;
  const exitTransition = {
    duration: EXIT_DURATION,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  } as const;
  const exitXTarget =
    exitDirection === "right" ? "110%" : exitDirection === "left" ? "-110%" : 0;

  // Done-tab entry: slide in from the direction the card was swiped
  const entryFromX =
    entryFrom === "right" ? 60 : entryFrom === "left" ? -60 : 0;

  // ── Reliable exit callback via setTimeout ──────────────────────────────────
  // Using a timer instead of onAnimationComplete because AnimatePresence can
  // remove the DOM node before the animation callback fires, especially in
  // popLayout mode. The timer fires after the animation duration + a small
  // buffer, and is cleaned up if isExiting flips back to false (undo scenario).
  const exitFiredRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isExiting) {
      // New exit animation starting — reset guard and schedule callback
      exitFiredRef.current = false;
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => {
        if (!exitFiredRef.current) {
          exitFiredRef.current = true;
          onExitComplete?.(goal.id);
        }
      }, EXIT_DURATION_MS);
    } else {
      // isExiting reset (undo) — cancel pending timer and reset guard
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      exitFiredRef.current = false;
    }
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [isExiting, goal.id, onExitComplete]);

  const motionProps = (() => {
    if (mode === "done") {
      // Done-tab card: slide in from the direction it was swiped
      return {
        initial: { opacity: 0, x: entryFromX },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
        transition: {
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
        },
      };
    }
    if (isExiting) {
      // Phase 1: card plays its directional slide-out animation while still
      // in the Active DOM. onAnimationComplete fires when this finishes.
      return {
        initial: false as const,
        animate: {
          opacity: 0,
          x: exitXTarget,
          scale: 0.92,
          transition: exitTransition,
        },
        exit: {
          opacity: 0,
          x: exitXTarget,
          scale: 0.92,
          transition: exitTransition,
        },
      };
    }
    if (animateIn) {
      // Undo bounce-in from left
      return {
        initial: { opacity: 0, x: -40, scale: 0.94 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: {
          opacity: 0,
          x: exitXTarget,
          scale: 0.92,
          transition: exitTransition,
        },
        transition: {
          duration: 0.4,
          ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
        },
      };
    }
    // Default idle active card
    return {
      initial: { opacity: 0, y: 18 },
      animate: { opacity: 1, y: 0 },
      exit: {
        opacity: 0,
        x: exitXTarget,
        scale: 0.92,
        transition: exitTransition,
      },
      transition: { delay: index * 0.08, duration: 0.35 },
    };
  })();

  return (
    <>
      <motion.div
        {...motionProps}
        layout
        className="relative"
        data-ocid={`goal.card.${index + 1}`}
      >
        {/* ── Swipe reveal background (behind card during drag) ──────────────── */}
        {mode === "active" && (
          <div
            className="absolute inset-0 rounded-2xl flex items-center pointer-events-none overflow-hidden"
            aria-hidden="true"
            style={{
              background:
                dragDirection === "right"
                  ? `rgba(16, 185, 129, ${0.22 * dragProgress})`
                  : dragDirection === "left"
                    ? `rgba(3, 105, 161, ${0.22 * dragProgress})`
                    : "transparent",
            }}
          >
            {dragDirection === "right" && (
              <div
                className="absolute left-4 flex items-center justify-center w-9 h-9 rounded-full"
                style={{
                  opacity: swipeIconOpacity,
                  backgroundColor: "rgba(16, 185, 129, 0.25)",
                  transform: `scale(${0.7 + 0.3 * dragProgress})`,
                }}
              >
                <Check
                  size={18}
                  style={{ color: SUCCESS_COLOR }}
                  strokeWidth={3}
                />
              </div>
            )}
            {dragDirection === "left" && (
              <div
                className="absolute right-4 flex items-center justify-center w-9 h-9 rounded-full"
                style={{
                  opacity: swipeIconOpacity,
                  backgroundColor: "rgba(3, 105, 161, 0.25)",
                  transform: `scale(${0.7 + 0.3 * dragProgress})`,
                }}
              >
                <Pause
                  size={18}
                  style={{ color: SKIP_COLOR }}
                  strokeWidth={2.5}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Main card surface ──────────────────────────────────────────────── */}
        <button
          ref={cardRef}
          type="button"
          tabIndex={0}
          aria-label={
            mode === "done"
              ? `${keystoneText} — ${isSuccess ? "completed" : "skipped"}. Tap to undo.`
              : `${keystoneText} — swipe right to complete, left to skip`
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={(e) => {
            if (mode === "active" && e.key === "Enter")
              onCheckIn?.(goal.id, "success");
            if (mode === "done" && e.key === "Enter") onDoneCardTap?.(goal.id);
          }}
          className="relative select-none overflow-hidden rounded-2xl w-full text-left bg-transparent border-0"
          style={{
            cursor: mode === "done" ? "pointer" : "grab",
            transform: mode === "active" ? `translateX(${dragX}px)` : undefined,
            transition:
              mode === "active" && isDragging
                ? "none"
                : "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
            padding: "1.25rem 1.25rem 1rem",
            userSelect: "none",
            WebkitUserSelect: "none",
            touchAction: mode === "active" ? "none" : "auto",
            ...getCardStyle(),
          }}
        >
          {/* ── State dot (done cards) ─────────────────────────────────────── */}
          {mode === "done" && (
            <div
              className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full"
              style={{
                backgroundColor: isSuccess ? SUCCESS_COLOR : SKIP_COLOR,
                opacity: 0.85,
              }}
              aria-hidden="true"
            />
          )}

          {/* ── Loading spinner ──────────────────────────────────────────────── */}
          {(isCheckingIn || isSkipping) && mode === "active" && (
            <div
              className="absolute top-4 right-4 w-4 h-4 border-2 rounded-full animate-spin"
              style={{
                borderColor: "rgba(16,185,129,0.3)",
                borderTopColor: SUCCESS_COLOR,
              }}
              aria-hidden="true"
            />
          )}

          {/* ── Content: icon + text ─────────────────────────────────────────── */}
          <div className="flex items-start gap-3">
            {/* Icon orb */}
            <div
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
              style={{
                background: themeColor
                  ? `color-mix(in srgb, ${themeColor} 18%, oklch(var(--card)))`
                  : "oklch(var(--muted) / 0.5)",
                boxShadow:
                  "inset 1px 1px 3px rgba(0,0,0,0.55), inset -1px -1px 2px rgba(80,80,85,0.2)",
              }}
            >
              <span className="w-5 h-5 shrink-0" style={{ color: iconColor }}>
                {goalIcon.svg}
              </span>
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg font-semibold text-foreground leading-snug line-clamp-2">
                {keystoneText}
              </h3>
            </div>
          </div>

          {/* ── 7-Day Week Calendar ───────────────────────────────────────────── */}
          <div className="mt-3 flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              {weekHistoryLoading
                ? WEEK_SLOTS.map((id) => (
                    <div
                      key={id}
                      className="w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ backgroundColor: GREY_COLOR }}
                    />
                  ))
                : weekSlotData.map(({ id, status }) => (
                    <div
                      key={id}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: getBallColor(status),
                        opacity: status === "none" ? 0.35 : 0.9,
                      }}
                      aria-hidden="true"
                    />
                  ))}
            </div>
            {/* Day labels */}
            <div className="flex items-center gap-1.5">
              {weekSlotData.map(({ id, label }) => (
                <div
                  key={id}
                  className="w-2.5 text-center"
                  style={{
                    fontSize: "9px",
                    color: "oklch(var(--muted-foreground) / 0.55)",
                    lineHeight: 1,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Done tab: yellow Undo button ────────────────────────────── */}
          {mode === "done" && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDoneCardTap?.(goal.id);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-smooth select-none"
                style={{
                  backgroundColor: "#EAB308",
                  color: "#000",
                  boxShadow:
                    "-2px -2px 5px rgba(60,60,60,0.3), 3px 3px 7px rgba(0,0,0,0.55)",
                }}
                aria-label="Undo this check-in"
                data-ocid={`goal.done_undo_button.${index + 1}`}
              >
                Undo
              </button>
            </div>
          )}
        </button>
      </motion.div>

      {mode === "active" && (
        <SkipModal
          goal={goal}
          open={showSkipModal}
          onClose={() => setShowSkipModal(false)}
          onConfirm={handleSkipConfirm}
          isLoading={isSkipping}
        />
      )}
    </>
  );
}
