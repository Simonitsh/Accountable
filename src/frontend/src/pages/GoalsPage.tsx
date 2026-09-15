import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Flame,
  Lock,
  Pause,
  Play,
  Save,
  Target,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GoalState } from "../backend";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
import { GoalCardShell } from "../components/GoalCardShell";
import SuggestionButton from "../components/SuggestionButton";
import { useBackend, useDeleteHabit } from "../hooks/useBackend";
import { getPlaceholder } from "../lib/placeholders";
import type {
  GoalState as GoalStateType,
  GoalWithHabitsPublic,
  HabitPublic,
  UpdateHabitRequest,
} from "../types";
import { OBSTACLE_TEMPLATES, useResolveObstacleLabel } from "../types";
import {
  type LockInGoalRef,
  findOverlapGoal as findOverlapGoalShared,
  formatDate,
  isLockInActiveWindow as isLockInActiveWindowShared,
  stateBadgeStyle,
  stateLabel,
} from "../utils/goalDisplay";

// ─── Helpers ──────────────────────────────────────────────────────────────────
type FilterTab = "all" | GoalStateType;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: GoalState.active, label: "Active" },
  { key: GoalState.paused, label: "Paused" },
  { key: GoalState.completed, label: "Completed" },
];

// ─── Edit Form Helpers ─────────────────────────────────────────────────────────
const EDIT_THEME_COLORS = [
  { id: "amethyst", value: "#7C3AED" },
  { id: "sapphire", value: "#2563EB" },
  { id: "emerald", value: "#059669" },
  { id: "amber", value: "#D97706" },
  { id: "rose", value: "#E11D48" },
  { id: "slate", value: "#475569" },
  { id: "copper", value: "#C2410C" },
  { id: "teal", value: "#0D9488" },
];

const EDIT_ICONS = [
  "target",
  "flame",
  "zap",
  "star",
  "heart",
  "trophy",
  "activity",
  "book",
  "music",
  "coffee",
  "moon",
  "sun",
  "running",
  "bicycle",
];

function renderGoalIcon(name: string, size = 16) {
  const iconMap: Record<string, React.ReactNode> = {
    target: <Target size={size} />,
    flame: <Flame size={size} />,
    zap: <Zap size={size} />,
  };
  return iconMap[name] ?? <Target size={size} />;
}

/**
 * Formats an HH:MM time string to 12-hour display (e.g. "14:05" → "2:05 PM").
 * Mirrors formatTime12h in GoalCard.tsx.
 */
function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Adds `minutes` to an HH:MM time string and returns a new HH:MM string.
 * Works within a single day (clamps at 23:59).
 */
function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

/**
 * Returns true if the current time falls within the Active Lock-In Window:
 * [startTime - 5 min, endTime + 5 min].
 * Returns false if the goal is not a Lock-In or is missing times. The guard is
 * preserved here at the call site; the window math itself is delegated to the
 * shared isLockInActiveWindow helper in utils/goalDisplay.
 */
function isLockInActiveWindow(goal: HabitPublic): boolean {
  if (!goal.isLockIn || !goal.startTime || !goal.endTime) return false;
  return isLockInActiveWindowShared(goal.startTime, goal.endTime);
}

/**
 * Thin adapter from the call-site signature (newStart,newEnd,existing,excludeId)
 * to the shared findOverlapGoal (goals,newStartTime,newEndTime,editingGoalId).
 * The newStart > newEnd guard (not >=) lets a zero-duration block (start===end)
 * fall through to the shared implementation, which treats it as a point-in-time
 * overlap check.
 */
function findOverlapGoal(
  newStart: string,
  newEnd: string,
  existing: LockInGoalRef[],
  excludeId?: bigint,
): string | null {
  if (!newStart || !newEnd || newStart > newEnd) return null;
  return findOverlapGoalShared(existing, newStart, newEnd, excludeId);
}

// ─── Edit Form ──────────────────────────────────────────────────────────────────
interface EditFormData {
  wish: string;
  wishDescription: string;
  ifThenPlan: string;
  iconName: string;
  themeColor: string;
  obstacles: string[];
  isLockIn: boolean;
  lockInStartTime: string;
  lockInEndTime: string;
  lockInDurationHours: number;
  lockInDurationMinutes: number;
}

interface GoalEditFormProps {
  goal: HabitPublic;
  onSave: (req: UpdateHabitRequest) => void;
  onCancel: () => void;
  isSaving: boolean;
  existingLockInGoals?: LockInGoalRef[];
}

