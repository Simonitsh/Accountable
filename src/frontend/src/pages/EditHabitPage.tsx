import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Check, ChevronLeft, Lock, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { UpdateGoalRequest } from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";
import { useUserProfile } from "../hooks/useUserProfile";
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

const BLOCKED_LABELS = new Set(["my brain", "drugs", "drug", "brain"]);

function buildOffsetOptions(min: number, max: number): number[] {
  const opts: number[] = [];
  for (let v = min; v <= max; v += 5) opts.push(v);
  return opts;
}

function formatOffsetLabel(v: number): string {
  if (v === 0) return "0 min (at time)";
  if (v < 0) return `${Math.abs(v)} min before`;
  return `+${v} min after`;
}

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

function formatTime12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

interface SelectedObstacle {
  id: string;
  label: string;
  kind: "builtin" | "custom";
}

const wheelStyle: React.CSSProperties = {
  background: "oklch(var(--card))",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow:
    "inset 2px 2px 6px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(80,80,85,0.15)",
  color: "oklch(var(--foreground))",
  padding: "6px 0",
  outline: "none",
  overflowY: "auto",
};

const amberWheelStyle: React.CSSProperties = {
  ...wheelStyle,
  border: "1px solid rgba(245,158,11,0.25)",
};

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
  const { data: userProfile } = useUserProfile();
  const hasEmail = Boolean(
    (userProfile as unknown as { email?: string })?.email,
  );

  // ── Fetch habit ────────────────────────────────────────────────────────────
  const { data: goals, isLoading } = useQuery({
    queryKey: ["myGoals"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listMyGoals();
    },
    enabled: !!actor,
  });

  const habit = useMemo(
    () => goals?.find((g) => g.id === BigInt(id)),
    [goals, id],
  );

  // ── Section 1: General fields ──────────────────────────────────────────────
  const [wish, setWish] = useState("");
  const [wishDescription, setWishDescription] = useState("");
  const [ifThenPlan, setIfThenPlan] = useState("");
  const [iconName, setIconName] = useState("target");
  const [themeColor, setThemeColor] = useState("#2563EB");
  const [obstacles, setObstacles] = useState<SelectedObstacle[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [customChips, setCustomChips] = useState<SelectedObstacle[]>([]);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [customError, setCustomError] = useState("");

  // Lock-In
  const [isLockIn, setIsLockIn] = useState(false);
  const [lockInStartTime, setLockInStartTime] = useState("");
  const [lockInEndTime, setLockInEndTime] = useState("");
  const [lockInDurationHours, setLockInDurationHours] = useState(0);
  const [lockInDurationMinutes, setLockInDurationMinutes] = useState(0);
  const [overlapError, setOverlapError] = useState<string | null>(null);

  // ── Section 2: Email reminder fields (daily lockout) ──────────────────────
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [intentTime, setIntentTime] = useState("");
  const [reminderOffset, setReminderOffset] = useState(0);

  // ── Populate form from habit ──────────────────────────────────────────────
  useEffect(() => {
    if (!habit) return;

    setWish(habit.wish ?? "");
    setWishDescription(habit.wishDescription ?? "");
    setIfThenPlan(habit.ifThenPlan ?? "");
    setIconName(habit.iconName ?? "target");
    setThemeColor(habit.themeColor ?? "#2563EB");
    setIsLockIn(habit.isLockIn ?? false);
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
    const customFromBackend: SelectedObstacle[] = [];
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
      } else if (!BLOCKED_LABELS.has(label.toLowerCase())) {
        const chip: SelectedObstacle = {
          id: `custom_${label}`,
          label,
          kind: "custom",
        };
        customFromBackend.push(chip);
      }
    }
    setObstacles([...builtinChips, ...customFromBackend]);
    setCustomChips(customFromBackend);

    setEmailNotifications(habit.emailNotifications ?? false);
    setIntentTime(habit.intentTime ?? "");
    setReminderOffset(
      habit.reminderOffset !== undefined ? Number(habit.reminderOffset) : 0,
    );
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
    if (!isLockIn || !lockInStartTime || !lockInEndTime || !goals) {
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
  }, [isLockIn, lockInStartTime, lockInEndTime, goals, id]);

  // ── Daily lockout for email reminder fields ───────────────────────────────
  const isLockedForToday = useMemo(() => {
    if (!habit?.lastEditedAt) return false;
    const tzOffsetMs = new Date().getTimezoneOffset() * 60 * 1000 * -1;
    const lastEditedMs = Number(habit.lastEditedAt / 1_000_000n);
    const nowMs = Date.now();
    const lastDay = Math.floor((lastEditedMs + tzOffsetMs) / 86_400_000);
    const today = Math.floor((nowMs + tzOffsetMs) / 86_400_000);
    return lastDay === today;
  }, [habit?.lastEditedAt]);

  // ── Ulysses Pact: Lock-In time fields locked during active window ─────────
  const isLockInWindowActive = useMemo(() => {
    if (!isLockIn || !lockInStartTime || !lockInEndTime) return false;
    return isLockInActiveWindow(lockInStartTime, lockInEndTime);
  }, [isLockIn, lockInStartTime, lockInEndTime]);

  // ── Max allowed Lock-In duration ──────────────────────────────────────────
  const maxLockInMinutes = useMemo(() => {
    if (!lockInStartTime) return 0;
    const [h, m] = lockInStartTime.split(":").map(Number);
    return Math.max(0, 1435 - (h * 60 + m));
  }, [lockInStartTime]);
  const maxLockInHours = Math.floor(maxLockInMinutes / 60);
  const maxLockInMinAtMaxHour =
    lockInDurationHours === maxLockInHours ? maxLockInMinutes % 60 : 59;

  // ── Max positive reminder offset (normal habits) ──────────────────────────
  const maxPositiveOffset = useMemo(() => {
    if (!intentTime) return 60;
    const [h, m] = intentTime.split(":").map(Number);
    return Math.min(60, Math.max(0, 1435 - (h * 60 + m)));
  }, [intentTime]);

  const offsetMin = -60;
  const offsetMax = isLockIn ? 0 : maxPositiveOffset;
  const clampedOffset = Math.min(
    offsetMax,
    Math.max(offsetMin, reminderOffset),
  );
  const offsetOptions = buildOffsetOptions(offsetMin, offsetMax);

  // ── Obstacle helpers ───────────────────────────────────────────────────────
  const allObstacleChips: SelectedObstacle[] = [
    ...OBSTACLE_TEMPLATES.map((o) => ({
      id: o.id,
      label: o.label,
      kind: "builtin" as const,
    })),
    ...customChips,
  ];

  function toggleObstacle(chip: SelectedObstacle) {
    setObstacles((prev) => {
      const exists = prev.find((o) => o.id === chip.id);
      return exists ? prev.filter((o) => o.id !== chip.id) : [...prev, chip];
    });
  }

  function addCustomChip() {
    const label = customInput.trim();
    if (!label) return;
    const norm = label.toLowerCase();
    if (BLOCKED_LABELS.has(norm)) {
      setCustomError("That obstacle is not allowed.");
      return;
    }
    const alreadyExists =
      customChips.some((c) => c.label.toLowerCase() === norm) ||
      OBSTACLE_TEMPLATES.some((t) => t.label.toLowerCase() === norm);
    if (alreadyExists) {
      setCustomError("That obstacle is already listed.");
      return;
    }
    const chip: SelectedObstacle = {
      id: `custom_${Date.now()}`,
      label,
      kind: "custom",
    };
    setCustomChips((prev) => [...prev, chip]);
    setObstacles((prev) => [...prev, chip]);
    setCustomInput("");
    setCustomError("");
  }

  function removeCustomChip(chipId: string) {
    setCustomChips((prev) => prev.filter((c) => c.id !== chipId));
    setObstacles((prev) => prev.filter((o) => o.id !== chipId));
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const outcomeStr = obstacles.map((o) => o.label).join(", ");
      const req: UpdateGoalRequest = {
        timezoneOffsetMinutes: BigInt(-new Date().getTimezoneOffset()),
        wish: wish.trim(),
        wishDescription: wishDescription.trim(),
        ifThenPlan: ifThenPlan.trim(),
        iconName,
        themeColor,
        isLockIn,
        startTime: isLockIn && lockInStartTime ? lockInStartTime : undefined,
        endTime: isLockIn && lockInEndTime ? lockInEndTime : undefined,
        emailNotifications,
        intentTime: emailNotifications && intentTime ? intentTime : undefined,
        reminderOffset: emailNotifications ? BigInt(clampedOffset) : undefined,
      };
      // outcome is not in UpdateGoalRequest — we send the rest as-is
      void outcomeStr;
      const result = await actor.updateGoal(BigInt(id), req);
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
      navigate({ to: "/goals" });
    },
  });

  function canSave(): boolean {
    if (!wish.trim()) return false;
    if (isLockIn && !lockInStartTime) return false;
    if (isLockIn && lockInDurationHours === 0 && lockInDurationMinutes === 0)
      return false;
    if (overlapError) return false;
    if (emailNotifications && !isLockIn && !intentTime) return false;
    return true;
  }

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

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8 pb-24">
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
            {/* ─── SECTION 1: GENERAL (always editable) ─── */}
            <div>
              <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase mb-5">
                General
              </p>
              <div className="space-y-5">
                {/* Macro Goal */}
                <div className="space-y-2" style={insetCard}>
                  <label htmlFor="edit-wish" className={sectionLabel}>
                    Macro Goal
                  </label>
                  <input
                    id="edit-wish"
                    data-ocid="edit_habit.wish_input"
                    value={wish}
                    maxLength={140}
                    onChange={(e) => setWish(e.target.value.slice(0, 140))}
                    onFocus={() => setFocusedField("wish")}
                    onBlur={() => setFocusedField(null)}
                    className="w-full rounded-xl px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    style={{
                      background: "oklch(var(--muted) / 0.4)",
                      boxShadow:
                        "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                    placeholder="I want to run a marathon so that I can…"
                  />
                  <p
                    className={`text-right text-xs text-muted-foreground/60 font-mono transition-opacity duration-200 ${focusedField === "wish" ? "opacity-100" : "opacity-0"}`}
                  >
                    {wish.length}/140
                  </p>
                </div>

                {/* Keystone Habit */}
                <div className="space-y-2" style={insetCard}>
                  <label htmlFor="edit-desc" className={sectionLabel}>
                    Keystone Habit
                  </label>
                  <textarea
                    id="edit-desc"
                    data-ocid="edit_habit.wish_description_input"
                    value={wishDescription}
                    maxLength={140}
                    rows={2}
                    onChange={(e) =>
                      setWishDescription(e.target.value.slice(0, 140))
                    }
                    onFocus={() => setFocusedField("wishDescription")}
                    onBlur={() => setFocusedField(null)}
                    className="w-full rounded-xl px-4 py-3 text-base text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                    style={{
                      background: "oklch(var(--muted) / 0.4)",
                      boxShadow:
                        "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                    placeholder="I will run for X minutes"
                  />
                  <p
                    className={`text-right text-xs text-muted-foreground/60 font-mono transition-opacity duration-200 ${focusedField === "wishDescription" ? "opacity-100" : "opacity-0"}`}
                  >
                    {wishDescription.length}/140
                  </p>
                </div>

                {/* If-Then Plan */}
                <div className="space-y-2" style={insetCard}>
                  <label htmlFor="edit-ifthen" className={sectionLabel}>
                    If-Then Plan
                  </label>
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
                    className="w-full rounded-xl px-4 py-3 text-base text-foreground font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                    style={{
                      background: "oklch(var(--muted) / 0.4)",
                      boxShadow:
                        "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                    placeholder="If [obstacle], then I will…"
                  />
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
                      const isCustom = chip.kind === "custom";
                      return (
                        <div
                          key={chip.id}
                          className="relative inline-flex items-center"
                        >
                          <button
                            type="button"
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
                                    backgroundColor:
                                      "oklch(var(--muted) / 0.35)",
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
                          {isCustom && (
                            <button
                              type="button"
                              aria-label={`Remove ${chip.label}`}
                              data-ocid={`edit_habit.remove_custom_obstacle.${idx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCustomChip(chip.id);
                              }}
                              style={{
                                position: "absolute",
                                top: "-8px",
                                right: "-8px",
                                width: "18px",
                                height: "18px",
                                borderRadius: "50%",
                                background: "#2a2a3a",
                                border: "1.5px solid rgba(255,255,255,0.18)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                                zIndex: 10,
                              }}
                            >
                              <X size={9} color="#fff" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      data-ocid="edit_habit.custom_obstacle_input"
                      value={customInput}
                      onChange={(e) => {
                        setCustomInput(e.target.value);
                        setCustomError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomChip();
                        }
                      }}
                      maxLength={60}
                      placeholder="Add custom obstacle…"
                      className="flex-1 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                      style={{
                        background: "oklch(var(--muted) / 0.4)",
                        boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.35)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={addCustomChip}
                      disabled={!customInput.trim()}
                      data-ocid="edit_habit.add_custom_obstacle_button"
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-40 transition-smooth"
                      style={{
                        background: "oklch(var(--color-accent-success) / 0.15)",
                        border:
                          "1px solid oklch(var(--color-accent-success) / 0.4)",
                        color: "oklch(var(--color-accent-success))",
                      }}
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                  {customError && (
                    <p className="text-xs text-destructive">{customError}</p>
                  )}
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

                {/* Lock-In Mode */}
                <div className="space-y-4" style={insetCard}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Lock-In Mode
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Strict time block with check-in &amp; check-out
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isLockIn}
                      data-ocid="edit_habit.lockin_toggle"
                      onClick={() => setIsLockIn((v) => !v)}
                      className="relative shrink-0 w-14 h-7 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        background: isLockIn
                          ? "#F59E0B"
                          : "oklch(var(--muted))",
                        boxShadow: isLockIn
                          ? "inset 2px 2px 5px rgba(0,0,0,0.35), inset -1px -1px 3px rgba(255,255,255,0.12)"
                          : "inset 2px 2px 5px rgba(0,0,0,0.45), inset -2px -2px 4px rgba(255,255,255,0.07)",
                      }}
                    >
                      <span
                        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-300"
                        style={{
                          left: isLockIn ? "calc(100% - 24px)" : "4px",
                          boxShadow: "1px 1px 4px rgba(0,0,0,0.4)",
                        }}
                      />
                    </button>
                  </div>

                  {isLockIn && (
                    <>
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
                          {isLockInWindowActive && (
                            <span className="block mt-1 font-semibold">
                              Active window is open — time fields are locked.
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="edit-lockin-start"
                          className={sectionLabel}
                        >
                          Start Time
                        </label>
                        <input
                          id="edit-lockin-start"
                          type="time"
                          data-ocid="edit_habit.lockin_start_time"
                          value={lockInStartTime}
                          disabled={isLockInWindowActive}
                          onChange={(e) => setLockInStartTime(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-base font-mono text-foreground border border-border/30 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                          style={{
                            background: "oklch(var(--card))",
                            boxShadow:
                              "inset 2px 2px 5px rgba(0,0,0,0.4), inset -1px -1px 3px rgba(80,80,85,0.15)",
                            colorScheme: "dark",
                          }}
                        />
                      </div>

                      {lockInStartTime ? (
                        <div>
                          <span className={sectionLabel}>Duration</span>
                          {maxLockInMinutes === 0 ? (
                            <p className="text-xs text-destructive">
                              No duration available — start time leaves no room
                              before 23:55 cutoff.
                            </p>
                          ) : (
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label
                                  htmlFor="edit-lockin-hours"
                                  className="block text-[11px] text-muted-foreground/60 mb-1.5"
                                >
                                  Hours
                                </label>
                                <select
                                  id="edit-lockin-hours"
                                  data-ocid="edit_habit.lockin_duration_hours"
                                  value={lockInDurationHours}
                                  disabled={isLockInWindowActive}
                                  onChange={(e) =>
                                    setLockInDurationHours(
                                      Number(e.target.value),
                                    )
                                  }
                                  size={5}
                                  className="w-full rounded-xl font-mono text-base text-center appearance-none cursor-pointer disabled:opacity-50"
                                  style={amberWheelStyle}
                                >
                                  {Array.from(
                                    { length: maxLockInHours + 1 },
                                    (_, i) => i,
                                  ).map((h) => (
                                    <option
                                      key={h}
                                      value={h}
                                      style={{
                                        background: "oklch(var(--card))",
                                        color:
                                          lockInDurationHours === h
                                            ? "#F59E0B"
                                            : "oklch(var(--foreground))",
                                        fontWeight:
                                          lockInDurationHours === h ? 700 : 400,
                                      }}
                                    >
                                      {String(h).padStart(2, "0")}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex-1">
                                <label
                                  htmlFor="edit-lockin-mins"
                                  className="block text-[11px] text-muted-foreground/60 mb-1.5"
                                >
                                  Min
                                </label>
                                <select
                                  id="edit-lockin-mins"
                                  data-ocid="edit_habit.lockin_duration_minutes"
                                  value={lockInDurationMinutes}
                                  disabled={isLockInWindowActive}
                                  onChange={(e) =>
                                    setLockInDurationMinutes(
                                      Number(e.target.value),
                                    )
                                  }
                                  size={5}
                                  className="w-full rounded-xl font-mono text-base text-center appearance-none cursor-pointer disabled:opacity-50"
                                  style={amberWheelStyle}
                                >
                                  {Array.from(
                                    { length: maxLockInMinAtMaxHour + 1 },
                                    (_, i) => i,
                                  ).map((m) => (
                                    <option
                                      key={m}
                                      value={m}
                                      style={{
                                        background: "oklch(var(--card))",
                                        color:
                                          lockInDurationMinutes === m
                                            ? "#F59E0B"
                                            : "oklch(var(--foreground))",
                                        fontWeight:
                                          lockInDurationMinutes === m
                                            ? 700
                                            : 400,
                                      }}
                                    >
                                      {String(m).padStart(2, "0")}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                          {lockInEndTime &&
                            !(
                              lockInDurationHours === 0 &&
                              lockInDurationMinutes === 0
                            ) && (
                              <p className="text-xs font-mono text-muted-foreground/70 mt-2">
                                Ends at{" "}
                                <span style={{ color: "#F59E0B" }}>
                                  {formatTime12h(lockInEndTime)}
                                </span>
                              </p>
                            )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 italic">
                          Select a start time first to set the duration.
                        </p>
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
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ─── SECTION 2: EMAIL REMINDERS (once-per-day lockout) ─── */}
            <div>
              <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase mb-5">
                Email Reminders
              </p>

              {isLockedForToday && (
                <div
                  className="rounded-xl p-4 mb-4 text-sm flex items-start gap-2.5"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.3)",
                    color: "#F59E0B",
                  }}
                  data-ocid="edit_habit.reminder_lock_banner"
                >
                  <Lock size={15} className="shrink-0 mt-0.5" />
                  <span>
                    You have already updated reminders today. To build
                    consistency, further edits are locked until tomorrow.
                  </span>
                </div>
              )}

              <div className="space-y-4" style={insetCard}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Enable Email Reminders
                    </p>
                    {!hasEmail && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Requires an email address.{" "}
                        <a
                          href="/profile"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                          style={{ color: "#10B981" }}
                        >
                          Update Profile
                        </a>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={emailNotifications}
                    data-ocid="edit_habit.email_notifications_toggle"
                    disabled={!hasEmail || isLockedForToday}
                    onClick={() => {
                      if (!hasEmail || isLockedForToday) return;
                      setEmailNotifications((v) => !v);
                    }}
                    className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background:
                        emailNotifications && hasEmail
                          ? "#10B981"
                          : "oklch(var(--muted))",
                      boxShadow:
                        emailNotifications && hasEmail
                          ? "0 0 10px rgba(16,185,129,0.4)"
                          : "inset 2px 2px 5px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(255,255,255,0.05)",
                    }}
                  >
                    <span
                      className="inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-all duration-200"
                      style={{
                        marginLeft:
                          emailNotifications && hasEmail
                            ? "calc(100% - 20px)"
                            : "4px",
                      }}
                    />
                  </button>
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out space-y-4 ${emailNotifications && hasEmail ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}
                >
                  {!isLockIn && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="edit-intent-time"
                        className={sectionLabel}
                      >
                        When do you plan to do this?
                      </label>
                      <input
                        id="edit-intent-time"
                        type="time"
                        data-ocid="edit_habit.intent_time_input"
                        value={intentTime}
                        disabled={isLockedForToday}
                        onChange={(e) => setIntentTime(e.target.value)}
                        className="w-full rounded-xl px-3 py-2.5 text-base font-mono text-foreground border border-border/30 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                        style={{
                          background: "oklch(var(--card))",
                          boxShadow:
                            "inset 2px 2px 5px rgba(0,0,0,0.4), inset -1px -1px 3px rgba(80,80,85,0.15)",
                          colorScheme: "dark",
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className={sectionLabel} style={{ marginBottom: 0 }}>
                        Reminder Offset
                      </p>
                      <span
                        className="text-sm font-mono"
                        style={{ color: "#10B981" }}
                        data-ocid="edit_habit.reminder_offset_display"
                      >
                        {formatOffsetLabel(clampedOffset)}
                      </span>
                    </div>
                    {isLockIn ? (
                      <p className="text-xs text-muted-foreground/70 italic">
                        Lock-In reminders can only be sent before the start time
                        (up to 60 min before).
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/70 italic">
                        Normal habits: −60 to +60 min relative to intent time
                        (capped at 23:55).
                      </p>
                    )}
                    <select
                      data-ocid="edit_habit.reminder_offset_wheel"
                      value={clampedOffset}
                      disabled={isLockedForToday}
                      onChange={(e) =>
                        setReminderOffset(Number(e.target.value))
                      }
                      size={5}
                      className="w-full rounded-xl font-mono text-sm text-center appearance-none cursor-pointer disabled:opacity-50"
                      style={wheelStyle}
                    >
                      {offsetOptions.map((v) => (
                        <option
                          key={v}
                          value={v}
                          style={{
                            background: "oklch(var(--card))",
                            color:
                              clampedOffset === v
                                ? "#10B981"
                                : "oklch(var(--foreground))",
                            fontWeight: clampedOffset === v ? 700 : 400,
                          }}
                        >
                          {formatOffsetLabel(v)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="text-xs text-muted-foreground/70">
                    Note: You can only adjust intent-time and email reminders
                    once per day after creation.
                  </p>
                </div>
              </div>
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
              onClick={() => saveMutation.mutate()}
              disabled={!canSave() || saveMutation.isPending}
              data-ocid="edit_habit.save_button"
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
          </>
        )}
      </div>
    </div>
  );
}

export default EditHabitPage;
