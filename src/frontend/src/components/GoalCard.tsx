import {
  Check,
  ChevronRight,
  Lock,
  LockOpen,
  Pause,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { GoalAnalytics, HabitPublic } from "../types";

import { cn } from "@/lib/utils";
import { MissedWindowSheet } from "./MissedWindowSheet";
import { SkipModal } from "./SkipModal";
import { WoopCatchSheet } from "./WoopCatchSheet";

// ─── Accent constants ──────────────────────────────────────────────────────────
const SUCCESS_COLOR = "#10B981"; // Emerald Green
const SKIP_COLOR = "#0369A1"; // Ocean Blue
const GREY_COLOR = "#4B5563"; // No record at all — fainter grey ball
const MISSED_COLOR = "#6B7280"; // Missed day — definite muted grey ball

const SWIPE_THRESHOLD = 60;

// How long the if-then follow-up note stays available on the Done card after
// the habit is completed. After this window the note simply disappears and the
// habit stays done without the if-then tag (a normal outcome).
const IF_THEN_NOTE_WINDOW_MS = 45_000;

// localStorage key prefix for permanently dismissing the if-then follow-up note
// per check-in. The full key is `${IF_THEN_DISMISS_KEY_PREFIX}${checkInId}`.
// Persisting by check-in id means the dismissal survives GoalCard unmounting
// when the user switches tabs or navigates away and back — exactly like the
// backend-driven executedIfThen flag does for 'Used it'.
const IF_THEN_DISMISS_KEY_PREFIX = "cumulative-ifthen-dismiss-";

function isIfThenDismissed(checkInId: bigint | undefined): boolean {
  if (checkInId === undefined) return false;
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem(`${IF_THEN_DISMISS_KEY_PREFIX}${checkInId}`) === "1"
  );
}

// localStorage key prefix for the missed-window sheet's auto-show marker.
// The full key is `${MISSED_SHEET_KEY_PREFIX}${goalId}-${date}-${failureType}`.
// Persisting by goal id + calendar day + failure type means the "already
// shown/dismissed" decision survives GoalCard unmounting when the user
// navigates away and back — the same persistent-input pattern the if-then
// follow-up note uses — so the sheet never re-pops for an unresolved missed
// state the user has already seen.
const MISSED_SHEET_KEY_PREFIX = "cumulative-missed-sheet-";

function missedSheetKey(goalId: bigint, failureType: string): string {
  const today = new Date().toDateString();
  return `${MISSED_SHEET_KEY_PREFIX}${goalId}-${today}-${failureType}`;
}

function isMissedSheetShown(goalId: bigint, failureType: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(missedSheetKey(goalId, failureType)) === "1";
}

function markMissedSheetShown(goalId: bigint, failureType: string): void {
  try {
    localStorage.setItem(missedSheetKey(goalId, failureType), "1");
  } catch {
    // best-effort — persistence is a nicety, not a requirement
  }
}

export type DayStatus = "success" | "skip" | "missed" | "none";

// ─── Lock-In types & helpers ──────────────────────────────────────────────────
export type LockInState =
  | "waiting" // before start window
  | "start-window" // within ±5min of startTime
  | "in-progress" // checked-in but not checked out
  | "end-window" // in-progress + within ±5min of endTime
  | "missed-start" // past startTime window, unstarted
  | "missed-checkout" // in-progress, past endTime window
  | "completed" // success check-in recorded — Lock-In done
  | "failed-finalized"; // missedCheckIn or missedCheckOut recorded

export interface LockInCheckIn {
  type: "inProgress" | "missedCheckIn" | "missedCheckOut" | "success";
  startedAt?: number;
  endedAt?: number;
}