function GoalEditForm({
  goal,
  onSave,
  onCancel,
  isSaving,
  existingLockInGoals = [],
}: GoalEditFormProps) {
  // Parse existing obstacles from goal.outcome (stored as comma-separated labels)
  const existingObstacles = goal.outcome
    ? goal.outcome
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Keep only preset obstacles (custom obstacles are no longer supported)
  const existingPreset = existingObstacles.filter((o) =>
    OBSTACLE_TEMPLATES.map((t) => t.label.toLowerCase()).includes(
      o.toLowerCase(),
    ),
  );

  // Pre-populate duration wheels from stored startTime/endTime
  const initDuration = (() => {
    if ((goal.isLockIn ?? false) && goal.startTime && goal.endTime) {
      const [sh, sm] = goal.startTime.split(":").map(Number);
      const [eh, em] = goal.endTime.split(":").map(Number);
      const diffMins = eh * 60 + em - (sh * 60 + sm);
      const safeDiff = Math.max(0, diffMins);
      return { hours: Math.floor(safeDiff / 60), minutes: safeDiff % 60 };
    }
    return { hours: 0, minutes: 0 };
  })();

  const [form, setForm] = useState<EditFormData>({
    wish: goal.wish,
    wishDescription: goal.wishDescription,
    ifThenPlan: goal.ifThenPlan,
    iconName: goal.iconName ?? "target",
    themeColor: goal.themeColor ?? "#2563EB",
    obstacles: existingPreset,
    isLockIn: goal.isLockIn ?? false,
    lockInStartTime: goal.startTime ?? "",
    lockInEndTime: goal.endTime ?? "",
    lockInDurationHours: initDuration.hours,
    lockInDurationMinutes: initDuration.minutes,
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const resolveObstacleLabel = useResolveObstacleLabel();
  // Resolved reusable obstacle template ids keyed by built-in label. Populated
  // when a built-in obstacle is picked; the resolved id is sent as
  // obstacleTemplateId in the update payload so the habit links to a real,
  // reusable template record (find-or-create dedup on the backend).
  const [obstacleTemplateIds, setObstacleTemplateIds] = useState<
    Record<string, bigint>
  >({});

  function togglePreset(label: string) {
    const isAdding = !form.obstacles.includes(label);
    setForm((f) => ({
      ...f,
      obstacles: isAdding
        ? [...f.obstacles, label]
        : f.obstacles.filter((o) => o !== label),
    }));
    // Resolve the built-in label to a real, reusable obstacle template id
    // (find-or-create). The first pick creates the record; every later pick
    // of the same label reuses the same one — the existing dedup pattern.
    if (isAdding) {
      void resolveObstacleLabel(label)
        .then((id) =>
          setObstacleTemplateIds((prev) => ({ ...prev, [label]: id })),
        )
        .catch(() => {
          // Backend not ready — the chip stays selected without a template id.
        });
    }
  }

  // Recalculate endTime whenever startTime or duration changes
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

  function handleSave() {
    const req: UpdateHabitRequest & { obstacleTemplateId?: bigint } = {
      timezoneOffsetMinutes: BigInt(-new Date().getTimezoneOffset()),
    };
    if (form.ifThenPlan.trim() !== goal.ifThenPlan)
      req.ifThenPlan = form.ifThenPlan.trim();
    if (form.iconName !== (goal.iconName ?? "target"))
      req.iconName = form.iconName;
    if (form.themeColor !== (goal.themeColor ?? "#2563EB"))
      req.themeColor = form.themeColor;
    if (form.isLockIn !== (goal.isLockIn ?? false))
      req.isLockIn = form.isLockIn;
    if (form.lockInStartTime !== (goal.startTime ?? ""))
      req.startTime = form.lockInStartTime || undefined;
    if (form.lockInEndTime !== (goal.endTime ?? ""))
      req.endTime = form.lockInEndTime || undefined;
    // Persist the resolved reusable obstacle template link for the selected
    // built-in obstacle (first selected preset). The backend replaces the
    // habit's single obstacleTemplateId when provided and leaves it unchanged
    // when absent.
    const selectedBuiltin = form.obstacles[0];
    const resolvedId = selectedBuiltin
      ? obstacleTemplateIds[selectedBuiltin]
      : undefined;
    if (resolvedId !== undefined) req.obstacleTemplateId = resolvedId;
    onSave(req);
  }

  // Duration validation: if Lock-In is enabled, duration must be > 0
  const isDurationZero =
    form.isLockIn &&
    form.lockInDurationHours === 0 &&
    form.lockInDurationMinutes === 0;
  const obstaclesChanged =
    form.obstacles.length !== existingPreset.length ||
    form.obstacles.some((o) => !existingPreset.includes(o));
  const hasChanges =
    form.ifThenPlan.trim() !== goal.ifThenPlan ||
    form.iconName !== (goal.iconName ?? "target") ||
    form.themeColor !== (goal.themeColor ?? "#2563EB") ||
    form.isLockIn !== (goal.isLockIn ?? false) ||
    form.lockInStartTime !== (goal.startTime ?? "") ||
    form.lockInEndTime !== (goal.endTime ?? "") ||
    obstaclesChanged;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="space-y-4"
      data-ocid="goals.edit_form"
    >
      {/* Keystone Habit — most prominent */}
      <div className="space-y-1.5">
        <Label
          htmlFor="edit-desc"
          className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
        >
          Keystone Habit
        </Label>
        <p
          data-ocid="goals.edit_description_readonly"
          className="rounded-xl px-4 py-3 text-sm text-foreground/90 leading-snug cursor-not-allowed select-text whitespace-pre-wrap"
          style={{
            background: "oklch(var(--muted) / 0.3)",
            boxShadow:
              "inset 2px 2px 5px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(255,255,255,0.03)",
            border: "1px solid oklch(var(--border) / 0.25)",
          }}
        >
          {goal.wishDescription ||
            getPlaceholder(goal.category, "wishDescription")}
        </p>
      </div>

      {/* Macro Goal */}
      <div className="space-y-1.5">
        <Label
          htmlFor="edit-wish"
          className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
        >
          Macro Goal
        </Label>
        <p
          data-ocid="goals.edit_wish_readonly"
          className="rounded-xl px-4 py-3 text-sm text-foreground/90 leading-snug cursor-not-allowed select-text"
          style={{
            background: "oklch(var(--muted) / 0.3)",
            boxShadow:
              "inset 2px 2px 5px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(255,255,255,0.03)",
            border: "1px solid oklch(var(--border) / 0.25)",
          }}
        >
          {goal.wish || getPlaceholder(goal.category, "wish")}
        </p>
        <p className="text-xs text-muted-foreground/70 leading-snug">
          The habit name and goal text are permanent and cannot be changed.
        </p>
      </div>

      {/* If-Then Plan */}
      <div className="space-y-1.5">
        <Label
          htmlFor="edit-plan"
          className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
        >
          If-Then Plan
        </Label>
        <div className="flex items-start gap-2">
          <Textarea
            id="edit-plan"
            name="goals-edit-ifthen-plan"
            data-ocid="goals.edit_ifthen_input"
            value={form.ifThenPlan}
            maxLength={140}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) =>
              setForm((f) => ({ ...f, ifThenPlan: e.target.value }))
            }
            onFocus={() => setFocusedField("ifThenPlan")}
            onBlur={() => setFocusedField(null)}
            rows={2}
            placeholder={getPlaceholder(goal.category, "ifThenPlan")}
            className="flex-1 bg-muted/60 border-border focus:border-primary resize-none text-sm font-mono"
          />
          <SuggestionButton
            category={goal.category}
            field="ifThenPlan"
            onSelect={(value) => setForm((f) => ({ ...f, ifThenPlan: value }))}
          />
        </div>
        <p
          className={`text-[10px] text-muted-foreground/60 text-right transition-opacity duration-200 ${focusedField === "ifThenPlan" ? "opacity-100" : "opacity-0"}`}
        >
          {form.ifThenPlan.length}/140
        </p>
      </div>

      {/* Obstacles (read-display) */}
      <div className="space-y-2">
        <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Obstacles
        </Label>
        {/* Preset chips */}
        <div className="flex flex-wrap gap-1.5">
          {OBSTACLE_TEMPLATES.map((template) => {
            const label = template.label;
            const selected = form.obstacles.includes(label);
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => togglePreset(label)}
                data-ocid={`goals.edit_obstacle_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`}
                className="text-xs px-2.5 py-1 rounded-full border transition-smooth"
                style={
                  selected
                    ? {
                        background: "oklch(var(--color-accent-success) / 0.12)",
                        borderColor: "oklch(var(--color-accent-success) / 0.4)",
                        color: "oklch(var(--color-accent-success))",
                      }
                    : {
                        background: "oklch(var(--muted) / 0.4)",
                        borderColor: "oklch(var(--border))",
                        color: "oklch(var(--muted-foreground))",
                      }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        {form.obstacles.length > 0 && (
          <p className="text-[10px] text-muted-foreground/60">
            {form.obstacles.length} obstacle
            {form.obstacles.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Icon picker */}
      <div className="space-y-2">
        <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Icon
        </Label>
        <div className="flex flex-wrap gap-2">
          {EDIT_ICONS.map((icon) => {
            const selected = form.iconName === icon;
            return (
              <button
                key={icon}
                type="button"
                onClick={() => setForm((f) => ({ ...f, iconName: icon }))}
                data-ocid={`goals.edit_icon_${icon}`}
                aria-label={icon}
                className="w-9 h-9 rounded-xl flex items-center justify-center border transition-smooth"
                style={
                  selected
                    ? {
                        background: "oklch(var(--color-accent-success) / 0.15)",
                        borderColor: "oklch(var(--color-accent-success) / 0.5)",
                        color: "oklch(var(--color-accent-success))",
                      }
                    : {
                        background: "oklch(var(--muted) / 0.4)",
                        borderColor: "oklch(var(--border))",
                        color: "oklch(var(--muted-foreground))",
                      }
                }
              >
                {renderGoalIcon(icon, 15)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color picker */}
      <div className="space-y-2">
        <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Color
        </Label>
        <div className="flex flex-wrap gap-2">
          {EDIT_THEME_COLORS.map((c) => {
            const selected = form.themeColor === c.value;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, themeColor: c.value }))}
                aria-label={c.id}
                data-ocid={`goals.edit_color_${c.id}`}
                className="w-7 h-7 rounded-full border-2 transition-smooth"
                style={{
                  background: c.value,
                  borderColor: selected
                    ? "oklch(var(--foreground))"
                    : "transparent",
                  boxShadow: selected ? `0 0 0 2px ${c.value}40` : "none",
                  transform: selected ? "scale(1.15)" : "scale(1)",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Lock-In Mode */}
      <div className="space-y-2">
        <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Lock-In Mode
        </Label>
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "oklch(var(--muted) / 0.3)",
            border: "1px solid oklch(var(--border) / 0.3)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Enable Lock-In Mode
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Strict time block with check-in &amp; check-out
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isLockIn}
              data-ocid="goals.edit_lockin_toggle"
              onClick={() => setForm((f) => ({ ...f, isLockIn: !f.isLockIn }))}
              className="relative shrink-0 w-12 h-6 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                background: form.isLockIn ? "#10B981" : "oklch(var(--muted))",
                boxShadow: form.isLockIn
                  ? "inset 2px 2px 5px rgba(0,0,0,0.3)"
                  : "inset 2px 2px 5px rgba(0,0,0,0.4)",
              }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-300"
                style={{
                  left: form.isLockIn ? "calc(100% - 22px)" : "2px",
                  boxShadow: "1px 1px 3px rgba(0,0,0,0.4)",
                }}
              />
            </button>
          </div>
          {form.isLockIn && (
            <div
              className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs"
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                borderLeft: "3px solid rgba(245, 158, 11, 0.7)",
                boxShadow:
                  "inset 2px 2px 5px rgba(0,0,0,0.25), inset -1px -1px 3px rgba(255,255,255,0.04)",
              }}
              data-ocid="goals.edit_lockin_commitment_banner"
            >
              <span className="shrink-0 mt-0.5 text-sm" aria-hidden="true">
                🔒
              </span>
              <p
                className="leading-snug"
                style={{ color: "rgba(251, 191, 36, 0.9)" }}
              >
                <span className="font-semibold">
                  Lock-In time blocks are a strict commitment.
                </span>{" "}
                You can only change these times outside your active window.
              </p>
            </div>
          )}
          {form.isLockIn && (
            <div className="space-y-3 pt-2 border-t border-border/20">
              {/* Start Time */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-start-time"
                  className="text-xs text-muted-foreground font-mono uppercase"
                >
                  Start Time
                </label>
                <input
                  id="edit-start-time"
                  name="goals-edit-lockin-start-time"
                  type="time"
                  data-ocid="goals.edit_lockin_start_time"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={form.lockInStartTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newEnd = recalcEndTime(
                      val,
                      form.lockInDurationHours,
                      form.lockInDurationMinutes,
                    );
                    setForm((f) => ({
                      ...f,
                      lockInStartTime: val,
                      lockInEndTime: newEnd,
                    }));
                    const conflict = findOverlapGoal(
                      val,
                      newEnd,
                      existingLockInGoals,
                      goal.id,
                    );
                    setOverlapError(
                      conflict
                        ? "Conflict: This time overlaps with an existing Lock-In habit."
                        : null,
                    );
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-sm font-mono text-foreground border border-border/30 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  style={{
                    background: "oklch(var(--card))",
                    boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.35)",
                    colorScheme: "dark",
                  }}
                />
              </div>
              {/* Duration wheels */}
              <div>
                <span className="block text-xs font-mono tracking-widest text-muted-foreground uppercase mb-2">
                  Duration
                </span>
                <div className="flex gap-3">
                  {/* Hours wheel */}
                  <div className="flex-1">
                    <label
                      htmlFor="edit-lockin-hours"
                      className="block text-[11px] text-muted-foreground/60 mb-1.5"
                    >
                      Hours
                    </label>
                    <select
                      id="edit-lockin-hours"
                      data-ocid="goals.edit_lockin_duration_hours"
                      value={form.lockInDurationHours}
                      onChange={(e) => {
                        const h = Number(e.target.value);
                        const newEnd = recalcEndTime(
                          form.lockInStartTime,
                          h,
                          form.lockInDurationMinutes,
                        );
                        setForm((f) => ({
                          ...f,
                          lockInDurationHours: h,
                          lockInEndTime: newEnd,
                        }));
                        const conflict = findOverlapGoal(
                          form.lockInStartTime,
                          newEnd,
                          existingLockInGoals,
                          goal.id,
                        );
                        setOverlapError(
                          conflict
                            ? "Conflict: This time overlaps with an existing Lock-In habit."
                            : null,
                        );
                      }}
                      size={5}
                      className="w-full rounded-xl font-mono text-sm text-center appearance-none cursor-pointer overflow-auto scrollbar-none"
                      style={{
                        background: "oklch(var(--card))",
                        border: "1px solid rgba(245,158,11,0.2)",
                        boxShadow:
                          "inset 2px 2px 5px rgba(0,0,0,0.4), inset -1px -1px 3px rgba(80,80,85,0.12)",
                        color: "oklch(var(--foreground))",
                        padding: "4px 0",
                        outline: "none",
                      }}
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option
                          // biome-ignore lint/suspicious/noArrayIndexKey: hour value is the key, not an index
                          key={h}
                          value={h}
                          style={{
                            background: "oklch(var(--card))",
                            color:
                              form.lockInDurationHours === h
                                ? "#F59E0B"
                                : "oklch(var(--foreground))",
                            fontWeight:
                              form.lockInDurationHours === h ? 700 : 400,
                          }}
                        >
                          {String(h).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Minutes wheel */}
                  <div className="flex-1">
                    <label
                      htmlFor="edit-lockin-minutes"
                      className="block text-[11px] text-muted-foreground/60 mb-1.5"
                    >
                      Min
                    </label>
                    <select
                      id="edit-lockin-minutes"
                      data-ocid="goals.edit_lockin_duration_minutes"
                      value={form.lockInDurationMinutes}
                      onChange={(e) => {
                        const mins = Number(e.target.value);
                        const newEnd = recalcEndTime(
                          form.lockInStartTime,
                          form.lockInDurationHours,
                          mins,
                        );
                        setForm((f) => ({
                          ...f,
                          lockInDurationMinutes: mins,
                          lockInEndTime: newEnd,
                        }));
                        const conflict = findOverlapGoal(
                          form.lockInStartTime,
                          newEnd,
                          existingLockInGoals,
                          goal.id,
                        );
                        setOverlapError(
                          conflict
                            ? "Conflict: This time overlaps with an existing Lock-In habit."
                            : null,
                        );
                      }}
                      size={5}
                      className="w-full rounded-xl font-mono text-sm text-center appearance-none cursor-pointer overflow-auto scrollbar-none"
                      style={{
                        background: "oklch(var(--card))",
                        border: "1px solid rgba(245,158,11,0.2)",
                        boxShadow:
                          "inset 2px 2px 5px rgba(0,0,0,0.4), inset -1px -1px 3px rgba(80,80,85,0.12)",
                        color: "oklch(var(--foreground))",
                        padding: "4px 0",
                        outline: "none",
                      }}
                    >
                      {Array.from({ length: 60 }, (_, m) => (
                        <option
                          // biome-ignore lint/suspicious/noArrayIndexKey: minute value is the key, not an index
                          key={m}
                          value={m}
                          style={{
                            background: "oklch(var(--card))",
                            color:
                              form.lockInDurationMinutes === m
                                ? "#F59E0B"
                                : "oklch(var(--foreground))",
                            fontWeight:
                              form.lockInDurationMinutes === m ? 700 : 400,
                          }}
                        >
                          {String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {isDurationZero && (
                  <p
                    className="text-xs text-destructive mt-2"
                    data-ocid="goals.edit_lockin_duration.field_error"
                  >
                    Duration must be at least 1 minute.
                  </p>
                )}
              </div>
              {/* Computed end time (read-only preview) */}
              {form.lockInStartTime &&
                !isDurationZero &&
                form.lockInEndTime && (
                  <p className="text-xs font-mono text-muted-foreground/70">
                    Ends at{" "}
                    <span style={{ color: "#F59E0B" }}>
                      {formatTime12h(form.lockInEndTime)}
                    </span>
                  </p>
                )}
            </div>
          )}
          {overlapError && (
            <p
              className="text-xs font-medium mt-2"
              style={{ color: "#EF4444" }}
              data-ocid="goals.edit_lockin_overlap.field_error"
            >
              {overlapError}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={
            isSaving ||
            !hasChanges ||
            !form.wish.trim() ||
            !!overlapError ||
            isDurationZero
          }
          className="gap-1.5 button-primary-neon flex-1"
          data-ocid="goals.edit_save_button"
        >
          {isSaving ? (
            <>
              <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={12} />
              Save Changes
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="gap-1.5"
          data-ocid="goals.edit_cancel_button"
        >
          <X size={12} />
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Goal Detail Panel ────────────────────────────────────────────────────────
interface GoalDetailProps {
  goal: HabitPublic;
  onClose: () => void;
  onStateChange: (goalId: bigint, newState: GoalStateType) => void;
  isChangingState: boolean;
  onUpdateGoal: (goalId: bigint, req: UpdateHabitRequest) => void;
  isUpdating: boolean;
  existingLockInGoals?: LockInGoalRef[];
  onEditNavigate: (id: bigint) => void;
}

function GoalDetailPanel({
  goal,
  onClose,
  onStateChange,
  isChangingState,
  onUpdateGoal,
  isUpdating,
  existingLockInGoals = [],
  onEditNavigate,
}: GoalDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLocked, setIsLocked] = useState(() => isLockInActiveWindow(goal));
  const [showLockTooltip, setShowLockTooltip] = useState(false);

  // Recompute lock state every 30 seconds so it updates reactively when the window opens/closes
  useEffect(() => {
    setIsLocked(isLockInActiveWindow(goal));
    const id = setInterval(() => {
      setIsLocked(isLockInActiveWindow(goal));
    }, 30_000);
    return () => clearInterval(id);
  }, [goal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute the window-end label for the tooltip: endTime + 5 min
  const lockWindowEndLabel = goal.endTime
    ? formatTime12h(addMinutesToTime(goal.endTime, 5))
    : "";

  const isActive = goal.state === GoalState.active;
  const isPaused = goal.state === GoalState.paused;
  const isCompleted = goal.state === GoalState.completed;

  function handleSaveEdit(req: UpdateHabitRequest) {
    onUpdateGoal(goal.id, req);
    setIsEditing(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-2xl border border-border/20 bg-card p-5 space-y-4"
      style={{
        boxShadow:
          "-5px -5px 14px rgba(65,65,75,0.5), 8px 8px 22px rgba(0,0,0,0.88)",
        borderTop: "1px solid rgba(255,255,255,0.12)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
      data-ocid="goals.detail_panel"
    >
      {/* Header — Keystone Habit first (prominent), Macro Goal below (secondary) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {goal.wishDescription && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1">
                Keystone Habit
              </p>
              <h3 className="font-display text-xl font-bold text-foreground leading-tight mb-2">
                {goal.wishDescription}
              </h3>
            </>
          )}
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-0.5">
            Macro Goal
          </p>
          <p className="text-sm text-muted-foreground leading-snug">
            {goal.wish}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isEditing &&
            (isActive || isPaused) &&
            (isLocked ? (
              /* ── Locked Edit Button ───────────────────────────────────────── */
              <div className="relative">
                <button
                  type="button"
                  disabled
                  aria-label="Edit locked — Lock-In window is active"
                  data-ocid="goals.detail_edit_button"
                  onMouseEnter={() => setShowLockTooltip(true)}
                  onMouseLeave={() => setShowLockTooltip(false)}
                  onFocus={() => setShowLockTooltip(true)}
                  onBlur={() => setShowLockTooltip(false)}
                  onClick={() => {
                    toast.warning(
                      `🔒 Locked: You cannot edit a Lock-In habit while it is in progress. Window ends at ${lockWindowEndLabel}.`,
                      { duration: 5000 },
                    );
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-smooth"
                  style={{
                    background: "oklch(var(--muted) / 0.25)",
                    color: "oklch(var(--muted-foreground) / 0.45)",
                    cursor: "not-allowed",
                    opacity: 0.6,
                    boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.35)",
                  }}
                >
                  <Lock size={12} />
                </button>
                {/* CSS tooltip — visible on hover/focus */}
                {showLockTooltip && (
                  <div
                    role="tooltip"
                    className="absolute right-0 bottom-full mb-2 z-50 w-64 rounded-xl px-3 py-2.5 text-xs leading-relaxed pointer-events-none"
                    style={{
                      background: "oklch(var(--card))",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow:
                        "-3px -3px 10px rgba(60,60,70,0.4), 5px 5px 16px rgba(0,0,0,0.75)",
                      color: "oklch(var(--foreground) / 0.85)",
                    }}
                  >
                    🔒 <span className="font-medium">Locked:</span> You cannot
                    edit a Lock-In habit while it is in progress.{" "}
                    <span style={{ color: "#F97316" }}>
                      Window ends at {lockWindowEndLabel}.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* ── Normal Edit Button ───────────────────────────────────────── */
              <button
                type="button"
                onClick={() => onEditNavigate(goal.id)}
                className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-smooth"
                aria-label="Edit goal"
                data-ocid="goals.detail_edit_button"
              >
                <Edit3 size={13} />
              </button>
            ))}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-smooth"
            aria-label="Close detail"
            data-ocid="goals.detail_close_button"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* State badge + dates */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full"
          style={stateBadgeStyle(goal.state)}
        >
          {goal.state === GoalState.active && <Flame size={10} />}
          {goal.state === GoalState.paused && <Pause size={10} />}
          {goal.state === GoalState.completed && <CheckCircle2 size={10} />}
          {stateLabel(goal.state)}
        </span>
        <span className="text-xs text-muted-foreground">
          Created {formatDate(goal.createdAt)}
        </span>
      </div>

      {/* Edit form OR read view */}
      <AnimatePresence mode="wait">
        {isEditing ? (
          <GoalEditForm
            key="edit"
            goal={goal}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
            isSaving={isUpdating}
            existingLockInGoals={existingLockInGoals}
          />
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
            data-ocid="goals.detail_view"
          >
            {goal.outcome && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  Obstacles
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {goal.outcome}
                </p>
              </div>
            )}
            {goal.ifThenPlan && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  If-Then Plan
                </p>
                <p className="text-sm font-mono text-foreground leading-relaxed bg-muted/40 rounded-lg px-3 py-2">
                  {goal.ifThenPlan}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* State actions — hidden while editing */}
      {!isEditing && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
          {isActive && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onStateChange(goal.id, GoalState.paused)}
                disabled={isChangingState}
                className="gap-1.5 text-xs"
                data-ocid="goals.pause_button"
              >
                <Pause size={12} />
                Pause
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onStateChange(goal.id, GoalState.completed)}
                disabled={isChangingState}
                className="gap-1.5 text-xs"
                data-ocid="goals.complete_button"
              >
                <CheckCircle2 size={12} />
                Mark Complete
              </Button>
            </>
          )}
          {isPaused && (
            <Button
              type="button"
              size="sm"
              onClick={() => onStateChange(goal.id, GoalState.active)}
              disabled={isChangingState}
              className="gap-1.5 text-xs button-primary-neon"
              data-ocid="goals.reactivate_button"
            >
              <Play size={12} />
              Reactivate
            </Button>
          )}
          {isCompleted && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onStateChange(goal.id, GoalState.active)}
              disabled={isChangingState}
              className="gap-1.5 text-xs"
              data-ocid="goals.restore_button"
            >
              <Play size={12} />
              Restore as Active
            </Button>
          )}
          {isChangingState && (
            <span
              className="text-xs text-muted-foreground flex items-center gap-1.5"
              data-ocid="goals.state_change_loading_state"
            >
              <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
              Updating…
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Delete confirmation dialog ──────────────────────────────────────────────
//
// Confirms a single-habit hard-delete. Warns the user that deleting the habit
// will also remove all of its check-in history. Confirming triggers the
// atomic hard-delete via useDeleteHabit; canceling closes the dialog with no
// change. The AlertDialogAction calls e.preventDefault() to stop Radix's
// auto-close from racing the mutation — the same root cause that previously
// broke goal deletion (see DeleteGoalDialog in MyGoalsPage.tsx).

interface DeleteHabitDialogProps {
  habit: HabitPublic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (habitId: bigint) => void;
  isDeleting: boolean;
}

function DeleteHabitDialog({
  habit,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteHabitDialogProps) {
  if (!habit) return null;
  const label = habit.wishDescription || habit.wish;

  return (
    <DeleteConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={() => onConfirm(habit.id)}
      isDeleting={isDeleting}
      title="Delete habit permanently?"
      dataOcid="my_habits.delete_dialog"
      description={
        <>
          <p>
            You're about to permanently delete{" "}
            <span className="font-semibold text-foreground">{label}</span>. This
            cannot be undone.
          </p>
          <p
            className="mt-3"
            data-ocid="my_habits.delete_dialog.checkin_warning"
          >
            Deleting this habit will also permanently remove{" "}
            <span className="font-semibold text-foreground">
              all of its check-in history
            </span>
            , including streaks and progress records.
          </p>
        </>
      }
    />
  );
}

// ─── Goals Page ───────────────────────────────────────────────────────────────
export function GoalsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>(GoalState.active);
  const [expandedGoalId, setExpandedGoalId] = useState<bigint | null>(null);
  const [changingStateId, setChangingStateId] = useState<bigint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HabitPublic | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { actor, isFetching } = useBackend();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // listMyGoals() returns GoalWithHabitsPublic[] (macro goals grouped with
  // their linked habits). Flatten the groups into a single habit list so the
  // rest of the page can keep treating each row as a habit-level record.
  const { data: goals = [], isLoading } = useQuery<HabitPublic[]>({
    queryKey: ["myGoals"],
    queryFn: async () => {
      if (!actor || !("listMyGoals" in actor)) return [];
      try {
        const groups = (await actor.listMyGoals()) as GoalWithHabitsPublic[];
        return groups.flatMap((g) => g.habits);
      } catch (err) {
        console.error("[GoalsPage] listMyGoals error:", err);
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });

  const updateStateMutation = useMutation({
    mutationFn: async ({
      goalId,
      newState,
    }: { goalId: bigint; newState: GoalStateType }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateGoalState(goalId, newState);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["myGoals"] });
      toast.success(`Goal ${stateLabel(variables.newState).toLowerCase()}.`);
      setExpandedGoalId(null);
    },
    onError: (err: Error) => {
      console.error("[GoalsPage] updateGoalState error:", err);
      toast.error("Failed to update goal state. Please try again.");
    },
    onSettled: () => {
      setChangingStateId(null);
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({
      goalId,
      req,
    }: { goalId: bigint; req: UpdateHabitRequest }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.updateHabit(goalId, req);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myGoals"] });
      toast.success("Habit updated successfully.");
    },
    onError: (err: Error) => {
      console.error("[GoalsPage] updateHabit error:", err);
      toast.error("Failed to update habit. Please try again.");
    },
  });

  // Hard-delete a single habit via the shared useDeleteHabit hook. The hook
  // invalidates the myGoals, myReusableGoals, myCheckIns, and analytics caches
  // on success, so the deleted habit disappears from the list and its
  // check-in history is cleared everywhere.
  const deleteHabitMutation = useDeleteHabit({
    onSuccess: () => {
      toast.success("Habit deleted permanently.");
    },
    onError: (err: Error) => {
      toast.error(
        err.message?.trim().length > 0
          ? err.message
          : "Failed to delete habit. Please try again.",
      );
    },
    onSettled: () => {
      setDeleteTarget(null);
      setDeleteDialogOpen(false);
    },
  });

  function handleStateChange(goalId: bigint, newState: GoalStateType) {
    setChangingStateId(goalId);
    updateStateMutation.mutate({ goalId, newState });
  }

  function handleUpdateGoal(goalId: bigint, req: UpdateHabitRequest) {
    if (Object.keys(req).length === 0) return;
    updateGoalMutation.mutate({ goalId, req });
  }

  function handleDeleteRequest(habit: HabitPublic) {
    setDeleteTarget(habit);
    setDeleteDialogOpen(true);
  }

  function handleDeleteConfirm(habitId: bigint) {
    deleteHabitMutation.mutate({ habitId });
  }

  // Hard-deleted goals are removed from the backend entirely, so every goal
  // returned by listMyGoals is visible — no client-side filtering needed.
  const visibleGoals = goals;

  const filtered = visibleGoals.filter((g) =>
    activeFilter === "all" ? true : g.state === activeFilter,
  );

  const activeCount = visibleGoals.filter(
    (g) => g.state === GoalState.active,
  ).length;
  const _expandedGoal =
    visibleGoals.find((g) => g.id === expandedGoalId) ?? null;

  return (
    <div className="flex flex-col gap-6 px-4 pb-6">
      {/* Page header */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">
            My Habits
          </h1>
        </div>
        {activeCount > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            <span
              className="font-semibold"
              style={{ color: "oklch(var(--color-accent-success))" }}
            >
              {activeCount}
            </span>{" "}
            active {activeCount === 1 ? "habit" : "habits"} in progress
          </p>
        )}
      </div>

      {/* Filter tabs */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
        data-ocid="goals.filter_tabs"
      >
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? visibleGoals.length
              : visibleGoals.filter((g) => g.state === tab.key).length;
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveFilter(tab.key);
                setExpandedGoalId(null);
              }}
              data-ocid={`goals.filter.${tab.key}`}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-smooth border ${
                isActive
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "bg-muted/30 border-border text-muted-foreground hover:border-primary/20"
              }`}
              style={
                isActive
                  ? { borderColor: "oklch(var(--color-accent-success) / 0.35)" }
                  : undefined
              }
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[10px] font-mono ${
                    isActive ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3" data-ocid="goals.loading_state">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="rounded-2xl bg-card border border-border p-4 animate-pulse"
            >
              <div className="h-3 w-20 rounded-full bg-muted mb-2" />
              <div className="h-5 w-3/4 rounded-full bg-muted mb-1.5" />
              <div className="h-3 w-1/2 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state — no goals at all */}
      {!isLoading && visibleGoals.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl bg-card border border-border/20"
          data-ocid="goals.empty_state"
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
            No habits yet
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
            Your habits will appear here. Create a habit from the dashboard to
            get started.
          </p>
        </motion.div>
      )}

      {/* Filtered empty state */}
      {!isLoading && visibleGoals.length > 0 && filtered.length === 0 && (
        <div
          className="text-center py-10 rounded-2xl bg-card border border-border/20 text-muted-foreground text-sm"
          data-ocid="goals.filter_empty_state"
        >
          No{" "}
          {activeFilter !== "all"
            ? stateLabel(activeFilter as GoalStateType).toLowerCase()
            : ""}{" "}
          habits.
        </div>
      )}

      {/* Goal list */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3" data-ocid="goals.goal_list">
          <AnimatePresence>
            {filtered.map((goal, index) => {
              const isExpanded = expandedGoalId === goal.id;
              return (
                <div key={String(goal.id)}>
                  <GoalCardShell
                    accent={goal.isLockIn ? "#F59E0B" : "#10B981"}
                    index={index}
                    dataOcid={`goals.goal_item.${index + 1}`}
                    onDelete={() => handleDeleteRequest(goal)}
                    deleteLabel={`Delete habit ${goal.wishDescription || goal.wish}`}
                    deleteDataOcid={`my_habits.delete_button.${index + 1}`}
                    className={`w-full text-left border transition-smooth ${
                      isExpanded
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/20 bg-card hover:border-primary/20"
                    }`}
                    actions={
                      <Edit3
                        size={14}
                        className={`transition-smooth ${
                          isExpanded ? "text-primary" : ""
                        }`}
                      />
                    }
                  >
                    {/* Clickable region — toggles expand/collapse. Kept as a
                        button so the card stays keyboard-accessible while the
                        sibling delete button handles its own click. */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGoalId((prev) =>
                          prev === goal.id ? null : goal.id,
                        )
                      }
                      aria-expanded={isExpanded}
                      aria-label={`${goal.wishDescription || goal.wish} — ${isExpanded ? "collapse" : "expand"}`}
                      className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
                          style={stateBadgeStyle(goal.state)}
                        >
                          {goal.state === GoalState.active && (
                            <Flame size={8} />
                          )}
                          {goal.state === GoalState.paused && (
                            <Pause size={8} />
                          )}
                          {goal.state === GoalState.completed && (
                            <CheckCircle2 size={8} />
                          )}
                          {stateLabel(goal.state)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono flex items-center gap-0.5">
                          <Clock size={8} />
                          {formatDate(goal.createdAt)}
                        </span>
                      </div>
                      <h3 className="font-display font-semibold text-foreground leading-tight line-clamp-1 flex items-center gap-2">
                        {goal.wishDescription || goal.wish}
                        {goal.isLockIn && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Lock-In
                          </span>
                        )}
                      </h3>
                      {goal.outcome && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
                          So that I can {goal.outcome}
                        </p>
                      )}
                    </button>
                  </GoalCardShell>
                  {isExpanded && (
                    <motion.div
                      key={`detail-${goal.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                      className="mx-2 mb-3 rounded-2xl"
                    >
                      <GoalDetailPanel
                        goal={goal}
                        onClose={() => setExpandedGoalId(null)}
                        onStateChange={handleStateChange}
                        isChangingState={
                          changingStateId === goal.id &&
                          updateStateMutation.isPending
                        }
                        onUpdateGoal={handleUpdateGoal}
                        isUpdating={updateGoalMutation.isPending}
                        existingLockInGoals={visibleGoals
                          .filter(
                            (g) =>
                              g.isLockIn &&
                              g.startTime &&
                              g.endTime &&
                              g.state === GoalState.active,
                          )
                          .map((g) => ({
                            id: g.id,
                            startTime: g.startTime,
                            endTime: g.endTime,
                            wishDescription: g.wishDescription,
                          }))}
                        onEditNavigate={(id) =>
                          navigate({
                            to: "/edit-habit/$id",
                            params: { id: String(id) },
                          })
                        }
                      />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation dialog — mirrors DeleteGoalDialog render in
          MyGoalsPage.tsx. onOpenChange clears deleteTarget when closed so a
          stale reference doesn't linger after the dialog dismisses. */}
      <DeleteHabitDialog
        habit={deleteTarget}
        open={deleteDialogOpen}
        onOpenChange={(next) => {
          setDeleteDialogOpen(next);
          if (!next) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteHabitMutation.isPending}
      />
    </div>
  );
}
