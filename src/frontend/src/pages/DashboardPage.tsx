import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Target } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckInType, GoalState } from "../backend";
import type { CheckIn as BackendCheckIn, GoalPublic } from "../backend.d.ts";
import { GoalCard } from "../components/GoalCard";
import type { DayStatus } from "../components/GoalCard";
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
const DONE_STATE_KEY = "cumulative-done-state";
const LAST_DATE_KEY = "cumulative-last-date";
const NEW_HABIT_KEY = "cumulative-new-habit-id";
const NEW_HABIT_DURATION_MS = 10_000;

function goalKey(id: bigint): string {
  return String(id);
}

function isTodayTimestamp(ts: bigint): boolean {
  const ms = Number(ts / 1_000_000n);
  const d = new Date(ms);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
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
  checkInType: "success" | "skip";
}

type DoneMap = Map<string, DoneEntry>;

function serializeDoneMap(map: DoneMap): string {
  return JSON.stringify(
    [...map.entries()].map(([k, v]) => [
      k,
      { checkInId: String(v.checkInId), checkInType: v.checkInType },
    ]),
  );
}

function deserializeDoneMap(raw: string): DoneMap {
  try {
    const arr = JSON.parse(raw) as [
      string,
      { checkInId: string; checkInType: "success" | "skip" },
    ][];
    return new Map(
      arr.map(([k, v]) => [
        k,
        { checkInId: BigInt(v.checkInId), checkInType: v.checkInType },
      ]),
    );
  } catch {
    return new Map();
  }
}

function loadDoneMap(): DoneMap {
  try {
    const raw = localStorage.getItem(DONE_STATE_KEY);
    if (!raw) return new Map();
    return deserializeDoneMap(raw);
  } catch {
    return new Map();
  }
}

