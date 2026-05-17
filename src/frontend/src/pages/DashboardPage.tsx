import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Target } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckInType, GoalState } from "../backend";
import type { CheckIn as BackendCheckIn, GoalPublic } from "../backend.d.ts";
import { GoalCard, getLockInState } from "../components/GoalCard";
import type { DayStatus, LockInCheckIn } from "../components/GoalCard";
import { GoalInsightSheet } from "../components/GoalInsightSheet";
import { UndoPopup } from "../components/UndoPopup";
import WoopWizard from "../components/WoopWizard";
import { useAuth } from "../hooks/useAuth";
import { useBackend } from "../hooks/useBackend";
import {
  type DashboardHeaderData,
  useDashboardHeaderWriter,
} from "../hooks/useDashboardHeader";
import { useTheme } from "../hooks/useTheme";
import { useUserProfile } from "../hooks/useUserProfile";
import type { GoalAnalytics } from "../types";

// ─── Constants ──────────────────────────────────────────────────────────────────
const NEW_HABIT_KEY = "cumulative-new-habit-id";
const NEW_HABIT_DURATION_MS = 10_000;

function goalKey(id: bigint): string {
  return String(id);
}
/**
 * Returns the UTC offset in minutes for a given IANA timezone string.
 * e.g. "America/New_York" → -300 (in winter), +330 for "Asia/Kolkata".
 * Falls back to the browser's own offset if tz is empty or unrecognised.
 */
const getTimezoneOffsetMinutes = (tz: string): number => {
  if (!tz) return -new Date().getTimezoneOffset();
  try {
    const date = new Date();
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(date.toLocaleString("en-US", { timeZone: tz }));
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  } catch {
    return -new Date().getTimezoneOffset();
  }
};

/**
 * Returns true if the IC nanosecond timestamp falls on today's calendar day
 * in the given IANA timezone (falls back to local time if tz is omitted).
 */
function isCheckInToday(ts: bigint, tz?: string): boolean {
  const ms = Number(ts / 1_000_000n);
  const d = new Date(ms);
  const todayStr = getLocalDateStr(new Date(), tz);
  const dStr = getLocalDateStr(d, tz);
  return dStr === todayStr;
}

/** Returns "YYYY-MM-DD" in the given IANA timezone (or local if omitted). */
function getLocalDateStr(d: Date = new Date(), tz?: string): string {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const y = parts.find((p) => p.type === "year")?.value ?? "";
      const mo = parts.find((p) => p.type === "month")?.value ?? "";
      const da = parts.find((p) => p.type === "day")?.value ?? "";
      if (y && mo && da) return `${y}-${mo}-${da}`;
    } catch {
      // fall through to local
    }
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns the milliseconds until the next midnight in the given timezone.
 * Falls back to local midnight if tz is empty.
 */
function msUntilMidnight(tz?: string): number {
  const now = new Date();
  const todayStr = getLocalDateStr(now, tz);
  const [y, mo, da] = todayStr.split("-").map(Number);
  // Build "tomorrow" date string
  const tomorrowStr = `${y}-${String(mo).padStart(2, "0")}-${String(da + 1).padStart(2, "0")}`;
  // Parse midnight of tomorrow in the specified timezone using Intl
  if (tz) {
    try {
      // We need the UTC time that corresponds to midnight in tz.
      // Strategy: iterate the Intl formatter until we find exact midnight.
      const [ty, tm, td] = tomorrowStr.split("-").map(Number);
      // Create a Date for midnight UTC of that calendar day — then offset.
      // Simpler: use a known midnight string in the local timezone.
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
      });
      // Walk from now + 1h to now + 28h in 1-min steps to find the midnight crossing
      // This is O(1680) comparisons — negligible.
      for (let minsAhead = 60; minsAhead <= 28 * 60; minsAhead++) {
        const candidate = new Date(now.getTime() + minsAhead * 60_000);
        const parts = fmt.formatToParts(candidate);
        const cy = parts.find((p) => p.type === "year")?.value ?? "";
        const cmo = parts.find((p) => p.type === "month")?.value ?? "";
        const cda = parts.find((p) => p.type === "day")?.value ?? "";
        const chr = parts.find((p) => p.type === "hour")?.value ?? "";
        if (
          Number(cy) === ty &&
          Number(cmo) === tm &&
          Number(cda) === td &&
          Number(chr) === 0
        ) {
          // Found the first minute in tomorrow at 00:xx — align to that minute
          const midnightMs = Math.floor(candidate.getTime() / 60_000) * 60_000;
          return Math.max(0, midnightMs - now.getTime());
        }
      }
    } catch {
      // fall through
    }
  }
  // Fallback: local midnight
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return Math.max(0, tomorrow.getTime() - now.getTime());
}

// ─── Done-tab state type ───────────────────────────────────────────────────────────
interface DoneEntry {
  checkInId: bigint;
  checkInType:
    | "success"
    | "skip"
    | "inProgress"
    | "missedCheckIn"
    | "missedCheckOut";
  executedIfThen?: boolean;
  isLockIn?: boolean;
  obstacleTemplateId?: bigint;
  customObstacleNote?: string;
}

type DoneMap = Map<string, DoneEntry>;

// ─── trulyUnswiped note: unswiped already excludes exitingMap entries,
// so showSwipeHint correctly hides while any card is mid-animation.

// ─── Username availability types ────────────────────────────────────────────────────
type UsernameAvailability =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "unknown";

function isValidUsernameFormat(value: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value);
}

function getUsernameFormatError(value: string): string {
  if (value.length < 3) return "At least 3 characters required.";
  if (value.length > 20) return "Max 20 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(value))
    return "Letters, numbers, and underscores only.";
  return "";
}

// ─── Forced Username Modal ───────────────────────────────────────────────────────────
interface ForcedUsernameModalProps {
  onComplete: () => void;
}

