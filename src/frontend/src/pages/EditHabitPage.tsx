import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Check, ChevronLeft, Lock, RotateCw, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  GoalWithHabitsPublic,
  HabitPublic,
  UpdateHabitRequest,
} from "../types";

import { DayPickerRow } from "../components/DayPickerRow";
import { ScrollWheelPicker } from "../components/ScrollWheelPicker";
import SuggestionButton from "../components/SuggestionButton";
import { useBackend } from "../hooks/useBackend";
import { getPlaceholder } from "../lib/placeholders";
import { OBSTACLE_TEMPLATES } from "../types/index";
import { GOAL_ICONS } from "../utils/goalIcons";

const THEME_COLORS = [
  { id: "amethyst", label: "Amethyst", value: "#7C3AED" },
  { id: "sapphire", label: "Sapphire", value: "#2563EB" },
  { id: "emerald", label: "Emerald", value: "#059669" },
  { id: "amber", label: "Amber", value: "#D97706" },
  { id: "rose", label: "Rose", value: "#E11D48" },
  { id: "slate", label: "Slate", value: "#475569" },
  { id: "copper", label: "Copper", value: "#C2410C" },
  { id: "teal", label: "Teal", value: "#0D9488" },
];

function isLockInActiveWindow(startTime: string, endTime: string): boolean {
  const now = Date.now();
  const today = new Date();
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const windowStart =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      sh,
      sm,
    ).getTime() -
    5 * 60 * 1000;
  const windowEnd =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      eh,
      em,
    ).getTime() +
    5 * 60 * 1000;
  return now >= windowStart && now <= windowEnd;
}