function saveDoneMap(map: DoneMap) {
  try {
    localStorage.setItem(DONE_STATE_KEY, serializeDoneMap(map));
  } catch {}
}

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

  // Pending done-entry data waiting for the animation to finish
  const pendingDoneDataRef = useRef<Map<string, DoneEntry>>(new Map());

  // ── Track swipe direction per goal for exit animation ─────────────────────────
  const [swipeDirectionMap, setSwipeDirectionMap] = useState<
    Map<string, "left" | "right">
  >(new Map());

  // User timezone (from profile — used for midnight reset)
  const userTimezone =
    profile?.timezone && profile.timezone.trim() !== ""
      ? profile.timezone.trim()
      : undefined;

  // ── Done-map state (persisted to localStorage) ─────────────────────────────────
  const [doneMap, setDoneMapRaw] = useState<DoneMap>(() => {
    // We don't have profile.timezone synchronously at init time, so use local
    // midnight for the initial check. The effect below keeps it updated.
    const storedDate = localStorage.getItem(LAST_DATE_KEY);
    const today = getLocalDateStr();
    if (storedDate && storedDate !== today) {
      // Midnight has passed: clear done state
      localStorage.removeItem(DONE_STATE_KEY);
    }
    localStorage.setItem(LAST_DATE_KEY, today);
    return loadDoneMap();
  });

  function setDoneMap(updater: DoneMap | ((prev: DoneMap) => DoneMap)) {
    setDoneMapRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveDoneMap(next);
      return next;
    });
  }

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

  // ── Midnight reset: fires at next local midnight then repeats daily ──────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: queryClient is stable; intentional re-run only on timezone change
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function scheduleReset() {
      const ms = msUntilMidnight(userTimezone);
      timer = setTimeout(() => {
        // Day boundary crossed: clear done state and update LAST_DATE_KEY
        const today = getLocalDateStr(new Date(), userTimezone);
        localStorage.removeItem(DONE_STATE_KEY);
        localStorage.setItem(LAST_DATE_KEY, today);
        setDoneMapRaw(new Map());
        // Also invalidate check-ins so the weekly tracker refreshes
        queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
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

  // Map goalId (as string) → today's check-in
  const _todayCheckInMap = useMemo(() => {
    const map = new Map<string, BackendCheckIn>();
    for (const c of checkIns) {
      if (isTodayTimestamp(c.timestamp)) {
        map.set(goalKey(c.goalId), c);
      }
    }
    return map;
  }, [checkIns]);

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
    }: {
      goalId: bigint;
      checkInType: CheckInType;
      obstacleTemplateId?: bigint;
    }) => {
      if (!actor) return null;
      return actor.recordCheckIn({ goalId, checkInType, obstacleTemplateId });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
      const key = goalKey(variables.goalId);
      // Update the real checkInId now that we have it from the backend.
      // The optimistic entry was stored immediately in handleGoalCardCheckIn.
      if (data) {
        const checkInId = (data as BackendCheckIn).id;
        const checkInType =
          variables.checkInType === CheckInType.success ? "success" : "skip";
        // Update pendingDoneDataRef if card is still mid-animation
        if (pendingDoneDataRef.current.has(key)) {
          pendingDoneDataRef.current.set(key, { checkInId, checkInType });
        }
        // Also update doneMap if the animation already finished and moved it there
        setDoneMapRaw((prev) => {
          if (!prev.has(key)) return prev; // Card not in done tab yet, nothing to update
          const next = new Map(prev);
          next.set(key, { checkInId, checkInType });
          saveDoneMap(next);
          return next;
        });
      }
      void fetchWeekHistory();
    },
    onError: (_err, variables) => {
      // Mutation failed: show toast but KEEP the card in Done (optimistic).
      // The user can tap the Done card to undo if they want.
      // Only log an error — do NOT bounce the card back to Active.
      const key = goalKey(variables.goalId);
      // Clear the 0n placeholder checkInId so undo will show the right error.
      setDoneMapRaw((prev) => {
        if (!prev.has(key)) return prev;
        // Card is already in Done — mark checkInId as 0n to signal error
        // (undo will refuse 0n and ask user to wait or retry)
        const next = new Map(prev);
        next.set(key, { ...prev.get(key)!, checkInId: 0n });
        saveDoneMap(next);
        return next;
      });
      toast.error("Check-in failed. Tap the card in Done to undo if needed.");
    },
    onSettled: () => {
      setPendingGoalId(null);
    },
  });

  // Called by GoalCard when its Phase-1 exit animation finishes
  function handleCardExitComplete(goalId: bigint) {
    const key = goalKey(goalId);
    // ALWAYS move the card to Done regardless of whether backend has responded.
    // Use pendingDoneDataRef entry if available; otherwise create a fallback
    // optimistic entry with checkInId=0n (will be updated by onSuccess).
    const entry = pendingDoneDataRef.current.get(key) ?? {
      checkInId: 0n,
      checkInType: (swipeDirectionMap.get(key) === "right"
        ? "success"
        : "skip") as "success" | "skip",
    };
    pendingDoneDataRef.current.delete(key);
    setExitingMap((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setDoneMapRaw((prev) => {
      const next = new Map(prev);
      next.set(key, entry);
      saveDoneMap(next);
      return next;
    });
    setBadgeAnimKey((k) => k + 1);
    // Automatically switch to Done tab so the user sees the result
    setActiveTab("done");
  }

  function handleGoalCardCheckIn(
    goalId: bigint,
    type: "success" | "skip",
    obstacleId?: bigint,
  ) {
    const key = goalKey(goalId);
    const direction: "left" | "right" = type === "success" ? "right" : "left";
    // Record direction for Done-tab entry animation
    setSwipeDirectionMap((prev) => {
      const next = new Map(prev);
      next.set(key, direction);
      return next;
    });
    // Phase 1: card stays in Active list but plays exit animation
    setExitingMap((prev) => {
      const next = new Map(prev);
      next.set(key, direction);
      return next;
    });
    setPendingGoalId(key);
    // Store done data IMMEDIATELY (optimistically) so handleCardExitComplete
    // always has it ready when the animation timer fires, regardless of whether
    // the backend mutation has returned yet. We use a placeholder checkInId of
    // 0n; the real ID is updated when onSuccess fires.
    pendingDoneDataRef.current.set(key, {
      checkInId: 0n,
      checkInType: type,
    });
    // Fire backend mutation — onSuccess will update the real checkInId
    checkInMutation.mutate({
      goalId,
      checkInType: type === "success" ? CheckInType.success : CheckInType.skip,
      obstacleTemplateId: obstacleId,
    });
  }

  // ── Undo logic ─────────────────────────────────────────────────────────────
  function handleDoneCardTap(goalId: bigint) {
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
    const entry = doneMap.get(key);
    if (!entry) return;

    // If the real checkInId hasn't arrived from the backend yet (optimistic
    // placeholder is 0n), we cannot delete it. Show an error.
    if (entry.checkInId === 0n) {
      toast.error("Still saving — please wait a moment, then try again.");
      return;
    }

    setIsUndoing(true);
    try {
      if (actor) {
        const result = await actor.deleteCheckIn(entry.checkInId);
        if ("err" in result) {
          throw new Error("Backend error");
        }
      }
      // Remove from done map → goal goes back to Active tab
      setDoneMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      // Clear swipe direction and exiting state so the card re-enters cleanly
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
      // Mark as recently undone for bounce animation
      setRecentlyUndone((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setRecentlyUndone((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 800);
      // Invalidate check-ins
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

  // ── Derived lists ─────────────────────────────────────────────────────────────
  // unswiped: goals not yet in doneMap (exitingMap goals stay here while animating)
  const unswiped = activeGoals.filter((g) => !doneMap.has(goalKey(g.id)));
  const done = activeGoals.filter((g) => doneMap.has(goalKey(g.id)));
  // trulyUnswiped: goals not in done AND not mid-exit (used for swipe hint)
  const trulyUnswiped = unswiped.filter((g) => !exitingMap.has(goalKey(g.id)));

  // ── Derived counts for progress ring ──────────────────────────────────────────
  const todayCompleted = done.filter(
    (g) => doneMap.get(goalKey(g.id))?.checkInType === "success",
  ).length;
  const totalActive = activeGoals.length;
  const hasSkipToday = done.some(
    (g) => doneMap.get(goalKey(g.id))?.checkInType === "skip",
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

  // ── Show swipe hint only when on Active tab with unswiped habits ──────────────
  const showSwipeHint =
    activeTab === "active" && !isLoading && trulyUnswiped.length > 0;

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
            ? (doneMap.get(goalKey(undoTarget.goalId))?.checkInType ?? null)
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

        {/* Active tab: un-swiped habits */}
        {!isLoading && activeTab === "active" && (
          <AnimatePresence mode="popLayout">
            {unswiped.length === 0 && activeGoals.length > 0 ? (
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
              unswiped.map((goal, index) => {
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
                    />
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
                const entry = doneMap.get(key);
                const swipeDir = swipeDirectionMap.get(key) ?? null;
                return (
                  <GoalCard
                    key={key}
                    goal={goal}
                    checkInToday={
                      entry ? { checkInType: entry.checkInType } : undefined
                    }
                    analytics={analyticsMap.get(key)}
                    index={index}
                    weekHistory={weekHistoryMap.get(key)}
                    weekHistoryLoading={weekHistoryLoading}
                    mode="done"
                    onDoneCardTap={handleDoneCardTap}
                    isDarkMode={isDarkMode}
                    entryFrom={swipeDir}
                  />
                );
              })
            )}
          </AnimatePresence>
        )}
      </div>

      {/* WOOP Wizard — opened from dashboard Create Habit button */}
      <WoopWizard
        open={showWoop}
        onClose={() => setShowWoop(false)}
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