function ForcedUsernameModal({ onComplete }: ForcedUsernameModalProps) {
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availability, setAvailability] =
    useState<UsernameAvailability>("idle");

  const { actor } = useBackend();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAvailability = useCallback(
    async (value: string) => {
      if (!isValidUsernameFormat(value)) {
        setAvailability("idle");
        return;
      }
      setAvailability("checking");
      try {
        if (actor && "isUsernameAvailable" in actor) {
          const available = await (
            actor as { isUsernameAvailable: (u: string) => Promise<boolean> }
          ).isUsernameAvailable(value);
          setAvailability(available ? "available" : "taken");
        } else {
          setAvailability("unknown");
        }
      } catch {
        setAvailability("unknown");
      }
    },
    [actor],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!username || username.length < 3 || !isValidUsernameFormat(username)) {
      setAvailability("idle");
      return;
    }
    debounceRef.current = setTimeout(() => {
      void checkAvailability(username);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, checkAvailability]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uErr = username.trim()
      ? getUsernameFormatError(username.trim())
      : "Username is required.";
    setUsernameError(uErr);
    if (uErr || availability === "taken") return;
    setIsSubmitting(true);
    setApiError("");
    try {
      if (!actor) throw new Error("Backend not available.");
      await (actor as { register: (u: string) => Promise<unknown> }).register(
        username.trim(),
      );
      await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      await queryClient.refetchQueries({ queryKey: ["userProfile"] });
      onComplete();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      if (
        msg.toLowerCase().includes("taken") ||
        msg.toLowerCase().includes("username")
      ) {
        setAvailability("taken");
        setUsernameError("That username is already taken.");
      } else {
        setApiError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    isValidUsernameFormat(username) &&
    (availability === "available" || availability === "unknown") &&
    !isSubmitting;

  const inputBorderStyle: React.CSSProperties =
    availability === "available"
      ? {
          outline: "2px solid oklch(var(--color-accent-success) / 0.5)",
          outlineOffset: "2px",
        }
      : availability === "taken"
        ? {
            outline: "2px solid oklch(var(--color-accent-social) / 0.5)",
            outlineOffset: "2px",
          }
        : {};

  return (
    <>
      <style>{`
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 8px 1px oklch(var(--color-accent-success) / 0.3); }
          50%       { box-shadow: 0 0 14px 3px oklch(var(--color-accent-success) / 0.55); }
        }
        @keyframes shakeLateral {
          0%   { transform: translateY(-50%) translateX(0); }
          20%  { transform: translateY(-50%) translateX(-4px); }
          40%  { transform: translateY(-50%) translateX(4px); }
          60%  { transform: translateY(-50%) translateX(-3px); }
          80%  { transform: translateY(-50%) translateX(3px); }
          100% { transform: translateY(-50%) translateX(0); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{
          background: "oklch(var(--background) / 0.96)",
          backdropFilter: "blur(8px)",
        }}
        data-ocid="dashboard.username_required.dialog"
      >
        <div className="fixed top-4 right-4">
          <button
            type="button"
            onClick={() => logout()}
            data-ocid="dashboard.username_required.logout_button"
            aria-label="Sign out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body transition-smooth text-muted-foreground hover:text-foreground"
            style={{
              background: "oklch(var(--card))",
              boxShadow:
                "3px 3px 7px rgba(0,0,0,0.4), -2px -2px 5px rgba(255,255,255,0.04)",
            }}
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="onboarding-card w-full max-w-md"
          data-ocid="dashboard.username_required.card"
        >
          <div className="mb-6 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              One more step
            </p>
            <h2 className="text-xl font-display font-semibold text-foreground leading-snug">
              Choose your username
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A unique handle is required before you can use Cumulative.
            </p>
          </div>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="dashboard-username"
                className="flex items-center text-sm font-medium text-foreground"
              >
                Username
              </label>
              <p className="text-xs text-muted-foreground">
                My handle on Cumulative is{" "}
                <span className="madlib-field font-semibold">
                  {username || "___"}
                </span>
              </p>
              <div className="relative">
                <input
                  id="dashboard-username"
                  data-ocid="dashboard.username_required.input"
                  type="text"
                  className="input-neumorphic w-full text-base pr-10"
                  placeholder="e.g. sarah_runs"
                  value={username}
                  maxLength={20}
                  autoComplete="username"
                  spellCheck={false}
                  style={inputBorderStyle}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\s/g, "");
                    setUsername(val);
                    setUsernameError("");
                    setApiError("");
                  }}
                  onBlur={() => {
                    if (username.trim())
                      setUsernameError(getUsernameFormatError(username.trim()));
                  }}
                />
                {availability === "checking" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    <span
                      className="w-4 h-4 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: "oklch(var(--muted-foreground) / 0.3)",
                        borderTopColor: "oklch(var(--muted-foreground))",
                      }}
                    />
                  </span>
                )}
                {availability === "available" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: "oklch(var(--color-accent-success) / 0.15)",
                        color: "oklch(var(--color-accent-success))",
                        border:
                          "1.5px solid oklch(var(--color-accent-success) / 0.6)",
                        animation: "glowPulse 2s ease-in-out infinite",
                      }}
                    >
                      ✓
                    </span>
                  </span>
                )}
                {availability === "taken" && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
                    style={{ animation: "shakeLateral 0.4s ease both" }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: "oklch(var(--color-accent-social) / 0.15)",
                        color: "oklch(var(--color-accent-social))",
                        border:
                          "1.5px solid oklch(var(--color-accent-social) / 0.5)",
                      }}
                    >
                      ✕
                    </span>
                  </span>
                )}
              </div>
              {availability === "available" && !usernameError && (
                <p
                  className="text-xs font-medium"
                  data-ocid="dashboard.username_required.available.text"
                  style={{ color: "oklch(var(--color-accent-success))" }}
                >
                  ✓ Username is available
                </p>
              )}
              {availability === "taken" && (
                <p
                  className="text-xs font-medium"
                  data-ocid="dashboard.username_required.taken.text"
                  style={{ color: "oklch(var(--color-accent-social))" }}
                >
                  Username taken — try another
                </p>
              )}
              {usernameError && (
                <p
                  className="text-xs mt-0.5"
                  data-ocid="dashboard.username_required.field_error"
                  style={{ color: "oklch(var(--destructive))" }}
                >
                  {usernameError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                3–20 characters · letters, numbers, and underscores only
              </p>
            </div>
            {apiError && (
              <p
                className="text-sm text-center py-2 px-3 rounded-lg bg-muted"
                data-ocid="dashboard.username_required.error_state"
                style={{ color: "oklch(var(--destructive))" }}
              >
                {apiError}
              </p>
            )}
            <button
              data-ocid="dashboard.username_required.submit_button"
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 rounded-lg font-display font-semibold text-base tracking-wide transition-smooth button-primary-neon disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span
                  className="flex items-center justify-center gap-2"
                  data-ocid="dashboard.username_required.loading_state"
                >
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                "Confirm Username →"
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </>
  );
}

// ─── Tab Pill Component ───────────────────────────────────────────────────────────────
function TabPills({
  activeTab,
  doneCount,
  badgeAnimKey,
  onTabChange,
}: {
  activeTab: "active" | "done";
  doneCount: number;
  badgeAnimKey: number;
  onTabChange: (tab: "active" | "done") => void;
}) {
  return (
    <>
      <style>{`
        @keyframes badgePop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.45); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div className="flex gap-2" role="tablist" aria-label="Dashboard tabs">
        {(["active", "done"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab)}
              data-ocid={`dashboard.${tab}_tab`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-display font-medium transition-smooth"
              style={{
                color: isActive
                  ? "oklch(var(--foreground))"
                  : "oklch(var(--muted-foreground))",
                background: isActive
                  ? "oklch(var(--card))"
                  : "oklch(var(--muted) / 0.4)",
                boxShadow: isActive
                  ? "inset 2px 2px 5px rgba(0,0,0,0.5), inset -1px -1px 3px rgba(80,80,85,0.2)"
                  : "-2px -2px 5px rgba(60,60,65,0.3), 3px 3px 7px rgba(0,0,0,0.5)",
              }}
            >
              {tab === "active" ? "Active" : "Done"}
              {tab === "done" && doneCount > 0 && (
                <span
                  key={badgeAnimKey}
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold"
                  style={{
                    background: "#10B981",
                    color: "#022c22",
                    fontSize: "0.65rem",
                    animation:
                      badgeAnimKey > 0
                        ? "badgePop 0.38s cubic-bezier(0.34,1.56,0.64,1) both"
                        : "none",
                  }}
                  data-ocid="dashboard.done_tab.badge"
                  aria-label={`${doneCount} habits done`}
                >
                  {doneCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── New Habit Glow Border ──────────────────────────────────────────────────────────
function NewHabitGlow() {
  return <div aria-hidden="true" className="new-habit-glow" />;
}

// ─── New Habit Badge ─────────────────────────────────────────────────────────────────
function NewHabitBadge() {
  return (
    <>
      <style>{`
        @keyframes newHabitFadeIn {
          0%   { opacity: 0; transform: scale(0.7) translateY(-4px); }
          60%  { opacity: 1; transform: scale(1.08) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        data-ocid="dashboard.new_habit_badge"
        aria-label="New habit"
        style={{
          position: "absolute",
          bottom: "10px",
          right: "12px",
          background: "#10B981",
          color: "#022c22",
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "3px 9px",
          borderRadius: "20px",
          pointerEvents: "none",
          zIndex: 10,
          boxShadow:
            "0 2px 8px rgba(16,185,129,0.45), 0 1px 3px rgba(0,0,0,0.4)",
          animation:
            "newHabitFadeIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        new habit
      </div>
    </>
  );
}

// ─── Main Dashboard Page ────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const [usernameModalDismissed, setUsernameModalDismissed] = useState(false);
  const [showWoop, setShowWoop] = useState(false);
  const { actor, isFetching: actorFetching } = useBackend();
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { principalText } = useAuth();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  // ── New habit highlight ─────────────────────────────────────────────────────
  const [newHabitId, setNewHabitId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(NEW_HABIT_KEY);
    } catch {
      return null;
    }
  });

  // Clear the new habit key immediately so it doesn't show again on re-mount
  useEffect(() => {
    if (!newHabitId) return;
    try {
      localStorage.removeItem(NEW_HABIT_KEY);
    } catch {}
    const timer = setTimeout(() => {
      setNewHabitId(null);
    }, NEW_HABIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [newHabitId]);

  // ── Active / Done tab ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"active" | "done">("active");
  const [badgeAnimKey, setBadgeAnimKey] = useState(0);
  // ── Phase 1 exitingMap: goalId → swipe direction. Card stays in Active DOM
  // while its slide-out animation plays. Once animation ends (onExitComplete),
  // we move it to doneMap (Phase 2) and remove it from here.
  const [exitingMap, setExitingMap] = useState<Map<string, "left" | "right">>(
    new Map(),
  );

  // ── Track swipe direction per goal for exit animation ─────────────────────────
  const [swipeDirectionMap, setSwipeDirectionMap] = useState<
    Map<string, "left" | "right">
  >(new Map());

  // ── Bug 7: track cards that had a backend error, so onExitComplete skips them ──
  const erroredCardIdsRef = useRef<Set<string>>(new Set());
  // ── Committed missed Lock-In exits: once a card's missed justification is
  // submitted, add its key here so unswiped filter permanently excludes it,
  // even before lockInCheckInMap updates from the backend refetch.
  const committedMissedExitsRef = useRef<Set<string>>(new Set());

  // ── Bug 3/10: track in-progress pulse animation for Lock-In start-window check-in ──
  const [inProgressPulseMap, setInProgressPulseMap] = useState<Set<string>>(
    new Set(),
  );

  // User timezone (from profile — used for midnight reset)
  const userTimezone =
    profile?.timezone && profile.timezone.trim() !== ""
      ? profile.timezone.trim()
      : undefined;

  // ── Optimistic Done map: populated when a swipe starts so the card appears in Done
  // immediately after the exit animation, even if the backend query hasn't refetched yet.
  // Entries are cleared when todayDoneMap receives the real backend data.
  const [optimisticDoneMap, setOptimisticDoneMap] = useState<DoneMap>(
    new Map(),
  );

  // ── Goal Insight sheet state ─────────────────────────────────────────────
  const [insightGoal, setInsightGoal] = useState<GoalPublic | null>(null);

  // ── Undo popup state ─────────────────────────────────────────────────────
  const [undoTarget, setUndoTarget] = useState<{
    goalId: bigint;
    goal: GoalPublic;
  } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  // Track which goal IDs just returned from Done → Active (for bounce animation)
  const [recentlyUndone, setRecentlyUndone] = useState<Set<string>>(new Set());

  // ── Week history state (Map<goalIdStr, DayStatus[]>) ──────────────────────────
  const [weekHistoryMap, setWeekHistoryMap] = useState<
    Map<string, DayStatus[]>
  >(new Map());
  const [weekHistoryLoading, setWeekHistoryLoading] = useState(false);

  // ── Midnight reset: invalidates check-ins at local midnight so the day boundary
  // is respected in todayDoneMap (derived from backend). No localStorage needed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: queryClient is stable; intentional re-run only on timezone change
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function scheduleReset() {
      const ms = msUntilMidnight(userTimezone);
      timer = setTimeout(() => {
        // Day boundary crossed: invalidate check-ins so Done tab re-derives from today's data
        queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
        queryClient.invalidateQueries({ queryKey: ["myGoals"] });
        // Also clear animation state for the new day
        setExitingMap(new Map());
        setSwipeDirectionMap(new Map());
        setOptimisticDoneMap(new Map());
        committedMissedExitsRef.current.clear();
        // Schedule the next reset (for the following day)
        scheduleReset();
      }, ms + 1000); // +1s buffer to land safely past midnight
    }
    scheduleReset();
    return () => clearTimeout(timer);
  }, [userTimezone]);

  // Determine if this user needs to pick a username
  const needsUsername =
    !profileLoading &&
    !usernameModalDismissed &&
    profile !== undefined &&
    (!profile ||
      !profile.username ||
      profile.username.trim().length === 0 ||
      (principalText !== null && profile.username === principalText));

  // ── Fetch goals ────────────────────────────────────────────────────────────
  const { data: goals = [], isLoading: goalsLoading } = useQuery<GoalPublic[]>({
    queryKey: ["myGoals"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.listMyGoals();
      } catch {
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // ── Fetch today's check-ins ─────────────────────────────────────────────────
  const { data: checkIns = [], isLoading: checkInsLoading } = useQuery<
    BackendCheckIn[]
  >({
    queryKey: ["myCheckIns"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.listMyCheckIns();
      } catch {
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const isLoading = goalsLoading || checkInsLoading;

  // Active goals only
  const activeGoals = goals.filter((g) => g.state === GoalState.active);

  // ── Backend-derived done map: source of truth for Done tab across all devices ──
  // Each entry = today's check-in (filtered by user's timezone), keyed by goalId.
  const todayDoneMap = useMemo<DoneMap>(() => {
    const map: DoneMap = new Map();
    for (const c of checkIns) {
      if (isCheckInToday(c.timestamp, userTimezone)) {
        const checkInType:
          | "success"
          | "skip"
          | "inProgress"
          | "missedCheckIn"
          | "missedCheckOut" =
          c.checkInType === CheckInType.success
            ? "success"
            : c.checkInType === CheckInType.skip
              ? "skip"
              : c.checkInType === CheckInType.inProgress
                ? "inProgress"
                : c.checkInType === CheckInType.missedCheckIn
                  ? "missedCheckIn"
                  : c.checkInType === CheckInType.missedCheckOut
                    ? "missedCheckOut"
                    : "skip";
        // Read executedIfThen from the check-in record
        const executedIfThen = c.executedIfThen ?? false;
        const doneGoal = goals.find((g) => goalKey(g.id) === goalKey(c.goalId));
        map.set(goalKey(c.goalId), {
          checkInId: c.id,
          checkInType,
          executedIfThen,
          isLockIn: doneGoal?.isLockIn ?? false,
          obstacleTemplateId: c.obstacleTemplateId,
          customObstacleNote: c.customObstacleNote,
        });
      }
    }
    return map;
  }, [checkIns, userTimezone, goals]);

  // ── Promote optimisticDoneMap entries once todayDoneMap has real backend data ────
  // When the backend query returns, clear any optimistic entries that are now
  // covered by real data. This prevents stale optimistic entries accumulating.
  useEffect(() => {
    setOptimisticDoneMap((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const key of prev.keys()) {
        if (todayDoneMap.has(key)) {
          next.delete(key);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [todayDoneMap]);

  // ── Fetch 7-day history for all active goals ──────────────────────────────────
  const fetchWeekHistory = useCallback(async () => {
    if (!actor || activeGoals.length === 0) return;
    setWeekHistoryLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromMs = today.getTime() - 6 * 86_400_000;
      const toMs = today.getTime() + 86_400_000; // tomorrow midnight
      const fromNs = BigInt(fromMs) * 1_000_000n;
      const toNs = BigInt(toMs) * 1_000_000n;

      const newMap = new Map<string, DayStatus[]>();

      await Promise.all(
        activeGoals.map(async (goal) => {
          try {
            const checkInsForPeriod = await actor.getCheckInsForPeriod(
              goal.id,
              fromNs,
              toNs,
            );
            // Build 7-day array: index 0 = 6 days ago, index 6 = today
            const statuses: DayStatus[] = Array(7).fill("none" as DayStatus);
            for (const c of checkInsForPeriod) {
              const ms = Number(c.timestamp / 1_000_000n);
              const dayIndex = Math.floor((ms - fromMs) / 86_400_000);
              if (dayIndex >= 0 && dayIndex < 7) {
                // success takes priority over skip
                if (c.checkInType === CheckInType.success) {
                  statuses[dayIndex] = "success";
                } else if (statuses[dayIndex] !== "success") {
                  statuses[dayIndex] = "skip";
                }
              }
            }
            newMap.set(goalKey(goal.id), statuses);
          } catch {
            newMap.set(goalKey(goal.id), Array(7).fill("none" as DayStatus));
          }
        }),
      );

      setWeekHistoryMap(newMap);
    } finally {
      setWeekHistoryLoading(false);
    }
  }, [actor, activeGoals]);

  // Fetch week history on mount and whenever active goals or checkIns change
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchWeekHistory intentionally omitted — adding it causes an infinite loop
  useEffect(() => {
    if (!isLoading && actor) {
      void fetchWeekHistory();
    }
  }, [isLoading, actor]);

  // Per-goal analytics (derived from check-ins)
  const analyticsMap = useMemo(() => {
    const map = new Map<string, GoalAnalytics>();
    for (const g of goals) {
      const key = goalKey(g.id);
      const goalCheckIns = checkIns.filter((c) => goalKey(c.goalId) === key);
      const successCount = goalCheckIns.filter(
        (c) => c.checkInType === CheckInType.success,
      ).length;
      const skipCount = goalCheckIns.filter(
        (c) => c.checkInType === CheckInType.skip,
      ).length;

      let consistencyRun = 0;
      const dayMs = 86_400_000;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let d = 0; d < 365; d++) {
        const dayStart = today.getTime() - d * dayMs;
        const dayEnd = dayStart + dayMs;
        const dayHit = goalCheckIns.some((c) => {
          const ms = Number(c.timestamp / 1_000_000n);
          return (
            ms >= dayStart &&
            ms < dayEnd &&
            c.checkInType === CheckInType.success
          );
        });
        if (dayHit) consistencyRun++;
        else if (d > 0) break;
      }

      map.set(key, {
        goalId: key,
        goalName: g.wish,
        successCount,
        skipCount,
        missedCount: 0,
        currentStreak: consistencyRun,
      });
    }
    return map;
  }, [goals, checkIns]);

  // ── Check-in mutation ──────────────────────────────────────────────────────
  const [pendingGoalId, setPendingGoalId] = useState<string | null>(null);

  const checkInMutation = useMutation({
    mutationFn: async ({
      goalId,
      checkInType,
      obstacleTemplateId,
      lockInStartedAt,
      lockInEndedAt,
      executedIfThen,
      customObstacleNote,
    }: {
      goalId: bigint;
      checkInType: CheckInType;
      obstacleTemplateId?: bigint;
      lockInStartedAt?: bigint;
      lockInEndedAt?: bigint;
      executedIfThen?: boolean;
      customObstacleNote?: string;
    }) => {
      if (!actor) return null;
      return actor.recordCheckIn({
        goalId,
        checkInType,
        obstacleTemplateId,
        lockInStartedAt,
        lockInEndedAt,
        executedIfThen: executedIfThen ?? false,
        customObstacleNote: customObstacleNote,
        timezoneOffsetMinutes: BigInt(
          getTimezoneOffsetMinutes(userTimezone ?? ""),
        ),
      });
    },
    onSuccess: (_data, _variables) => {
      // Invalidate so todayDoneMap re-derives from the fresh backend data.
      // The card is already visually in Done via exitingMap optimistic state.
      queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
      void fetchWeekHistory();
    },
    onError: (_err, variables) => {
      // Mutation failed: snap card back to Active by clearing exitingMap entry.
      const key = goalKey(variables.goalId);
      // Bug 7: mark as errored so handleCardExitComplete skips this card
      erroredCardIdsRef.current.add(key);
      // Also clear from committedMissedExits so the card becomes interactive again
      committedMissedExitsRef.current.delete(key);
      // Bug 8: if this was a Lock-In end-window checkout (success type with
      // an existing inProgress check-in), keep the card in Active at in-progress
      // state so the user can retry the checkout swipe.
      setExitingMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setSwipeDirectionMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setOptimisticDoneMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      // Clean up the errored flag after a short delay so future swipes work
      setTimeout(() => {
        erroredCardIdsRef.current.delete(key);
      }, 600);
      toast.error("Check-in failed. Please try again.");
    },
    onSettled: () => {
      setPendingGoalId(null);
    },
  });

  // Called by GoalCard when its Phase-1 exit animation finishes.
  // We clear the exitingMap so the card disappears from Active.
  // todayDoneMap (from backend) will add it to Done once the
  // invalidateQueries refetch completes (usually within milliseconds).
  // Wrapped in useCallback so GoalCard's ref always has the latest version
  // without triggering the exit-timer effect to re-run.
  const handleCardExitComplete = useCallback((goalId: bigint) => {
    const key = goalKey(goalId);
    // Bug 7: if a backend error already snapped this card back, do nothing
    if (erroredCardIdsRef.current.has(key)) return;
    setExitingMap((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setBadgeAnimKey((k) => k + 1);
    // Automatically switch to Done tab so the user sees the result
    setActiveTab("done");
  }, []);

  function handleGoalCardCheckIn(
    goalId: bigint,
    type: "success" | "skip" | "inProgress",
    obstacleId?: bigint,
    lockInStartedAtMs?: number,
    lockInEndedAtMs?: number,
    executedIfThen?: boolean,
    customObstacleNote?: string,
  ) {
    const key = goalKey(goalId);
    const goal = activeGoals.find((g) => goalKey(g.id) === key);

    let backendType: CheckInType;
    if (type === "success") backendType = CheckInType.success;
    else if (type === "skip") backendType = CheckInType.skip;
    else if (
      // When inProgress type is passed from MissedWindowSheet,
      // obstacleId is set. Use lockInState to distinguish missed-start vs missed-checkout.
      type === "inProgress" &&
      obstacleId !== undefined &&
      goal?.isLockIn
    ) {
      // Determine which failure type based on current lockInState.
      // We intentionally read lockInState at call-time (before exitCommittedRef
      // blocks further re-renders) so the correct type is captured.
      const currentState =
        goal.isLockIn &&
        goal.startTime != null &&
        goal.startTime !== "" &&
        goal.endTime != null &&
        goal.endTime !== ""
          ? getLockInState(
              goal.startTime,
              goal.endTime,
              lockInCheckInMap.get(key),
              goal.createdAt,
            )
          : null;
      backendType =
        currentState === "missed-checkout"
          ? CheckInType.missedCheckOut
          : CheckInType.missedCheckIn;
      // Immediately register this card as a committed missed exit so the
      // unswiped filter excludes it permanently — no waiting for backend refetch.
      committedMissedExitsRef.current.add(key);
    } else {
      // Bug 3: plain inProgress (Lock-In start-window check-in)
      // stays in Active — does NOT exit to Done.
      backendType = CheckInType.inProgress;
    }

    const direction: "left" | "right" = type === "success" ? "right" : "left";
    // Bug 3: inProgress Lock-In check-in must NOT trigger slide-to-Done.
    // Only terminal types (success, skip, missedCheckIn, missedCheckOut) exit the Active list.
    const shouldSlide =
      type === "success" ||
      type === "skip" ||
      backendType === CheckInType.missedCheckIn ||
      backendType === CheckInType.missedCheckOut;

    if (shouldSlide) {
      setSwipeDirectionMap((prev) => {
        const next = new Map(prev);
        next.set(key, direction);
        return next;
      });
      setExitingMap((prev) => {
        const next = new Map(prev);
        next.set(key, direction);
        return next;
      });
      // Optimistically add to Done map so the card appears immediately after
      // the exit animation, before the backend query refetches.
      const optimisticCheckInType:
        | "success"
        | "skip"
        | "missedCheckIn"
        | "missedCheckOut" =
        backendType === CheckInType.success
          ? "success"
          : backendType === CheckInType.missedCheckIn
            ? "missedCheckIn"
            : backendType === CheckInType.missedCheckOut
              ? "missedCheckOut"
              : "skip";
      setOptimisticDoneMap((prev) => {
        const next = new Map(prev);
        next.set(key, {
          checkInId: 0n, // placeholder — real id comes from backend
          checkInType: optimisticCheckInType,
          executedIfThen: executedIfThen ?? false,
          isLockIn: goal?.isLockIn ?? false,
          obstacleTemplateId: obstacleId,
          customObstacleNote: customObstacleNote,
        });
        return next;
      });
    } else if (backendType === CheckInType.inProgress) {
      // Bug 3: play a brief in-progress pulse animation (card stays in Active)
      setInProgressPulseMap((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setInProgressPulseMap((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 600);
    }

    setPendingGoalId(key);
    checkInMutation.mutate({
      goalId,
      checkInType: backendType,
      obstacleTemplateId: obstacleId,
      lockInStartedAt:
        lockInStartedAtMs !== undefined
          ? BigInt(Math.floor(lockInStartedAtMs)) * 1_000_000n
          : undefined,
      lockInEndedAt:
        lockInEndedAtMs !== undefined
          ? BigInt(Math.floor(lockInEndedAtMs)) * 1_000_000n
          : undefined,
      executedIfThen: executedIfThen ?? false,
      customObstacleNote,
    });
  }

  // ── Bug 10: periodic check for in-progress Lock-In goals that should be 'missed' ──
  // Runs every 30s. If past endTime + 5min AND goal has inProgress check-in, the
  // getLockInState function will return 'missed' automatically on next render.
  // No new backend write needed — just force a re-render every 30s.
  const [_lockInStateTick, setLockInStateTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setLockInStateTick((n) => n + 1);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Bug 5: on data load, clean up any non-Lock-In goals with inProgress check-ins ──
  // These are stuck states from previous bugs. Auto-delete the check-in so the
  // card returns to Active and can be swiped normally.
  const cleanupDoneRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: actor/queryClient/userTimezone/isLoading are stable; run on data changes only
  useEffect(() => {
    if (cleanupDoneRef.current || !actor || checkIns.length === 0 || isLoading)
      return;
    cleanupDoneRef.current = true;
    const stuck = checkIns.filter((c) => {
      if (c.checkInType !== CheckInType.inProgress) return false;
      if (!isCheckInToday(c.timestamp, userTimezone)) return false;
      const goal = goals.find((g) => goalKey(g.id) === goalKey(c.goalId));
      return goal && !goal.isLockIn; // non-Lock-In with inProgress = stuck
    });
    if (stuck.length === 0) return;
    (async () => {
      for (const c of stuck) {
        try {
          await actor.deleteCheckIn(c.id);
        } catch {
          // best-effort
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
    })();
  }, [goals, checkIns]);
  // Reset cleanup flag so re-runs catch new stuck states
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref mutation only; no external deps needed
  useEffect(() => {
    cleanupDoneRef.current = false;
  }, [goals, checkIns]);

  // ── Undo logic ─────────────────────────────────────────────────────────────
  function handleDoneCardTap(goalId: bigint) {
    // Block undo for ALL Lock-In cards — once in Done they are permanently sealed.
    const doneEntry = mergedDoneMap.get(goalKey(goalId));
    if (doneEntry?.isLockIn) return;

    // done goals are in doneMap but also still in activeGoals since
    // activeGoals = goals filtered by GoalState.active (not by doneMap).
    // We need to search the full goals list, not just unswiped ones.
    const goal = goals.find((g) => goalKey(g.id) === goalKey(goalId));
    if (!goal) return;
    setUndoTarget({ goalId, goal });
  }

  async function handleUndoConfirm() {
    if (!undoTarget) return;
    const key = goalKey(undoTarget.goalId);
    // Get checkInId from the backend-derived map (not localStorage)
    const entry = todayDoneMap.get(key);
    if (!entry) {
      // Check-in may not have landed yet — wait a moment
      toast.error("Still saving — please wait a moment, then try again.");
      return;
    }

    setIsUndoing(true);
    try {
      if (actor) {
        const result = await actor.deleteCheckIn(entry.checkInId);
        if (result.__kind__ === "err") {
          throw new Error("Backend error");
        }
      }
      // Clear animation state so the card re-enters the Active list cleanly
      setSwipeDirectionMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setExitingMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setOptimisticDoneMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      // Mark as recently undone for bounce animation
      setRecentlyUndone((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setRecentlyUndone((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 800);
      // Bug 6: invalidate check-ins so getLockInState re-derives from fresh data,
      // naturally returning Lock-In cards to 'waiting' or correct state.
      void queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
      void fetchWeekHistory();
      setUndoTarget(null);
      // Switch back to active tab
      setActiveTab("active");
    } catch {
      toast.error("Could not undo — please try again.");
    } finally {
      setIsUndoing(false);
    }
  }

  // ── Lock-In today check-in map ────────────────────────────────────────────────────────
  const lockInCheckInMap = useMemo(() => {
    void _lockInStateTick; // ensures memo re-runs on 30s tick
    const map = new Map<string, LockInCheckIn>();
    for (const c of checkIns) {
      if (!isCheckInToday(c.timestamp, userTimezone)) continue;
      const gKey = goalKey(c.goalId);
      let ciType: LockInCheckIn["type"] | null = null;
      if (c.checkInType === CheckInType.inProgress) ciType = "inProgress";
      else if (c.checkInType === CheckInType.missedCheckIn)
        ciType = "missedCheckIn";
      else if (c.checkInType === CheckInType.missedCheckOut)
        ciType = "missedCheckOut";
      else if (c.checkInType === CheckInType.success) ciType = "success";
      if (ciType) {
        map.set(gKey, {
          type: ciType,
          startedAt:
            c.lockInStartedAt !== undefined
              ? Number(c.lockInStartedAt / 1_000_000n)
              : undefined,
          endedAt:
            c.lockInEndedAt !== undefined
              ? Number(c.lockInEndedAt / 1_000_000n)
              : undefined,
        });
      }
    }
    return map;
  }, [checkIns, userTimezone, _lockInStateTick]);

  // unswiped: goals not in todayDoneMap AND not currently exiting
  // Lock-In inProgress goals stay in active tab
  const unswiped = activeGoals.filter((g) => {
    const key = goalKey(g.id);
    // Once a missed Lock-In justification has been submitted, permanently
    // exclude this card from the active list — even before the backend refetch
    // updates lockInCheckInMap (which is the race condition we are fixing).
    if (committedMissedExitsRef.current.has(key)) return false;
    const entry = todayDoneMap.get(key);
    if (entry?.checkInType === "inProgress") return true;
    return !entry && !exitingMap.has(key) && !optimisticDoneMap.has(key);
  });
  // Merged done map: real backend data takes priority; optimistic fills the gap
  // while the backend query refetches after a swipe.
  const mergedDoneMap = useMemo<DoneMap>(() => {
    if (optimisticDoneMap.size === 0) return todayDoneMap;
    const merged = new Map(todayDoneMap);
    for (const [k, v] of optimisticDoneMap) {
      if (!merged.has(k)) merged.set(k, v);
    }
    return merged;
  }, [todayDoneMap, optimisticDoneMap]);
  // done: goals with final check-ins (success, skip, missedCheckIn, missedCheckOut) — from merged map
  const done = activeGoals.filter((g) => {
    const entry = mergedDoneMap.get(goalKey(g.id));
    return entry && entry.checkInType !== "inProgress";
  });
  // exitingGoals: goals mid-slide-out animation (belong to Active DOM still)
  const exitingGoals = activeGoals.filter((g) => exitingMap.has(goalKey(g.id)));
  // trulyUnswiped: goals not in done AND not mid-exit (used for swipe hint)
  const trulyUnswiped = unswiped.filter((g) => !exitingMap.has(goalKey(g.id)));

  // ── Derived counts for progress ring ──────────────────────────────────────────
  const todayCompleted = done.filter(
    (g) => mergedDoneMap.get(goalKey(g.id))?.checkInType === "success",
  ).length;
  const totalActive = activeGoals.length;
  const hasSkipToday = done.some(
    (g) => mergedDoneMap.get(goalKey(g.id))?.checkInType === "skip",
  );
  const isAllComplete = totalActive > 0 && done.length === totalActive;

  // Derive display name
  const displayName =
    profile?.displayName && profile.displayName.trim() !== ""
      ? profile.displayName.trim()
      : "friend";

  function getBehavioralMessage(): string {
    if (isLoading) return `Ready to execute, ${displayName}.`;
    if (totalActive === 0) return `Ready to execute, ${displayName}.`;
    if (isAllComplete) return `Day won, ${displayName}. Disconnect and rest.`;
    if (hasSkipToday && unswiped.length === 0)
      return `Rest with intention, ${displayName}.`;
    if (done.length > 0 && unswiped.length > 0)
      return `Momentum is building, ${displayName}.`;
    return `Ready to execute, ${displayName}.`;
  }

  const behavioralMessage = getBehavioralMessage();

  const headerData = useMemo<DashboardHeaderData>(
    () => ({
      behavioralHook: behavioralMessage,
      progressCompleted: todayCompleted,
      progressTotal: totalActive,
      isComplete: isAllComplete,
    }),
    [behavioralMessage, todayCompleted, totalActive, isAllComplete],
  );

  useDashboardHeaderWriter(headerData);

  // ── Show swipe hint only when there are genuinely swipeable active habits ─────
  // Lock-In cards in 'waiting' or 'in-progress' states cannot be swiped, so they
  // must not count toward the hint trigger.
  const swipeableCount = trulyUnswiped.filter((g) => {
    if (!g.isLockIn || !g.startTime || !g.endTime) return true; // non Lock-In: always swipeable
    const state = getLockInState(
      g.startTime,
      g.endTime,
      lockInCheckInMap.get(goalKey(g.id)),
      g.createdAt,
    );
    return state === "start-window" || state === "end-window";
  }).length;
  const showSwipeHint =
    activeTab === "active" && !isLoading && swipeableCount > 0;

  // Determine if displayName is set (not default "friend")
  const hasDisplayName =
    profile?.displayName && profile.displayName.trim() !== "";

  return (
    <>
      {needsUsername && (
        <ForcedUsernameModal
          onComplete={() => setUsernameModalDismissed(true)}
        />
      )}

      {/* Undo popup */}
      <UndoPopup
        open={!!undoTarget}
        goal={undoTarget?.goal ?? null}
        checkInType={
          undoTarget
            ? (() => {
                const t =
                  (
                    todayDoneMap.get(goalKey(undoTarget.goalId)) ??
                    mergedDoneMap.get(goalKey(undoTarget.goalId))
                  )?.checkInType ?? null;
                if (t === "success") return t;
                if (
                  t === "skip" ||
                  t === "missedCheckIn" ||
                  t === "missedCheckOut"
                )
                  return "skip";
                return null; // inProgress maps to null (not a Done-tab terminal state)
              })()
            : null
        }
        isLoading={isUndoing}
        onUndo={() => {
          void handleUndoConfirm();
        }}
        onKeep={() => setUndoTarget(null)}
      />

      {/* Scrollable habit card list */}
      <div
        className="flex flex-col px-4 pb-6 pt-3"
        style={{ gap: "1.25rem" }}
        data-ocid="dashboard.goal_list"
      >
        {/* ── Greeting section ── */}
        <div
          className="px-1 pt-1"
          data-ocid="dashboard.greeting"
          aria-live="polite"
        >
          <p
            className="font-body leading-snug"
            style={{
              color: "oklch(var(--muted-foreground))",
              fontWeight: 400,
              fontSize: "1.05rem",
              letterSpacing: "0.01em",
            }}
          >
            {(() => {
              // Split the message at the displayName to highlight it
              const msg = behavioralMessage;
              if (!hasDisplayName) return msg;
              const nameIdx = msg.lastIndexOf(displayName);
              if (nameIdx === -1) return msg;
              const before = msg.slice(0, nameIdx);
              const after = msg.slice(nameIdx + displayName.length);
              return (
                <>
                  {before}
                  <span
                    style={{
                      color: "#10B981",
                      fontWeight: 600,
                    }}
                  >
                    {displayName}
                  </span>
                  {after}
                </>
              );
            })()}
          </p>
        </div>

        {/* Tab pills + Create Habit button in the same row */}
        {!isLoading && activeGoals.length > 0 && (
          <div className="flex items-center gap-2">
            <TabPills
              activeTab={activeTab}
              doneCount={done.length}
              onTabChange={setActiveTab}
              badgeAnimKey={badgeAnimKey}
            />
            <button
              type="button"
              onClick={() => setShowWoop(true)}
              data-ocid="dashboard.create_habit_button"
              aria-label="Create a new habit"
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-smooth ml-auto"
              style={{
                background: "#10B981",
                color: "#022c22",
                fontFamily: "var(--font-body, inherit)",
                boxShadow:
                  "-2px -2px 5px rgba(60,60,65,0.35), 3px 3px 8px rgba(0,0,0,0.65)",
                fontWeight: 500,
              }}
            >
              <Plus size={14} />
              Create Habit
            </button>
          </div>
        )}
        {/* Show Create Habit button even when no goals yet */}
        {!isLoading && activeGoals.length === 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowWoop(true)}
              data-ocid="dashboard.create_habit_button"
              aria-label="Create a new habit"
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-smooth"
              style={{
                background: "#10B981",
                color: "#022c22",
                fontFamily: "var(--font-body, inherit)",
                boxShadow:
                  "-2px -2px 5px rgba(60,60,65,0.35), 3px 3px 8px rgba(0,0,0,0.65)",
                fontWeight: 500,
              }}
            >
              <Plus size={14} />
              Create Habit
            </button>
          </div>
        )}

        {/* Swipe hint — only shows on Active tab with unswiped habits */}
        <AnimatePresence>
          {showSwipeHint && (
            <motion.p
              key="swipe-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-center font-body"
              style={{
                color: "rgba(255,255,255,0.45)",
                fontWeight: 300,
                letterSpacing: "0.015em",
                marginTop: "-0.25rem",
              }}
              data-ocid="dashboard.swipe_hint"
              aria-live="polite"
            >
              Swipe Right to Complete • Left to Skip
            </motion.p>
          )}
        </AnimatePresence>

        {/* Loading skeletons */}
        {isLoading && (
          <div
            className="flex flex-col"
            style={{ gap: "1.5rem" }}
            data-ocid="dashboard.loading_state"
          >
            {[1, 2].map((n) => (
              <div
                key={n}
                className="rounded-2xl p-5 animate-pulse"
                style={{
                  backgroundColor: "oklch(var(--card))",
                  boxShadow:
                    "-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 14px rgba(0,0,0,0.8)",
                }}
              >
                <div className="h-3 w-24 rounded-full bg-muted mb-3" />
                <div className="h-6 w-3/4 rounded-full bg-muted mb-2" />
                <div className="h-4 w-1/2 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state (no goals at all) */}
        {!isLoading && activeGoals.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl"
            style={{
              backgroundColor: "oklch(var(--card))",
              boxShadow:
                "-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 12px rgba(0,0,0,0.8)",
            }}
            data-ocid="dashboard.empty_state"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{
                backgroundColor: "oklch(var(--color-accent-success) / 0.1)",
                boxShadow:
                  "0 0 32px 4px oklch(var(--color-accent-success) / 0.15)",
              }}
            >
              <Target
                className="w-8 h-8"
                style={{ color: "oklch(var(--color-accent-success))" }}
              />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              No active habits yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-4">
              Create your first keystone habit using the WOOP framework.
            </p>
            <button
              type="button"
              onClick={() => setShowWoop(true)}
              data-ocid="dashboard.empty_create_habit_button"
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-smooth"
              style={{
                background: "#10B981",
                color: "#022c22",
                fontWeight: 700,
                boxShadow:
                  "-2px -2px 5px rgba(60,60,65,0.35), 3px 3px 8px rgba(0,0,0,0.65)",
              }}
            >
              <Plus size={12} />
              Create Habit
            </button>
          </motion.div>
        )}

        {/* Active tab: un-swiped habits + currently-exiting ones (mid-animation) */}
        {!isLoading && activeTab === "active" && (
          <AnimatePresence mode="popLayout">
            {unswiped.length === 0 &&
            exitingGoals.length === 0 &&
            activeGoals.length > 0 ? (
              <motion.div
                key="all-done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-10 px-6 rounded-2xl"
                style={{
                  backgroundColor: "oklch(var(--card))",
                  boxShadow:
                    "-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 12px rgba(0,0,0,0.8)",
                }}
                data-ocid="dashboard.active_empty_state"
              >
                <p className="text-sm text-muted-foreground">
                  All habits logged today. Check the <strong>Done</strong> tab.
                </p>
              </motion.div>
            ) : (
              // Render unswiped goals + any currently-exiting goals
              [...unswiped, ...exitingGoals].map((goal, index) => {
                const key = goalKey(goal.id);
                const isExiting = exitingMap.has(key);
                const isNewHabit = newHabitId === key;
                return (
                  <div key={key} className="relative">
                    <GoalCard
                      goal={goal}
                      checkInToday={undefined}
                      analytics={analyticsMap.get(key)}
                      index={index}
                      weekHistory={weekHistoryMap.get(key)}
                      weekHistoryLoading={weekHistoryLoading}
                      mode="active"
                      onCheckIn={handleGoalCardCheckIn}
                      onExitComplete={handleCardExitComplete}
                      onInsightOpen={setInsightGoal}
                      isDarkMode={isDarkMode}
                      isCheckingIn={
                        pendingGoalId === key && checkInMutation.isPending
                      }
                      isSkipping={
                        pendingGoalId === key && checkInMutation.isPending
                      }
                      animateIn={recentlyUndone.has(key)}
                      exitDirection={
                        isExiting
                          ? (exitingMap.get(key) ?? null)
                          : (swipeDirectionMap.get(key) ?? null)
                      }
                      isExiting={isExiting}
                      inProgressPulse={inProgressPulseMap.has(key)}
                      isLockIn={goal.isLockIn}
                      lockInStartTime={goal.startTime}
                      lockInEndTime={goal.endTime}
                      lockInTodayCheckIn={lockInCheckInMap.get(key)}
                      onMissedWindowTap={() => {
                        /* handled inside GoalCard via MissedWindowSheet */
                      }}
                    />
                    {isNewHabit && <NewHabitGlow />}
                    {isNewHabit && <NewHabitBadge />}
                  </div>
                );
              })
            )}
          </AnimatePresence>
        )}

        {/* Done tab: swiped habits */}
        {!isLoading && activeTab === "done" && (
          <AnimatePresence mode="popLayout">
            {done.length === 0 ? (
              <motion.div
                key="done-empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-10 px-6 rounded-2xl"
                style={{
                  backgroundColor: "oklch(var(--card))",
                  boxShadow:
                    "-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 12px rgba(0,0,0,0.8)",
                }}
                data-ocid="dashboard.done_empty_state"
              >
                <p className="text-sm text-muted-foreground">
                  No completed habits yet — swipe some habits on the{" "}
                  <strong>Active</strong> tab.
                </p>
              </motion.div>
            ) : (
              done.map((goal, index) => {
                const key = goalKey(goal.id);
                const entry = mergedDoneMap.get(key);
                const swipeDir = swipeDirectionMap.get(key) ?? null;
                return (
                  <GoalCard
                    key={key}
                    goal={goal}
                    checkInToday={
                      entry
                        ? {
                            checkInType: entry.checkInType,
                            obstacleTemplateId: entry.obstacleTemplateId,
                            customObstacleNote: entry.customObstacleNote,
                          }
                        : undefined
                    }
                    analytics={analyticsMap.get(key)}
                    index={index}
                    weekHistory={weekHistoryMap.get(key)}
                    weekHistoryLoading={weekHistoryLoading}
                    mode="done"
                    onDoneCardTap={handleDoneCardTap}
                    onInsightOpen={setInsightGoal}
                    isDarkMode={isDarkMode}
                    entryFrom={swipeDir}
                    isLockIn={goal.isLockIn}
                    lockInStartTime={goal.startTime}
                    lockInEndTime={goal.endTime}
                    executedIfThen={entry?.executedIfThen ?? false}
                  />
                );
              })
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Goal Insight Sheet — always mounted so exit animation plays before unmount */}
      <AnimatePresence>
        {insightGoal && (
          <GoalInsightSheet
            key={String(insightGoal.id)}
            goal={insightGoal}
            isOpen={true}
            onClose={() => setInsightGoal(null)}
          />
        )}
      </AnimatePresence>

      {/* WOOP Wizard — opened from dashboard Create Habit button */}
      <WoopWizard
        open={showWoop}
        onClose={() => setShowWoop(false)}
        existingLockInGoals={activeGoals
          .filter((g) => g.isLockIn && g.startTime && g.endTime)
          .map((g) => ({
            id: g.id,
            startTime: g.startTime,
            endTime: g.endTime,
            wishDescription: g.wishDescription,
          }))}
        onGoalCreated={(goalId) => {
          queryClient.invalidateQueries({ queryKey: ["myGoals"] });
          // NOTE: Do NOT call setShowWoop(false) here.
          // WoopWizard.handleClose() already calls onClose() which sets showWoop=false.
          // A second setShowWoop(false) here creates a double-close that prevents
          // the wizard's useEffect(open) reset from running cleanly.
          if (goalId) {
            try {
              localStorage.setItem(NEW_HABIT_KEY, goalId);
            } catch {}
            setNewHabitId(goalId);
          }
        }}
      />
    </>
  );
}