function parseTimeToday(timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function getLockInState(
  startTime: string,
  endTime: string,
  todayCheckIn: LockInCheckIn | undefined,
  createdAt?: bigint,
): LockInState {
  const now = Date.now();
  const start = parseTimeToday(startTime).getTime();
  const end = parseTimeToday(endTime).getTime();
  const WINDOW = 5 * 60 * 1000;

  if (todayCheckIn?.type === "success") return "completed";
  if (
    todayCheckIn?.type === "missedCheckIn" ||
    todayCheckIn?.type === "missedCheckOut"
  )
    return "failed-finalized";

  if (todayCheckIn?.type === "inProgress") {
    if (Math.abs(now - end) <= WINDOW) return "end-window";
    if (now > end + WINDOW) return "missed-checkout";
    return "in-progress";
  }

  if (Math.abs(now - start) <= WINDOW) return "start-window";
  if (now < start - WINDOW) return "waiting";
  if (createdAt !== undefined) {
    const createdMs = Number(createdAt / 1_000_000n);
    // Only suppress the missed state if the habit was created AFTER the window expired today
    if (createdMs > start + WINDOW) {
      const createdDate = new Date(createdMs).toDateString();
      const todayDate = new Date().toDateString();
      if (createdDate === todayDate) return "waiting";
    }
  }
  return "missed-start";
}

function formatTime24h(timeStr: string): string {
  return timeStr;
}

/** Live 1-second countdown display for Lock-In cards. */
function useLockInTimer(
  isLockIn: boolean,
  startTime: string | undefined,
  endTime: string | undefined,
  lockInTodayCheckIn: LockInCheckIn | undefined,
) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isLockIn) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isLockIn]);

  if (!isLockIn || !startTime || !endTime) return null;

  void tick;
  const WINDOW_MS = 5 * 60 * 1000;
  const now = Date.now();

  function parseMs(t: string): number {
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }

  const startMs = parseMs(startTime);
  const endMs = parseMs(endTime);
  const startWindowEnd = startMs + WINDOW_MS;
  const endWindowEnd = endMs + WINDOW_MS;

  function fmtCountdown(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const mn = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function fmtRemaining(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const mn = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  const checkInType = lockInTodayCheckIn?.type;

  if (!checkInType && Math.abs(now - startMs) <= WINDOW_MS) {
    return {
      state: "start-window" as const,
      text: `WINDOW: ${fmtCountdown(startWindowEnd - now)}`,
      color: "#F97316",
      pulse: true,
    };
  }
  if (!checkInType && now < startMs - WINDOW_MS) {
    return {
      state: "upcoming" as const,
      text: `STARTS IN ${fmtCountdown(startMs - WINDOW_MS - now)}`,
      color: "#9CA3AF",
      pulse: false,
    };
  }
  if (checkInType === "inProgress" && Math.abs(now - endMs) <= WINDOW_MS) {
    return {
      state: "end-window" as const,
      text: `WINDOW: ${fmtCountdown(endWindowEnd - now)}`,
      color: "#F97316",
      pulse: true,
    };
  }
  if (checkInType === "inProgress") {
    return {
      state: "in-progress" as const,
      text: `REMAINING ${fmtRemaining(endMs - now)}`,
      color: "#F59E0B",
      pulse: false,
    };
  }
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface GoalCardProps {
  goal: HabitPublic;
  checkInToday?:
    | {
        checkInType:
          | "success"
          | "skip"
          | "missed"
          | "inProgress"
          | "missedCheckIn"
          | "missedCheckOut";
        obstacleTemplateId?: bigint;
      }
    | undefined;
  analytics?: GoalAnalytics;
  index: number;
  weekHistory?: DayStatus[];
  weekHistoryLoading?: boolean;
  mode: "active" | "done";
  onCheckIn?: (
    goalId: bigint,
    type: "success" | "skip" | "inProgress",
    obstacleId?: bigint,
    lockInStartedAt?: number,
    lockInEndedAt?: number,
    executedIfThen?: boolean,
    note?: string,
  ) => void;
  onDoneCardTap?: (goalId: bigint) => void;
  onExitComplete?: (goalId: bigint) => void;
  onInsightOpen?: (goal: HabitPublic) => void;
  isDarkMode: boolean;
  isCheckingIn?: boolean;
  isSkipping?: boolean;
  animateIn?: boolean;
  exitDirection?: "left" | "right" | null;
  isExiting?: boolean;
  entryFrom?: "left" | "right" | null;
  // Lock-In props
  isLockIn?: boolean;
  lockInStartTime?: string;
  lockInEndTime?: string;
  lockInTodayCheckIn?: LockInCheckIn;
  onMissedWindowTap?: (goalId: bigint) => void;
  // Bug 3/4: brief pulse animation when Lock-In check-in is confirmed (stays in Active)
  inProgressPulse?: boolean;
  /** Whether this check-in was an If-Then revival (executedIfThen: true) */
  executedIfThen?: boolean;
  /** Check-in id for the if-then follow-up note (Done card). Set only for
   *  habits with an if-then plan that were just completed. */
  ifThenCheckInId?: bigint;
  /** Persisted timestamp (IC nanoseconds) of the check-in the if-then
   *  follow-up note refers to. Used to derive the note's visibility from real
   *  elapsed time so it can never reappear once the display window passes. */
  ifThenCheckInTimestamp?: bigint;
  /** Called when the user taps 'Used it' on the if-then follow-up note. */
  onMarkIfThenUsed?: (goalId: bigint, checkInId: bigint) => void;
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
  onInsightOpen,
  isDarkMode,
  isCheckingIn = false,
  isSkipping = false,
  animateIn = false,
  exitDirection = null,
  isExiting = false,
  entryFrom = null,
  isLockIn = false,
  lockInStartTime,
  lockInEndTime,
  lockInTodayCheckIn,
  onMissedWindowTap,
  inProgressPulse = false,
  executedIfThen = false,
  ifThenCheckInId,
  ifThenCheckInTimestamp,
  onMarkIfThenUsed,
}: GoalCardProps) {
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showMissedSheet, setShowMissedSheet] = useState(false);
  // WOOP Catch sheet — shown on left swipe for normal (non-LockIn) habits
  const [showWoopCatch, setShowWoopCatch] = useState(false);
  // Re-render trigger for the if-then note. The note's visibility is DERIVED
  // fresh on every render from persisted inputs (check-in timestamp,
  // executedIfThen, localStorage dismissal) — this state only forces a
  // re-render so a localStorage dismissal write takes effect immediately. It
  // never holds the note's visibility, so it cannot cause the note to reappear
  // on remount.
  const [, setIfThenDismissTick] = useState(0);
  // Press feedback: brief scale-down + inward shadow on clean tap
  const [isTapped, _setIsTapped] = useState(false);
  // exitCommittedRef: once set to true, no re-render can revert this card
  // to a missed/active state or re-trigger the justification sheet.
  const exitCommittedRef = useRef(false);

  // ── Card completion pulse (success exit) ──────────────────────────────────
  // When the card is exiting due to a successful right-swipe (isExiting &&
  // exitDirection === "right"), we layer a soft emerald glow pulse on the
  // motion.div wrapper AND render a checkmark overlay that pops in. Both are
  // gated behind useReducedMotion — reduced-motion users get neither.
  const prefersReducedMotion = useReducedMotion();
  const isSuccessExit =
    isExiting && exitDirection === "right" && !prefersReducedMotion;

  // ── Lock-In state ─────────────────────────────────────────────────────────────
  const lockInState =
    isLockIn &&
    lockInStartTime != null &&
    lockInStartTime !== "" &&
    lockInEndTime != null &&
    lockInEndTime !== "" &&
    mode === "active"
      ? getLockInState(
          lockInStartTime,
          lockInEndTime,
          lockInTodayCheckIn,
          goal.createdAt,
        )
      : null;

  // Live countdown timer for Lock-In cards
  const lockInTimer = useLockInTimer(
    isLockIn && mode === "active",
    lockInStartTime,
    lockInEndTime,
    lockInTodayCheckIn,
  );

  const lockInSwipeDisabled =
    lockInState !== null &&
    lockInState !== "start-window" &&
    lockInState !== "end-window";

  // ── Current failure type for MissedWindowSheet ────────────────────────────────
  const currentFailureType: "missed-start" | "missed-checkout" =
    lockInState === "missed-checkout" ? "missed-checkout" : "missed-start";

  // ── Auto-trigger missed sheet once when lockInState becomes a missed state ─────
  // exitCommittedRef guards against re-fire after the user submitted the sheet
  // and the card is animating out (before lockInCheckInMap updates from backend).
  // The "already shown/dismissed" decision is persisted in localStorage keyed by
  // goal id + calendar day + failure type (see markMissedSheetShown), so it
  // survives GoalCard unmounting when the user navigates away and back — the
  // sheet never re-pops for an unresolved missed state the user has already seen.
  useEffect(() => {
    if (exitCommittedRef.current) return; // card already committed to exit — never re-trigger
    if (lockInState === "missed-start" || lockInState === "missed-checkout") {
      const failureType =
        lockInState === "missed-checkout" ? "checkout" : "start";
      if (!isMissedSheetShown(goal.id, failureType)) {
        markMissedSheetShown(goal.id, failureType);
        const t = setTimeout(() => {
          if (!exitCommittedRef.current) setShowMissedSheet(true);
        }, 550);
        return () => clearTimeout(t);
      }
    }
  }, [lockInState, goal.id]);

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
  // Tracks whether a modal/sheet was opened during the current pointer gesture.
  // When true, onInsightOpen must NOT fire on pointerUp.
  const modalOpenedDuringGestureRef = useRef(false);
  // Set to true when the user's first motion is primarily vertical — allows native scroll.
  const isVerticalScrollRef = useRef(false);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isSuccess = checkInToday?.checkInType === "success";
  const isSkipped = checkInToday?.checkInType === "skip";
  const isMissed = checkInToday?.checkInType === "missed";
  const isMissedCheckIn = checkInToday?.checkInType === "missedCheckIn";
  const isMissedCheckOut = checkInToday?.checkInType === "missedCheckOut";
  const isFailedLockIn = isMissedCheckIn || isMissedCheckOut;
  // Whether this habit has an if-then plan set — gates the optional success note.
  const hasIfThenPlan = !!goal.ifThenPlan?.trim();
  const rawWishDescription = goal.wishDescription || goal.wish;
  // Strip the wizard-assembled prefix "Every day, I will " → display "I will …"
  const keystoneText = rawWishDescription.startsWith("Every day, I will ")
    ? `I will ${rawWishDescription.slice("Every day, I will ".length)}`
    : rawWishDescription.startsWith("Every day ,")
      ? `I will ${rawWishDescription.slice("Every day ,".length).trimStart()}`
      : rawWishDescription;

  // Dashboard card background tint. Habits carry their own saved themeColor
  // (a hex string) and tint with it; macro goals have no selectable color and
  // always use the fixed gold accent (same as the dashboard goal header).
  const cardBgIdle = goal.themeColor
    ? `color-mix(in srgb, ${goal.themeColor} 8%, oklch(var(--card)))`
    : "color-mix(in srgb, oklch(var(--goal-wizard-gold)) 8%, oklch(var(--card)))";

  // ── Card style ────────────────────────────────────────────────────────────────
  function getCardStyle(): React.CSSProperties {
    const embossed = isDarkMode
      ? "-5px -5px 14px rgba(70,70,80,0.55), 8px 8px 20px rgba(0,0,0,0.9)"
      : "-5px -5px 14px rgba(90,90,100,0.6), 8px 8px 20px rgba(0,0,0,0.75)";
    const litBorderOpacity = isDarkMode ? 0.12 : 0.18;
    const litBorder = `1px solid rgba(255,255,255,${litBorderOpacity})`;

    // Done tab states
    if (mode === "done" && (isFailedLockIn || isMissed)) {
      return {
        background: cardBgIdle,
        boxShadow: embossed,
        border: `1px solid ${MISSED_COLOR}`,
        cursor: "pointer",
      };
    }
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

    // Lock-In active states
    if (lockInState === "completed") {
      return {
        background: cardBgIdle,
        boxShadow: embossed,
        border: `2px solid ${SUCCESS_COLOR}`,
        opacity: 0.75,
        cursor: "pointer",
      };
    }
    if (lockInState === "missed-start" || lockInState === "missed-checkout") {
      return {
        background: `color-mix(in srgb, rgba(245,158,11,0.06) 100%, ${cardBgIdle})`,
        boxShadow: embossed,
        border: "1px solid rgba(245,158,11,0.5)",
        opacity: 0.9,
        cursor: "pointer",
      };
    }
    if (lockInState === "failed-finalized") {
      return {
        background: cardBgIdle,
        boxShadow: embossed,
        border: `1px solid ${MISSED_COLOR}`,
        opacity: 0.65,
        cursor: "pointer",
      };
    }
    if (lockInState === "in-progress") {
      return {
        background: cardBgIdle,
        boxShadow: embossed,
        borderTop: "2px solid #F59E0B",
        borderLeft: "2px solid #F59E0B",
        borderRight: litBorder,
        borderBottom: litBorder,
      };
    }
    if (lockInState === "start-window" || lockInState === "end-window") {
      return {
        background: cardBgIdle,
        boxShadow: `${embossed}, 0 0 12px rgba(245,158,11,0.2)`,
        borderTop: litBorder,
        borderLeft: "4px solid #F59E0B",
        borderRight: "none",
        borderBottom: "none",
      };
    }
    if (lockInState === "waiting") {
      return {
        background: cardBgIdle,
        boxShadow: embossed,
        borderTop: litBorder,
        borderLeft: "4px solid transparent",
        borderRight: "none",
        borderBottom: "none",
        opacity: 0.6,
        cursor: "not-allowed",
      };
    }

    // Normal active: drag color overlay
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

  // ── Pointer handlers ──────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    modalOpenedDuringGestureRef.current = false;
    isVerticalScrollRef.current = false;
    // Done-mode: record start position for clean-tap detection
    if (mode === "done") {
      isPointerDown.current = true;
      pointerStartX.current = e.clientX;
      pointerStartY.current = e.clientY;
      dragXRef.current = 0;
      return;
    }
    if (mode !== "active" || isExiting) return;
    if (lockInSwipeDisabled) {
      // Always record pointer start so a clean tap can be detected in onPointerUp.
      // Do NOT capture pointer yet — let native scroll handle vertical drags.
      isPointerDown.current = true;
      pointerStartX.current = e.clientX;
      pointerStartY.current = e.clientY;
      dragXRef.current = 0;
      // missed / failed-finalized: sheet is opened via the amber button or auto-trigger;
      // waiting / in-progress / completed: just record start (tap → insight).
      return;
    }
    // Do NOT capture pointer on pointerdown — only capture after confirming
    // horizontal intent (12px threshold). This lets vertical swipes pass to
    // native page scroll without any interference.
    isPointerDown.current = true;
    isHorizontalSwipe.current = false;
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isPointerDown.current) return;
    // If we already determined this is a vertical scroll, do nothing.
    if (isVerticalScrollRef.current) return;
    // Done mode or lock-in-disabled: just track horizontal drift for tap detection
    if (mode !== "active" || isExiting || lockInSwipeDisabled) {
      dragXRef.current = e.clientX - pointerStartX.current;
      return;
    }
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!isHorizontalSwipe.current) {
      // Once 5px of total movement: check direction.
      if (dist > 5) {
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical-first — release pointer capture & hand off to native scroll.
          isVerticalScrollRef.current = true;
          isPointerDown.current = false;
          dragXRef.current = 0;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch (_) {
            // Not captured yet — ignore.
          }
          return;
        }
      }
      // Confirm horizontal intent after 12px horizontal threshold.
      if (Math.abs(dx) > 12) {
        isHorizontalSwipe.current = true;
        setIsDragging(true);
        // Capture pointer now that we are certain of horizontal intent.
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) {
          // Already captured or unavailable — ignore.
        }
      }
    }
    if (isHorizontalSwipe.current) {
      e.preventDefault();
      const clamped = Math.max(
        -(SWIPE_THRESHOLD * 1.5),
        Math.min(SWIPE_THRESHOLD * 1.5, dx),
      );
      dragXRef.current = clamped;
      setDragX(clamped);
    }
  }

  function onPointerUp() {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;

    const finalDragX = dragXRef.current;
    dragXRef.current = 0;

    // ── Done mode ─────────────────────────────────────────────────────────────
    if (mode === "done") {
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipe.current = false;
      // Done card body tap intentionally does nothing — use the habit name button to open timeline.
      return;
    }

    if (isExiting) return;

    setDragX(0);
    setIsDragging(false);
    isHorizontalSwipe.current = false;

    // ── Lock-In swipe-disabled states ─────────────────────────────────────────
    if (lockInSwipeDisabled) {
      // Card body tap does nothing — use the habit name button to open timeline.
      return;
    }

    // ── Swipe gestures ────────────────────────────────────────────────────────
    if (finalDragX >= SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate([15]);
      if (lockInState === "start-window") {
        onCheckIn?.(goal.id, "inProgress", undefined, Date.now());
      } else if (lockInState === "end-window") {
        onCheckIn?.(goal.id, "success", undefined, undefined, Date.now());
      } else {
        // Complete immediately — identical for habits with or without an
        // if-then plan. The if-then follow-up note (if any) is shown later as a
        // non-blocking follow-up on the Done card, never blocking completion.
        onCheckIn?.(goal.id, "success");
      }
    } else if (finalDragX <= -SWIPE_THRESHOLD) {
      if (lockInState !== null) return; // Lock-In: no left swipe
      if (navigator.vibrate) navigator.vibrate([15]);
      modalOpenedDuringGestureRef.current = true;
      // WOOP Catch: snap card back to center, open sheet over dashboard.
      // Skip the if-then plan-check sheet entirely for habits with no plan set
      // and go straight to the normal skip screen.
      if (hasIfThenPlan) {
        setShowWoopCatch(true);
      } else {
        setShowSkipModal(true);
      }
    }
    // Active card body tap intentionally does nothing — use the habit name button to open timeline.
  }

  function onPointerCancel() {
    if (mode !== "active") return;
    isPointerDown.current = false;
    isVerticalScrollRef.current = false;
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
    isHorizontalSwipe.current = false;
  }

  useEffect(() => {
    return () => {};
  }, []);

  // ── Skip/Missed confirm ────────────────────────────────────────────────
  function handleSkipConfirm(obstacleTemplateId?: bigint, note?: string) {
    onCheckIn?.(
      goal.id,
      "skip",
      obstacleTemplateId,
      undefined,
      undefined,
      false,
      note,
    );
    setShowSkipModal(false);
  }

  function handleMissedConfirm(obstacleTemplateId?: bigint, note?: string) {
    // Commit exit immediately — prevents any subsequent re-render from
    // re-triggering the justification sheet or reverting the card to Active.
    exitCommittedRef.current = true;
    setShowMissedSheet(false);
    // Fire as inProgress; DashboardPage checks lockInState and maps to
    // missedCheckIn or missedCheckOut based on current lockInState.
    onCheckIn?.(
      goal.id,
      "inProgress",
      obstacleTemplateId,
      undefined,
      undefined,
      false,
      note,
    );
  }

  // WOOP Catch handlers
  function handleWoopCatchExecutedPlan() {
    // User executed their If-Then Plan → log as success with executedIfThen:true
    setShowWoopCatch(false);
    onCheckIn?.(goal.id, "success", undefined, undefined, undefined, true);
  }

  function handleWoopCatchProceedToSkip() {
    // User still needs to skip → close WOOP Catch, open obstacle sheet
    setShowWoopCatch(false);
    setShowSkipModal(true);
  }

  // If-then follow-up note handlers — the habit is already done. 'Used it'
  // tags the already-created check-in via markCheckInIfThenUsed; dismissing or
  // ignoring just hides the note (the habit stays done without the tag).
  function handleIfThenUsed() {
    // Tagging the check-in as used flips executedIfThen to true (via
    // markCheckInIfThenUsed → backend refetch), which the derived visibility
    // reads to hide the note. No in-moment state to clear. Guard against the
    // optimistic 0n placeholder id — the real id lands via onSuccess and the
    // note re-evaluates once ifThenCheckInIdMap is populated.
    if (ifThenCheckInId !== undefined && ifThenCheckInId !== 0n) {
      onMarkIfThenUsed?.(goal.id, ifThenCheckInId);
    }
  }

  function handleIfThenDismiss() {
    // Persist the dismissal keyed by check-in id so the note stays hidden for
    // this check-in across page/tab navigation (GoalCard unmounts on tab
    // switch). Mirrors the localStorage persistent-UI pattern used by useTheme
    // and DashboardPage's NEW_HABIT_KEY. The tick forces a re-render so the
    // derived visibility re-evaluates and hides the note immediately.
    if (ifThenCheckInId !== undefined) {
      localStorage.setItem(
        `${IF_THEN_DISMISS_KEY_PREFIX}${ifThenCheckInId}`,
        "1",
      );
    }
    setIfThenDismissTick((n) => n + 1);
  }

  function handleSkipModalClose() {
    setShowSkipModal(false);
    modalOpenedDuringGestureRef.current = false;
  }

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
    if (status === "missed") return MISSED_COLOR;
    return GREY_COLOR;
  }

  // A missed day renders the definite muted grey ball; a day with no record at
  // all renders the fainter grey ball (lower opacity) so the two are visibly
  // distinct. Success and skip balls keep their existing 0.9 opacity.
  function getBallOpacity(status: DayStatus): number {
    if (status === "none") return 0.35;
    if (status === "missed") return 0.7;
    return 0.9;
  }

  // ── Animation variants ───────────────────────────────────────────────────────
  const EXIT_DURATION_MS = 500;
  const EXIT_DURATION = 0.45;
  const exitTransition = {
    duration: EXIT_DURATION,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  } as const;
  const exitXTarget =
    exitDirection === "right" ? "110%" : exitDirection === "left" ? "-110%" : 0;
  const entryFromX =
    entryFrom === "right" ? 60 : entryFrom === "left" ? -60 : 0;

  const exitFiredRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to the latest onExitComplete so the timer closure always calls
  // the most recent version even if the prop changes between renders.
  const onExitCompleteRef = useRef(onExitComplete);
  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  });

  // ── If-then follow-up note visibility ────────────────────────────────────
  // The note appears on the Done card after a successful check-in, a skip, or
  // a missed Lock-In check-in (for habits that have an if-then plan set), so
  // the user can tag any of these outcomes as having tried the plan. It never
  // shows for habits without an if-then plan (hasIfThenPlan), and never for
  // check-ins already tagged (executedIfThen). For missed check-ins it only
  // shows on Lock-In habits (isLockIn) — never for missed check-ins on regular
  // habits.
  const isSuccessOrSkip =
    checkInToday?.checkInType === "success" ||
    checkInToday?.checkInType === "skip";
  const isMissedLockIn =
    isLockIn &&
    (checkInToday?.checkInType === "missedCheckIn" ||
      checkInToday?.checkInType === "missedCheckOut");
  // If-then follow-up note visibility — DERIVED fresh on every render from
  // persisted, non-volatile inputs so it can never reappear after navigating
  // away and back:
  //   (a) real elapsed time since the check-in is still within the display
  //       window (Date.now() - persisted timestamp),
  //   (b) the check-in has not already been tagged as used (executedIfThen),
  //   (c) the note was not explicitly dismissed (localStorage, keyed by
  //       check-in id — survives remounts).
  // Because elapsed time is derived from the persisted timestamp rather than an
  // in-moment timer, once the window passes the note stays hidden on every
  // remount, and letting it fade naturally needs no saved flag.
  const ifThenNoteWithinWindow =
    ifThenCheckInTimestamp !== undefined &&
    Date.now() - Number(ifThenCheckInTimestamp / 1_000_000n) <=
      IF_THEN_NOTE_WINDOW_MS;
  const showIfThenNote =
    mode === "done" &&
    hasIfThenPlan &&
    ifThenCheckInId !== undefined &&
    (isSuccessOrSkip || isMissedLockIn) &&
    !executedIfThen &&
    ifThenNoteWithinWindow &&
    !isIfThenDismissed(ifThenCheckInId);

  // We intentionally only depend on isExiting and goal.id here.
  useEffect(() => {
    if (isExiting) {
      if (exitTimerRef.current !== null) return;
      exitFiredRef.current = false;
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        if (!exitFiredRef.current) {
          exitFiredRef.current = true;
          onExitCompleteRef.current?.(goal.id);
        }
      }, EXIT_DURATION_MS);
    } else {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      exitFiredRef.current = false;
    }
    return () => {};
  }, [isExiting, goal.id]);

  // Separate cleanup effect: clear timer on unmount only
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, []);

  const motionProps = (() => {
    if (mode === "done") {
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

  // ── Card content: centered column with consistent spacing ─────────────────────
  const showLockInTimeBlock =
    isLockIn &&
    lockInStartTime != null &&
    lockInStartTime !== "" &&
    lockInEndTime != null &&
    lockInEndTime !== "";

  return (
    <>
      <motion.div
        {...motionProps}
        layout
        className={cn("relative", isSuccessExit && "card-complete-glow-active")}
        data-ocid={`goal.card.${index + 1}`}
        style={{ touchAction: "pan-y" }}
      >
        {/* Card completion pulse — emerald checkmark overlay (success exit only) */}
        {isSuccessExit && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            aria-hidden="true"
          >
            <div
              className="checkmark-pop-active flex items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
                background: "oklch(var(--color-accent-success) / 0.92)",
                boxShadow:
                  "0 0 18px 4px oklch(var(--color-accent-success) / 0.55), 0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              <Check size={30} strokeWidth={3.5} style={{ color: "#022c22" }} />
            </div>
          </div>
        )}

        {/* Bug 3/4: in-progress pulse animation overlay */}
        {inProgressPulse && lockInState === "in-progress" && (
          <>
            <style>{`
              @keyframes inProgressPulse {
                0%   { opacity: 0; transform: scale(0.97); }
                40%  { opacity: 0.18; transform: scale(1.01); }
                100% { opacity: 0; transform: scale(0.99); }
              }
            `}</style>
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: SUCCESS_COLOR,
                animation: "inProgressPulse 0.55s ease-out forwards",
              }}
              aria-hidden="true"
            />
          </>
        )}

        {/* Checkout window pulse — amber border glow on end-window state */}
        {lockInState === "end-window" && (
          <>
            <style>{`
              @keyframes checkoutPulse {
                0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0), inset 0 0 0 2px rgba(245,158,11,0.0); }
                40%  { box-shadow: 0 0 16px 4px rgba(245,158,11,0.5), inset 0 0 0 2px rgba(245,158,11,0.4); }
                70%  { box-shadow: 0 0 8px 2px rgba(245,158,11,0.3), inset 0 0 0 2px rgba(245,158,11,0.2); }
                100% { box-shadow: 0 0 0 0 rgba(245,158,11,0), inset 0 0 0 2px rgba(245,158,11,0.0); }
              }
            `}</style>
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                animation: "checkoutPulse 1.8s ease-in-out infinite",
                border: "2px solid transparent",
              }}
              aria-hidden="true"
            />
          </>
        )}

        {/* Bug 4: in-progress Lock-In informational tooltip */}
        {lockInState === "in-progress" && lockInEndTime && (
          <div
            className="absolute inset-x-0 bottom-0 rounded-b-2xl py-1.5 px-3 text-center text-xs font-mono pointer-events-none"
            style={{
              background: "rgba(16,185,129,0.08)",
              color: SUCCESS_COLOR,
              borderTop: "1px solid rgba(16,185,129,0.15)",
            }}
            aria-live="polite"
          >
            In progress • check out at {formatTime24h(lockInEndTime)}
          </div>
        )}

        {/* Swipe reveal background */}
        {mode === "active" && !lockInSwipeDisabled && (
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

        {/* Main card surface */}
        <button
          ref={cardRef}
          type="button"
          tabIndex={0}
          aria-label={
            mode === "done"
              ? `${keystoneText} — ${
                  isSuccess
                    ? "completed"
                    : isMissedCheckIn
                      ? "missed start window"
                      : isMissedCheckOut
                        ? "missed check-out"
                        : isMissed
                          ? "missed, no action taken"
                          : "skipped"
                }.`
              : lockInState === "completed"
                ? `${keystoneText} — lock-in completed.`
                : lockInState === "missed-start"
                  ? `${keystoneText} — start window missed. Tap to log obstacle.`
                  : lockInState === "missed-checkout"
                    ? `${keystoneText} — check-out missed. Tap to log obstacle.`
                    : lockInState === "failed-finalized"
                      ? `${keystoneText} — obstacle logged.`
                      : lockInState === "waiting"
                        ? `${keystoneText} — waiting for time window`
                        : lockInState === "in-progress"
                          ? `${keystoneText} — in progress`
                          : `${keystoneText} — swipe right to complete, left to skip`
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={(e) => {
            if (mode === "active" && e.key === "Enter") {
              onCheckIn?.(goal.id, "success");
            }
            if (mode === "done" && e.key === "Enter") onDoneCardTap?.(goal.id);
          }}
          className="relative select-none overflow-hidden rounded-2xl w-full text-left bg-transparent border-0"
          style={{
            cursor:
              mode === "done"
                ? "pointer"
                : lockInState === "completed" ||
                    lockInState === "missed-start" ||
                    lockInState === "missed-checkout" ||
                    lockInState === "failed-finalized"
                  ? "pointer"
                  : lockInState === "waiting" || lockInState === "in-progress"
                    ? "not-allowed"
                    : "grab",
            transform: isTapped
              ? "scale(0.98)"
              : mode === "active" && !lockInSwipeDisabled
                ? `translateX(${dragX}px)`
                : undefined,
            transition: isTapped
              ? "transform 0.08s ease-out, box-shadow 0.08s ease-out"
              : mode === "active" && isDragging
                ? "none"
                : "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
            padding: "1.25rem 1.25rem 1rem",
            userSelect: "none",
            WebkitUserSelect: "none",
            touchAction: "pan-y",
            ...getCardStyle(),
          }}
        >
          {/* Content: centered */}
          <div className="flex flex-col items-center text-center gap-3">
            {/* Habit title as direct tap target for timeline */}
            <button
              type="button"
              className="text-left w-full group"
              style={{
                touchAction: "none",
                cursor: "pointer",
                background: "none",
                border: "none",
                padding: 0,
                margin: 0,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onInsightOpen) {
                  if (navigator.vibrate) navigator.vibrate([8]);
                  onInsightOpen(goal);
                }
              }}
              aria-label={`View timeline for ${keystoneText}`}
              data-ocid={`goal.title_button.${index + 1}`}
            >
              <h3 className="font-display text-lg font-semibold text-foreground leading-snug line-clamp-2 active:opacity-70 transition-opacity duration-75 text-center w-full flex items-center justify-center gap-1.5">
                {mode === "done" && executedIfThen && (
                  <span
                    className="inline-flex items-center justify-center rounded-full shrink-0"
                    aria-label="Hard-fought win via If-Then plan"
                    title="Executed If-Then Plan"
                    data-ocid="goal.revival_icon"
                    style={{
                      width: "1.125em",
                      height: "1.125em",
                      background: "rgba(16,185,129,0.15)",
                      border: `1px solid ${SUCCESS_COLOR}`,
                      boxShadow: "0 0 6px rgba(16,185,129,0.35)",
                    }}
                  >
                    <Zap
                      size={11}
                      style={{
                        color: SUCCESS_COLOR,
                        filter: "drop-shadow(0 0 3px rgba(16,185,129,0.8))",
                      }}
                      strokeWidth={2.5}
                      fill={SUCCESS_COLOR}
                    />
                  </span>
                )}
                {keystoneText}
                {mode === "active" && (
                  <ChevronRight
                    size={14}
                    className="shrink-0 inline-block ml-1 transition-opacity duration-150"
                    style={{
                      opacity: 0.35,
                      color: "oklch(var(--muted-foreground))",
                      verticalAlign: "middle",
                    }}
                    aria-hidden="true"
                  />
                )}
              </h3>
            </button>

            {/* Lock-In time block badge */}
            {showLockInTimeBlock && (
              <div
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono"
                style={{
                  background: "rgba(107,114,128,0.15)",
                  border: "1px solid rgba(107,114,128,0.3)",
                  color:
                    lockInState === "start-window" ||
                    lockInState === "end-window"
                      ? SUCCESS_COLOR
                      : lockInState === "completed"
                        ? SUCCESS_COLOR
                        : lockInState === "missed-start" ||
                            lockInState === "missed-checkout" ||
                            lockInState === "failed-finalized"
                          ? MISSED_COLOR
                          : "oklch(var(--muted-foreground))",
                }}
                aria-label={`Time block: ${lockInStartTime} to ${lockInEndTime}`}
              >
                {lockInState === "completed" ||
                lockInState === "missed-start" ||
                lockInState === "missed-checkout" ||
                lockInState === "failed-finalized" ? (
                  <LockOpen size={10} />
                ) : (
                  <Lock size={10} />
                )}
                {formatTime24h(lockInStartTime)} –{" "}
                {formatTime24h(lockInEndTime)}
              </div>
            )}

            {/* Lock-In live timer */}
            {isLockIn && lockInTimer && mode === "active" && (
              <>
                <style>{`
                  @keyframes lockInPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                  }
                `}</style>
                <div
                  className="text-xs font-mono font-medium"
                  style={{
                    color: lockInTimer.color,
                    animation: lockInTimer.pulse
                      ? "lockInPulse 1.2s ease-in-out infinite"
                      : "none",
                  }}
                  aria-live="polite"
                  data-ocid="goal.lockin_timer"
                >
                  {lockInTimer.text}
                </div>
              </>
            )}

            {/* Lock-In status text */}
            {isLockIn && lockInState && mode === "active" && (
              <div
                className="text-xs font-mono max-w-[90%]"
                style={{
                  color:
                    lockInState === "start-window" ||
                    lockInState === "end-window"
                      ? SUCCESS_COLOR
                      : lockInState === "completed"
                        ? SUCCESS_COLOR
                        : lockInState === "missed-start" ||
                            lockInState === "missed-checkout" ||
                            lockInState === "failed-finalized"
                          ? MISSED_COLOR
                          : "oklch(var(--muted-foreground))",
                }}
              >
                {lockInState === "waiting" && ""}
                {lockInState === "start-window" &&
                  "Check-in window open — swipe right to start"}
                {lockInState === "in-progress" &&
                  lockInEndTime &&
                  `In progress — complete by ${formatTime24h(lockInEndTime)}`}
                {lockInState === "end-window" &&
                  "Check-out window — swipe right to complete"}
                {lockInState === "completed" && "Lock-In completed"}
                {lockInState === "missed-start" &&
                  "Missed Start Window. Tap to log reason."}
                {lockInState === "missed-checkout" &&
                  "Missed Check-Out. Tap to log reason."}
                {lockInState === "failed-finalized" && "Obstacle logged"}
              </div>
            )}

            {/* 7-Day Week Calendar */}
            <div className="flex flex-col items-center gap-1 mt-1">
              <div className="flex items-center gap-1.5">
                {weekHistoryLoading
                  ? WEEK_SLOTS.map((id) => (
                      <div
                        key={id}
                        className="w-3.5 h-3.5 rounded-full animate-pulse"
                        style={{ backgroundColor: GREY_COLOR }}
                      />
                    ))
                  : weekSlotData.map(({ id, status }) => (
                      <div
                        key={id}
                        className="w-3.5 h-3.5 rounded-full"
                        style={{
                          backgroundColor: getBallColor(status),
                          opacity: getBallOpacity(status),
                        }}
                        aria-hidden="true"
                      />
                    ))}
              </div>
              <div className="flex items-center gap-1.5">
                {weekSlotData.map(({ id, label }) => (
                  <div
                    key={id}
                    className="w-3.5 text-center"
                    style={{
                      fontSize: "11px",
                      color: "oklch(var(--muted-foreground) / 0.55)",
                      lineHeight: 1,
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* If-then follow-up note — shown on the Done card for a short
                window after a habit with an if-then plan is completed. The
                habit is already done; tapping 'Used it' tags the already-created
                check-in, dismissing/ignoring leaves it done without the tag. */}
            {mode === "done" && showIfThenNote && (
              <div
                className="ifthen-note w-full"
                data-ocid={`goal.ifthen_note.${index + 1}`}
              >
                <div className="flex flex-col items-start text-left gap-0.5 min-w-0">
                  <span className="ifthen-note-label text-xs font-medium">
                    I used my if-then plan
                  </span>
                  <span className="ifthen-note-hint text-[11px] leading-snug line-clamp-2">
                    {goal.ifThenPlan}
                  </span>
                </div>
                <button
                  type="button"
                  className="ifthen-note-action shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIfThenUsed();
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    modalOpenedDuringGestureRef.current = true;
                  }}
                  onPointerUp={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  aria-label="Record this check-in as using my if-then plan"
                  data-ocid={`goal.ifthen_note.action.${index + 1}`}
                >
                  <Zap size={12} />
                  <span>Used it</span>
                </button>
                <button
                  type="button"
                  className="ifthen-note-dismiss shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIfThenDismiss();
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    modalOpenedDuringGestureRef.current = true;
                  }}
                  onPointerUp={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  aria-label="Dismiss this if-then follow-up note"
                  data-ocid={`goal.ifthen_note.dismiss.${index + 1}`}
                >
                  <span>Dismiss</span>
                </button>
              </div>
            )}

            {/* Log What Happened button — amber CTA for missed Lock-In windows */}
            {isLockIn &&
              (lockInState === "missed-start" ||
                lockInState === "missed-checkout") &&
              mode === "active" && (
                <div className="flex justify-start w-full">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMissedSheet(true);
                      onMissedWindowTap?.(goal.id);
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      modalOpenedDuringGestureRef.current = true;
                    }}
                    onPointerUp={(e) => e.stopPropagation()}
                    onPointerMove={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium transition-smooth select-none"
                    style={{
                      backgroundColor: "rgba(245,158,11,0.15)",
                      color: "#F59E0B",
                      border: "1px solid rgba(245,158,11,0.4)",
                      boxShadow:
                        "-2px -2px 5px rgba(60,60,40,0.25), 3px 3px 7px rgba(0,0,0,0.45)",
                    }}
                    aria-label="Log what happened for this missed Lock-In"
                    data-ocid={`goal.log_missed_button.${index + 1}`}
                  >
                    <TriangleAlert size={12} style={{ color: "#F59E0B" }} />
                    Log What Happened
                  </button>
                </div>
              )}

            {/* Done tab: yellow Undo button — hidden for ALL Lock-In cards (immutable once done) */}
            {mode === "done" && !isLockIn && (
              <div className="flex justify-end w-full">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDoneCardTap?.(goal.id);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    modalOpenedDuringGestureRef.current = true;
                  }}
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
          </div>
        </button>
      </motion.div>

      {mode === "active" && !lockInSwipeDisabled && (
        <SkipModal
          goal={goal}
          open={showSkipModal}
          onClose={handleSkipModalClose}
          onConfirm={handleSkipConfirm}
          isLoading={isSkipping}
        />
      )}

      {mode === "active" && isLockIn && (
        <MissedWindowSheet
          goal={goal}
          open={showMissedSheet}
          onClose={() => {
            setShowMissedSheet(false);
            // Dismissing without submitting also persists the "already shown"
            // marker so the sheet does not re-pop on a later remount.
            if (
              lockInState === "missed-start" ||
              lockInState === "missed-checkout"
            ) {
              markMissedSheetShown(
                goal.id,
                lockInState === "missed-checkout" ? "checkout" : "start",
              );
            }
          }}
          onConfirm={(obstacleTemplateId, note) =>
            handleMissedConfirm(obstacleTemplateId, note)
          }
          isLoading={isCheckingIn}
          failureType={currentFailureType}
        />
      )}

      {/* WOOP Catch — only for normal (non-LockIn) habits on left swipe */}
      {mode === "active" && !isLockIn && (
        <WoopCatchSheet
          goal={goal}
          open={showWoopCatch}
          onClose={() => setShowWoopCatch(false)}
          onExecutedPlan={handleWoopCatchExecutedPlan}
          onProceedToSkip={handleWoopCatchProceedToSkip}
          isLoading={isCheckingIn}
        />
      )}
    </>
  );
}