function recalcEndTime(
  startTime: string,
  durationHours: number,
  durationMinutes: number,
): string {
  if (!startTime) return "";
  const [h, m] = startTime.split(":").map(Number);
  const totalMins = h * 60 + m + durationHours * 60 + durationMinutes;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function parseHHMMToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

interface SelectedObstacle {
  id: string;
  label: string;
  kind: "builtin" | "custom";
}

const sectionLabel =
  "block text-xs font-mono tracking-widest text-muted-foreground uppercase mb-2";

const insetCard: React.CSSProperties = {
  background: "oklch(var(--card))",
  boxShadow:
    "inset 2px 2px 6px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(255,255,255,0.04)",
  borderRadius: "1rem",
  padding: "1.25rem",
};

export function EditHabitPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"general" | "time">("general");
  const [timeEditsToday, setTimeEditsToday] = useState(0);
  const [showTimeConfirmation, setShowTimeConfirmation] = useState(false);

  // ── Fetch habit ────────────────────────────────────────────────────────────
  // listMyGoals() returns GoalWithHabitsPublic[] (macro goals grouped with
  // their linked habits). Flatten the groups into a single habit list and find
  // the habit matching the route id.
  const { data: goals, isLoading } = useQuery<HabitPublic[]>({
    queryKey: ["myGoals"],
    queryFn: async () => {
      if (!actor) return [];
      const groups = (await actor.listMyGoals()) as GoalWithHabitsPublic[];
      return groups.flatMap((g) => g.habits);
    },
    enabled: !!actor,
  });

  const habit = useMemo(
    () => goals?.find((g) => g.id === BigInt(id)),
    [goals, id],
  );

  // ── Goal-reuse awareness ──────────────────────────────────────────────────
  // When the habit has a goalId set, it reuses a previously-made goal. This
  // flag drives the "Reusing a previous goal" badge and explanatory text only.
  const isReusedGoal = !!(
    habit?.goalId !== undefined && habit?.goalId !== null
  );

  // EditHabitPage is only reached for existing habits (creation happens
  // elsewhere), so every loaded habit is an existing goal. Per the user
  // instruction, wish (goal text) and wishDescription (habit name) are
  // immutable for ALL existing goals — render them read-only unconditionally.
  // All other fields (duration, scheduledDays, ifThenPlan, obstacles, icon,
  // theme color) stay fully editable regardless of goalId.

  // ── Section 1: General fields ──────────────────────────────────────────────
  const [wish, setWish] = useState("");
  const [wishDescription, setWishDescription] = useState("");
  const [ifThenPlan, setIfThenPlan] = useState("");
  const [iconName, setIconName] = useState("target");
  const [themeColor, setThemeColor] = useState("#2563EB");
  const [obstacles, setObstacles] = useState<SelectedObstacle[]>([]);
  const [scheduledDays, setScheduledDays] = useState<string[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
  ]);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Lock-In
  const [lockInStartTime, setLockInStartTime] = useState("");
  const [lockInEndTime, setLockInEndTime] = useState("");
  const [lockInDurationHours, setLockInDurationHours] = useState(0);
  const [lockInDurationMinutes, setLockInDurationMinutes] = useState(0);
  const [overlapError, setOverlapError] = useState<string | null>(null);

  // ── Populate form from habit ──────────────────────────────────────────────
  useEffect(() => {
    if (!habit) return;

    setWish(habit.wish ?? "");
    setWishDescription(habit.wishDescription ?? "");
    setIfThenPlan(habit.ifThenPlan ?? "");
    setIconName(habit.iconName ?? "target");
    setThemeColor(habit.themeColor ?? "#2563EB");
    setLockInStartTime(habit.startTime ?? "");
    setLockInEndTime(habit.endTime ?? "");

    if ((habit.isLockIn ?? false) && habit.startTime && habit.endTime) {
      const [sh, sm] = habit.startTime.split(":").map(Number);
      const [eh, em] = habit.endTime.split(":").map(Number);
      const diff = Math.max(0, eh * 60 + em - (sh * 60 + sm));
      setLockInDurationHours(Math.floor(diff / 60));
      setLockInDurationMinutes(diff % 60);
    } else {
      setLockInDurationHours(0);
      setLockInDurationMinutes(0);
    }

    const existingLabels = (habit.outcome ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const builtinChips: SelectedObstacle[] = [];
    for (const label of existingLabels) {
      const preset = OBSTACLE_TEMPLATES.find(
        (t) => t.label.toLowerCase() === label.toLowerCase(),
      );
      if (preset) {
        builtinChips.push({
          id: preset.id,
          label: preset.label,
          kind: "builtin",
        });
      }
    }
    setObstacles(builtinChips);

    const rawDays = (habit as unknown as { scheduledDays?: string[] })
      .scheduledDays;
    setScheduledDays(
      rawDays && rawDays.length > 0
        ? rawDays
        : ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    );

    // Initialize timeEditsToday from lastEditedAt
    const today = new Date().toLocaleDateString();
    const lastEditDate = habit.lastEditedAt
      ? new Date(Number(habit.lastEditedAt) / 1000000).toLocaleDateString()
      : "";
    setTimeEditsToday(lastEditDate === today ? 1 : 0);
  }, [habit]);

  // ── Auto-recalculate Lock-In end time ─────────────────────────────────────
  useEffect(() => {
    if (!lockInStartTime) return;
    const [h, m] = lockInStartTime.split(":").map(Number);
    const startTotal = h * 60 + m;
    const maxMins = Math.max(0, 1435 - startTotal);
    const currentDuration = lockInDurationHours * 60 + lockInDurationMinutes;
    if (currentDuration > maxMins) {
      const clampedH = Math.floor(maxMins / 60);
      const clampedM = maxMins % 60;
      setLockInDurationHours(clampedH);
      setLockInDurationMinutes(clampedM);
      setLockInEndTime(recalcEndTime(lockInStartTime, clampedH, clampedM));
      return;
    }
    setLockInEndTime(
      recalcEndTime(
        lockInStartTime,
        lockInDurationHours,
        lockInDurationMinutes,
      ),
    );
  }, [lockInStartTime, lockInDurationHours, lockInDurationMinutes]);

  // ── Overlap check ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!habit?.isLockIn || !lockInStartTime || !lockInEndTime || !goals) {
      setOverlapError(null);
      return;
    }
    const conflict = (goals ?? []).find((g) => {
      if (g.id === BigInt(id)) return false;
      if (!g.isLockIn || !g.startTime || !g.endTime) return false;
      return lockInStartTime < g.endTime && lockInEndTime > g.startTime;
    });
    setOverlapError(
      conflict
        ? `Conflict: This overlaps with "${conflict.wishDescription || "an existing Lock-In"}".`
        : null,
    );
  }, [habit?.isLockIn, lockInStartTime, lockInEndTime, goals, id]);

  // ── Ulysses Pact: Lock-In time fields locked during active window ─────────
  const isLockInWindowActive = useMemo(() => {
    if (!habit?.isLockIn || !lockInStartTime || !lockInEndTime) return false;
    return isLockInActiveWindow(lockInStartTime, lockInEndTime);
  }, [habit?.isLockIn, lockInStartTime, lockInEndTime]);

  // ── Max allowed Lock-In duration ──────────────────────────────────────────
  const maxLockInMinutes = useMemo(() => {
    if (!lockInStartTime) return 0;
    const [h, m] = lockInStartTime.split(":").map(Number);
    return Math.max(0, 1435 - (h * 60 + m));
  }, [lockInStartTime]);
  const maxLockInHours = Math.floor(maxLockInMinutes / 60);
  const maxLockInMinAtMaxHour =
    lockInDurationHours === maxLockInHours ? maxLockInMinutes % 60 : 59;

  // ── Obstacle helpers ───────────────────────────────────────────────────────
  const allObstacleChips: SelectedObstacle[] = [
    ...OBSTACLE_TEMPLATES.map((o) => ({
      id: o.id,
      label: o.label,
      kind: "builtin" as const,
    })),
  ];

  function toggleObstacle(chip: SelectedObstacle) {
    setObstacles((prev) => {
      const exists = prev.find((o) => o.id === chip.id);
      return exists ? prev.filter((o) => o.id !== chip.id) : [...prev, chip];
    });
  }

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: UpdateHabitRequest) => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.updateHabit(BigInt(id), payload);
      if ("err" in result) {
        throw new Error(
          typeof result.err === "string" ? result.err : "Failed to save",
        );
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myGoals"] });
      toast.success("Habit updated!");
    },
  });

  function buildPayload(
    overrides?: Partial<UpdateHabitRequest>,
  ): UpdateHabitRequest {
    const outcomeStr = obstacles.map((o) => o.label).join(", ");
    void outcomeStr;
    // wish (goal text) and wishDescription (habit name) are immutable for ALL
    // existing goals after creation. EditHabitPage only edits existing habits,
    // so we never send these fields on update — the backend preserves them.
    return {
      timezoneOffsetMinutes: BigInt(-new Date().getTimezoneOffset()),
      ifThenPlan: ifThenPlan.trim(),
      iconName,
      themeColor,
      isLockIn: habit?.isLockIn ?? false,
      scheduledDays,
      startTime:
        habit?.isLockIn && lockInStartTime ? lockInStartTime : undefined,
      endTime: habit?.isLockIn && lockInEndTime ? lockInEndTime : undefined,
      lockInDurationMinutes: habit?.isLockIn
        ? BigInt(lockInDurationHours * 60 + lockInDurationMinutes)
        : BigInt(0),
      startTimeMinutes:
        habit?.isLockIn && lockInStartTime
          ? BigInt(parseHHMMToMinutes(lockInStartTime))
          : BigInt(0),
      endTimeMinutes:
        habit?.isLockIn && lockInStartTime
          ? BigInt(
              Math.min(
                1435,
                parseHHMMToMinutes(lockInStartTime) +
                  lockInDurationHours * 60 +
                  lockInDurationMinutes,
              ),
            )
          : BigInt(0),
      ...overrides,
    };
  }

  function canSaveGeneral(): boolean {
    // wish is read-only for all existing goals and already populated from the
    // habit, so we don't require the local wish state to be non-empty.
    if (overlapError) return false;
    return true;
  }

  function canSaveTime(): boolean {
    if (habit?.isLockIn && isLockInWindowActive) return false;
    if (habit?.isLockIn && !lockInStartTime) return false;
    if (
      habit?.isLockIn &&
      lockInDurationHours === 0 &&
      lockInDurationMinutes === 0
    )
      return false;
    if (overlapError) return false;
    return true;
  }

  const handleGeneralSave = () => {
    saveMutation.mutate(buildPayload({ isTimeEdit: undefined }), {
      onSuccess: () => {
        navigate({ to: "/goals" });
      },
    });
  };

  const handleTimeSave = () => {
    saveMutation.mutate(buildPayload({ isTimeEdit: true }), {
      onSuccess: () => {
        setTimeEditsToday((prev) => prev + 1);
        setShowTimeConfirmation(false);
        toast.success("Time settings saved!");
      },
    });
  };

  // A single computed flag for all Time tab locking
  const isTimeLocked = timeEditsToday >= 1 || isLockInWindowActive;

  const handleTimeSaveClick = () => {
    if (isTimeLocked) return;
    if (timeEditsToday === 0) {
      setShowTimeConfirmation(true);
    }
  };

  // ── Scroll wheel state helpers ────────────────────────────────────────────

  const lockInDurationHourValues = Array.from(
    { length: maxLockInHours + 1 },
    (_, i) => String(i).padStart(2, "0"),
  );
  const lockInDurationMinuteValues = Array.from(
    { length: maxLockInMinAtMaxHour + 1 },
    (_, i) => String(i).padStart(2, "0"),
  );

  const accentColor = habit?.isLockIn ? "#F59E0B" : "#10B981";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center px-4 py-3 border-b border-border"
        style={{
          background: "oklch(var(--card))",
          boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate({ to: "/goals" })}
          className="p-2 rounded-xl mr-2 text-foreground"
          style={{
            boxShadow:
              "3px 3px 8px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)",
          }}
          aria-label="Go back"
          data-ocid="edit_habit.back_button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center pr-9">
          Edit Habit
        </h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        {isLoading && (
          <p className="text-center text-muted-foreground py-8">Loading…</p>
        )}
        {!isLoading && !habit && (
          <div className="text-center space-y-3 py-8">
            <p className="text-muted-foreground">Habit not found.</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/goals" })}
              className="text-sm"
              style={{ color: "#10B981" }}
            >
              Back to My Habits
            </button>
          </div>
        )}

        {habit && (
          <>
            {/* Habit Type Badge */}
            <div className="flex items-center justify-center">
              {habit.isLockIn ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <Lock size={12} />
                  Lock-In Habit
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <Check size={12} />
                  Regular Habit
                </span>
              )}
            </div>

            {/* Category Badge — read-only, immutable after creation */}
            <div className="flex items-center justify-center">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(107,114,128,0.15)",
                  border: "1px solid rgba(107,114,128,0.3)",
                  color: habit.isLockIn ? "#F59E0B" : "#10B981",
                }}
                data-ocid="edit_habit.category_badge"
              >
                <Tag size={12} />
                {habit.category || "Uncategorized"}
              </span>
            </div>

            <p className="text-center text-xs text-muted-foreground/70 -mt-4">
              Habit type and category are permanent and cannot be changed.
            </p>

            {/* Tab Bar */}
            <div
              className="flex gap-2 p-1 rounded-2xl"
              style={{
                background: "oklch(var(--muted) / 0.3)",
                boxShadow:
                  "inset 2px 2px 5px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.03)",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                data-ocid="edit_habit.general_tab"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={
                  activeTab === "general"
                    ? {
                        background: accentColor,
                        color: "#000000",
                        boxShadow:
                          "inset 2px 2px 5px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.2)",
                      }
                    : {
                        background: "transparent",
                        color: "oklch(var(--muted-foreground))",
                        boxShadow:
                          "2px 2px 5px rgba(0,0,0,0.2), -1px -1px 3px rgba(255,255,255,0.03)",
                      }
                }
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("time")}
                data-ocid="edit_habit.time_tab"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={
                  activeTab === "time"
                    ? {
                        background: accentColor,
                        color: "#000000",
                        boxShadow:
                          "inset 2px 2px 5px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.2)",
                      }
                    : {
                        background: "transparent",
                        color: "oklch(var(--muted-foreground))",
                        boxShadow:
                          "2px 2px 5px rgba(0,0,0,0.2), -1px -1px 3px rgba(255,255,255,0.03)",
                      }
                }
              >
                Time
              </button>
            </div>

            {/* ─── GENERAL TAB ─── */}
            {activeTab === "general" && (
              <div className="space-y-5">
                {/* Macro Goal */}
                <div className="space-y-2" style={insetCard}>
                  <div className="flex items-center justify-between">
                    <label htmlFor="edit-wish" className={sectionLabel}>
                      Macro Goal
                    </label>
                    {isReusedGoal && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono tracking-widest uppercase font-semibold"
                        style={{
                          background: "oklch(var(--goal-reuse-accent) / 0.15)",
                          border:
                            "1px solid oklch(var(--goal-reuse-accent) / 0.45)",
                          color: "oklch(var(--goal-reuse-accent))",
                          boxShadow:
                            "0 0 10px oklch(var(--goal-reuse-accent) / 0.25)",
                        }}
                        data-ocid="edit_habit.reusing_goal_badge"
                      >
                        <RotateCw size={10} />
                        Reusing a previous goal
                      </span>
                    )}
                  </div>
                  <p
                    data-ocid="edit_habit.wish_readonly"
                    className="rounded-xl px-4 py-3 text-base text-foreground/90 leading-snug cursor-not-allowed select-text"
                    style={{
                      background: "oklch(var(--muted) / 0.3)",
                      boxShadow:
                        "inset 2px 2px 5px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(255,255,255,0.03)",
                      border:
                        "1px solid oklch(var(--goal-reuse-accent) / 0.25)",
                    }}
                  >
                    {wish || getPlaceholder(habit.category, "wish")}
                  </p>
                  {isReusedGoal && (
                    <p className="text-xs text-muted-foreground/70 leading-snug">
                      This habit reuses a previously made goal. The goal text
                      and habit name are read-only — create a separate new goal
                      if you want different text.
                    </p>
                  )}
                </div>

                {/* Keystone Habit */}
                <div className="space-y-2" style={insetCard}>
                  <label htmlFor="edit-desc" className={sectionLabel}>
                    Keystone Habit
                  </label>
                  <p
                    data-ocid="edit_habit.wish_description_readonly"
                    className="rounded-xl px-4 py-3 text-base text-foreground/90 leading-snug cursor-not-allowed select-text whitespace-pre-wrap"
                    style={{
                      background: "oklch(var(--muted) / 0.3)",
                      boxShadow:
                        "inset 2px 2px 5px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(255,255,255,0.03)",
                      border:
                        "1px solid oklch(var(--goal-reuse-accent) / 0.25)",
                    }}
                  >
                    {wishDescription ||
                      getPlaceholder(habit.category, "wishDescription")}
                  </p>
                </div>

                {/* If-Then Plan */}
                <div className="space-y-2" style={insetCard}>
                  <label htmlFor="edit-ifthen" className={sectionLabel}>
                    If-Then Plan
                  </label>
                  <div className="relative flex items-start gap-2">
                    <textarea
                      id="edit-ifthen"
                      data-ocid="edit_habit.if_then_plan_input"
                      value={ifThenPlan}
                      maxLength={140}
                      rows={2}
                      onChange={(e) =>
                        setIfThenPlan(e.target.value.slice(0, 140))
                      }
                      onFocus={() => setFocusedField("ifThenPlan")}
                      onBlur={() => setFocusedField(null)}
                      className="flex-1 min-w-0 rounded-xl px-4 py-3 text-base text-foreground font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                      style={{
                        background: "oklch(var(--muted) / 0.4)",
                        boxShadow:
                          "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                      placeholder={getPlaceholder(habit.category, "ifThenPlan")}
                    />
                    <SuggestionButton
                      category={habit.category}
                      field="ifThenPlan"
                      onSelect={(value) => setIfThenPlan(value)}
                      alignTop
                    />
                  </div>
                  <p
                    className={`text-right text-xs text-muted-foreground/60 font-mono transition-opacity duration-200 ${focusedField === "ifThenPlan" ? "opacity-100" : "opacity-0"}`}
                  >
                    {ifThenPlan.length}/140
                  </p>
                </div>

                {/* Obstacles */}
                <div className="space-y-4" style={insetCard}>
                  <p className={sectionLabel}>Obstacles</p>
                  <div
                    className="flex flex-wrap gap-2"
                    data-ocid="edit_habit.obstacle_list"
                  >
                    {allObstacleChips.map((chip, idx) => {
                      const selected = obstacles.some((o) => o.id === chip.id);
                      return (
                        <button
                          type="button"
                          key={chip.id}
                          data-ocid={`edit_habit.obstacle.${idx + 1}`}
                          onClick={() => toggleObstacle(chip)}
                          aria-pressed={selected}
                          className="text-sm px-3 py-2 rounded-full border transition-all duration-200"
                          style={
                            selected
                              ? {
                                  backgroundColor:
                                    "oklch(var(--color-accent-social) / 0.2)",
                                  borderColor:
                                    "oklch(var(--color-accent-social))",
                                  color: "oklch(var(--color-accent-social))",
                                  boxShadow:
                                    "0 0 10px oklch(var(--color-accent-social) / 0.35)",
                                }
                              : {
                                  backgroundColor: "oklch(var(--muted) / 0.35)",
                                  borderColor: "oklch(var(--border) / 0.5)",
                                  color: "oklch(var(--muted-foreground))",
                                }
                          }
                        >
                          {selected && (
                            <Check
                              size={11}
                              className="inline mr-1.5 shrink-0"
                            />
                          )}
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Icon Selector */}
                <div className="space-y-3" style={insetCard}>
                  <p className={sectionLabel}>Icon</p>
                  <div
                    className="grid grid-cols-7 gap-2"
                    data-ocid="edit_habit.icon_selector"
                  >
                    {GOAL_ICONS.map((icon) => {
                      const isSelected = iconName === icon.id;
                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => setIconName(icon.id)}
                          aria-label={`Select ${icon.label} icon`}
                          aria-pressed={isSelected}
                          data-ocid={`edit_habit.icon.${icon.id}`}
                          className="relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 p-2"
                          style={
                            isSelected
                              ? {
                                  backgroundColor:
                                    "oklch(var(--color-accent-success) / 0.15)",
                                  border:
                                    "2px solid oklch(var(--color-accent-success))",
                                  color: "oklch(var(--color-accent-success))",
                                  boxShadow:
                                    "0 0 14px oklch(var(--color-accent-success) / 0.3)",
                                }
                              : {
                                  backgroundColor: "oklch(var(--muted) / 0.35)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  color: "oklch(var(--muted-foreground))",
                                  boxShadow:
                                    "2px 2px 5px rgba(0,0,0,0.35), -1px -1px 3px rgba(255,255,255,0.03)",
                                }
                          }
                        >
                          <span className="w-5 h-5 block">{icon.svg}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Picker */}
                <div className="space-y-3" style={insetCard}>
                  <p className={sectionLabel}>Theme Color</p>
                  <div
                    className="flex flex-wrap gap-3"
                    data-ocid="edit_habit.color_selector"
                  >
                    {THEME_COLORS.map((color) => {
                      const isSelected = themeColor === color.value;
                      return (
                        <div
                          key={color.id}
                          className="flex flex-col items-center gap-1"
                        >
                          <button
                            type="button"
                            onClick={() => setThemeColor(color.value)}
                            aria-label={color.label}
                            aria-pressed={isSelected}
                            data-ocid={`edit_habit.color.${color.id}`}
                            className="w-10 h-10 rounded-full transition-all duration-200"
                            style={{
                              backgroundColor: color.value,
                              boxShadow: isSelected
                                ? `0 0 0 2.5px oklch(var(--card)), 0 0 0 4.5px ${color.value}, 0 0 14px ${color.value}66`
                                : "inset 0 1px 2px rgba(0,0,0,0.3)",
                              transform: isSelected ? "scale(1.2)" : "scale(1)",
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {color.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Day Scheduling */}
                <div className="space-y-3" style={insetCard}>
                  <p className={sectionLabel}>Active Days</p>
                  <p className="text-xs text-muted-foreground/70">
                    This habit only appears on selected days.
                  </p>
                  <DayPickerRow
                    selectedDays={scheduledDays}
                    onChange={setScheduledDays}
                  />
                </div>

                {saveMutation.isError && (
                  <p
                    className="text-sm text-destructive px-1"
                    data-ocid="edit_habit.error_state"
                  >
                    {saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : "Failed to save changes"}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleGeneralSave}
                  disabled={!canSaveGeneral() || saveMutation.isPending}
                  data-ocid="edit_habit.save_general_button"
                  className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{
                    background: "#10B981",
                    boxShadow:
                      "3px 3px 8px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)",
                  }}
                >
                  {saveMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            )}

            {/* ─── TIME TAB ─── */}
            {activeTab === "time" && (
              <div className="space-y-5">
                {/* Locked state banner — shown instead of confirmation when already locked */}
                {isTimeLocked && (
                  <div
                    className="flex items-start gap-2 rounded-xl px-3 py-3 text-xs leading-snug"
                    style={{
                      background: isLockInWindowActive
                        ? "rgba(245,158,11,0.08)"
                        : "rgba(100,116,139,0.12)",
                      border: isLockInWindowActive
                        ? "1px solid rgba(245,158,11,0.35)"
                        : "1px solid rgba(100,116,139,0.25)",
                      boxShadow:
                        "inset 2px 2px 6px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.04)",
                    }}
                    data-ocid="edit_habit.time_locked_banner"
                  >
                    <Lock
                      size={13}
                      className="shrink-0 mt-0.5"
                      style={{
                        color: isLockInWindowActive
                          ? "#F59E0B"
                          : "oklch(var(--muted-foreground))",
                      }}
                    />
                    <p
                      style={{
                        color: isLockInWindowActive
                          ? "rgba(251,191,36,0.9)"
                          : "oklch(var(--muted-foreground))",
                      }}
                    >
                      {isLockInWindowActive ? (
                        <span className="font-semibold">
                          Lock-In is active — time settings are locked until the
                          session ends.
                        </span>
                      ) : (
                        <span>
                          Time settings locked until midnight.{" "}
                          <span className="font-semibold">
                            Your changes are saved.
                          </span>
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {/* Lock-In: Ulysses Pact banner — only when not locked by daily limit */}
                {habit.isLockIn && !isTimeLocked && (
                  <div
                    className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-snug"
                    style={{
                      background: "rgba(245,158,11,0.08)",
                      borderLeft: "3px solid rgba(245,158,11,0.7)",
                    }}
                    data-ocid="edit_habit.lockin_commitment_banner"
                  >
                    <Lock
                      size={12}
                      className="shrink-0 mt-0.5"
                      style={{ color: "#F59E0B" }}
                    />
                    <p style={{ color: "rgba(251,191,36,0.9)" }}>
                      <span className="font-semibold">
                        Lock-In time blocks are a strict commitment.
                      </span>{" "}
                      You can only change these times outside your active
                      window.
                    </p>
                  </div>
                )}

                {/* Lock-In Time Settings */}
                {habit.isLockIn && (
                  <div className="space-y-5" style={insetCard}>
                    {/* Start Time */}
                    <div className="space-y-2">
                      <p className={sectionLabel}>Start Time</p>
                      <input
                        type="time"
                        value={lockInStartTime}
                        onChange={(e) => setLockInStartTime(e.target.value)}
                        disabled={isTimeLocked}
                        data-ocid="edit_habit.lockin_start_time_input"
                        className={`w-full transition-opacity duration-200 ${isTimeLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                        style={{
                          background: "oklch(var(--card))",
                          boxShadow:
                            "2px 2px 6px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(80,80,85,0.15)",
                          border: "1px solid rgba(245,158,11,0.4)",
                          borderRadius: "0.75rem",
                          padding: "10px 14px",
                          color: "oklch(var(--foreground))",
                          fontFamily: "monospace",
                          fontSize: "1.1rem",
                          colorScheme: "dark",
                        }}
                      />
                    </div>

                    {/* Duration */}
                    {lockInStartTime && (
                      <div className="space-y-2">
                        <p className={sectionLabel}>Duration</p>
                        {maxLockInMinutes === 0 ? (
                          <p className="text-xs text-destructive">
                            No duration available — start time leaves no room
                            before 23:55 cutoff.
                          </p>
                        ) : (
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <p className="text-[11px] text-muted-foreground/60 mb-1.5 text-center">
                                Hours
                              </p>
                              <ScrollWheelPicker
                                values={lockInDurationHourValues}
                                selectedValue={String(
                                  lockInDurationHours,
                                ).padStart(2, "0")}
                                onChange={(val) =>
                                  setLockInDurationHours(Number(val))
                                }
                                accentColor="#F59E0B"
                                disabled={isTimeLocked}
                                data-ocid="edit_habit.lockin_duration_hours_wheel"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-[11px] text-muted-foreground/60 mb-1.5 text-center">
                                Min
                              </p>
                              <ScrollWheelPicker
                                values={lockInDurationMinuteValues}
                                selectedValue={String(
                                  lockInDurationMinutes,
                                ).padStart(2, "0")}
                                onChange={(val) =>
                                  setLockInDurationMinutes(Number(val))
                                }
                                accentColor="#F59E0B"
                                disabled={isTimeLocked}
                                data-ocid="edit_habit.lockin_duration_minutes_wheel"
                              />
                            </div>
                          </div>
                        )}
                        {lockInEndTime &&
                          !(
                            lockInDurationHours === 0 &&
                            lockInDurationMinutes === 0
                          ) && (
                            <p className="text-xs font-mono text-muted-foreground/70 mt-2 text-center">
                              Ends at{" "}
                              <span style={{ color: "#F59E0B" }}>
                                {lockInEndTime}
                              </span>
                            </p>
                          )}
                      </div>
                    )}

                    {overlapError && (
                      <p
                        className="text-xs font-medium"
                        style={{ color: "#EF4444" }}
                        data-ocid="edit_habit.lockin_overlap.field_error"
                      >
                        {overlapError}
                      </p>
                    )}
                  </div>
                )}

                {/* Time Tab Save */}
                {showTimeConfirmation && !isTimeLocked && (
                  <div
                    className="rounded-xl p-4 space-y-3"
                    style={{
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.35)",
                    }}
                    data-ocid="edit_habit.time_confirmation_card"
                  >
                    <p className="text-sm" style={{ color: "#F59E0B" }}>
                      This is your one time adjustment for today. You won't be
                      able to change these settings again until tomorrow. Are
                      you sure?
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleTimeSave}
                        disabled={saveMutation.isPending}
                        data-ocid="edit_habit.time_confirm_yes_button"
                        className="flex-1 py-2.5 rounded-xl font-semibold text-black text-sm transition-opacity disabled:opacity-40"
                        style={{
                          background: "#F59E0B",
                          boxShadow:
                            "2px 2px 6px rgba(0,0,0,0.3), -1px -1px 3px rgba(255,255,255,0.05)",
                        }}
                      >
                        Yes, Save Anyway
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTimeConfirmation(false)}
                        data-ocid="edit_habit.time_confirm_cancel_button"
                        className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-opacity"
                        style={{
                          background: "oklch(var(--muted))",
                          color: "oklch(var(--foreground))",
                          boxShadow:
                            "2px 2px 6px rgba(0,0,0,0.3), -1px -1px 3px rgba(255,255,255,0.05)",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {saveMutation.isError && (
                  <p
                    className="text-sm text-destructive px-1"
                    data-ocid="edit_habit.error_state"
                  >
                    {saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : "Failed to save changes"}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleTimeSaveClick}
                  disabled={
                    !canSaveTime() || saveMutation.isPending || isTimeLocked
                  }
                  data-ocid="edit_habit.save_time_button"
                  className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{
                    background: accentColor,
                    boxShadow:
                      "3px 3px 8px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)",
                  }}
                >
                  {saveMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Time Settings"
                  )}
                </button>

                {timeEditsToday >= 1 && !isLockInWindowActive && (
                  <p className="text-center text-xs text-muted-foreground/60">
                    {timeEditsToday} time edit used today. Fields unlock at
                    midnight.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default EditHabitPage;
