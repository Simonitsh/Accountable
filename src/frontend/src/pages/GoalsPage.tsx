import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plus,
  Save,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GoalState } from "../backend";
import type {
  GoalPublic,
  GoalState as GoalStateType,
  UpdateGoalRequest,
} from "../backend.d.ts";
import WoopWizard from "../components/WoopWizard";
import { useBackend } from "../hooks/useBackend";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stateLabel(state: GoalStateType): string {
  switch (state) {
    case GoalState.active:
      return "Active";
    case GoalState.completed:
      return "Completed";
    case GoalState.paused:
      return "Paused";
    default:
      return "Unknown";
  }
}

function stateBadgeStyle(state: GoalStateType): React.CSSProperties {
  switch (state) {
    case GoalState.active:
      return {
        backgroundColor: "oklch(var(--color-accent-success) / 0.12)",
        color: "oklch(var(--color-accent-success))",
        border: "1px solid oklch(var(--color-accent-success) / 0.25)",
      };
    case GoalState.completed:
      return {
        backgroundColor: "oklch(var(--color-accent-skip) / 0.12)",
        color: "oklch(var(--color-accent-skip))",
        border: "1px solid oklch(var(--color-accent-skip) / 0.25)",
      };
    case GoalState.paused:
      return {
        backgroundColor: "oklch(var(--color-accent-missed) / 0.12)",
        color: "oklch(var(--color-accent-missed))",
        border: "1px solid oklch(var(--color-accent-missed) / 0.25)",
      };
    default:
      return {};
  }
}

function formatDate(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

const EDIT_OBSTACLE_PRESETS = [
  "Low Energy",
  "Time Crunch",
  "Distraction",
  "Social Pressure",
  "Travel / Change of Routine",
  "Poor Sleep",
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

interface LockInGoalRef {
  id: bigint;
  startTime?: string;
  endTime?: string;
  wishDescription: string;
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
 * Returns false if the goal is not a Lock-In or is missing times.
 */
function isLockInActiveWindow(goal: GoalPublic): boolean {
  if (!goal.isLockIn || !goal.startTime || !goal.endTime) return false;
  const now = Date.now();
  const [sh, sm] = goal.startTime.split(":").map(Number);
  const [eh, em] = goal.endTime.split(":").map(Number);
  const today = new Date();
  const startDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    sh,
    sm,
    0,
    0,
  );
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    eh,
    em,
    0,
    0,
  );
  const windowStart = startDate.getTime() - 5 * 60 * 1000;
  const windowEnd = endDate.getTime() + 5 * 60 * 1000;
  return now >= windowStart && now <= windowEnd;
}

/** Returns the conflicting Lock-In goal name if newStart/newEnd overlaps any existing block. */
function findOverlapGoal(
  newStart: string,
  newEnd: string,
  existing: LockInGoalRef[],
  excludeId?: bigint,
): string | null {
  if (!newStart || !newEnd || newStart >= newEnd) return null;
  for (const g of existing) {
    if (excludeId !== undefined && g.id === excludeId) continue;
    if (!g.startTime || !g.endTime) continue;
    if (newStart < g.endTime && newEnd > g.startTime) {
      return g.wishDescription || "an existing Lock-In";
    }
  }
  return null;
}

// ─── Edit Form ──────────────────────────────────────────────────────────────────
interface EditFormData {
  wish: string;
  wishDescription: string;
  ifThenPlan: string;
  iconName: string;
  themeColor: string;
  obstacles: string[];
  customObstacleInput: string;
  customObstacles: string[];
  isLockIn: boolean;
  lockInStartTime: string;
  lockInEndTime: string;
  lockInDurationHours: number;
  lockInDurationMinutes: number;
}

interface GoalEditFormProps {
  goal: GoalPublic;
  onSave: (req: UpdateGoalRequest) => void;
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

  // Separate into preset vs custom
  const existingPreset = existingObstacles.filter((o) =>
    EDIT_OBSTACLE_PRESETS.map((p) => p.toLowerCase()).includes(o.toLowerCase()),
  );
  const existingCustom = existingObstacles.filter(
    (o) =>
      !EDIT_OBSTACLE_PRESETS.map((p) => p.toLowerCase()).includes(
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
    customObstacleInput: "",
    customObstacles: existingCustom,
    isLockIn: goal.isLockIn ?? false,
    lockInStartTime: goal.startTime ?? "",
    lockInEndTime: goal.endTime ?? "",
    lockInDurationHours: initDuration.hours,
    lockInDurationMinutes: initDuration.minutes,
  });

  const customInputRef = useRef<HTMLInputElement>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [overlapError, setOverlapError] = useState<string | null>(null);

  function allObstacles(): string[] {
    return [...form.obstacles, ...form.customObstacles];
  }

  function togglePreset(label: string) {
    setForm((f) => ({
      ...f,
      obstacles: f.obstacles.includes(label)
        ? f.obstacles.filter((o) => o !== label)
        : [...f.obstacles, label],
    }));
  }

  function addCustomObstacle() {
    const val = form.customObstacleInput.trim();
    if (!val) return;
    const lower = val.toLowerCase();
    const alreadyExists =
      form.customObstacles.some((o) => o.toLowerCase() === lower) ||
      EDIT_OBSTACLE_PRESETS.some((p) => p.toLowerCase() === lower) ||
      form.obstacles.some((o) => o.toLowerCase() === lower);
    if (alreadyExists) return;
    setForm((f) => ({
      ...f,
      customObstacleInput: "",
      customObstacles: [...f.customObstacles, val],
    }));
  }

  function removeCustomObstacle(label: string) {
    setForm((f) => ({
      ...f,
      customObstacles: f.customObstacles.filter((o) => o !== label),
    }));
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
    const req: UpdateGoalRequest = {};
    if (form.wish.trim() !== goal.wish) req.wish = form.wish.trim();
    if (form.wishDescription.trim() !== goal.wishDescription)
      req.wishDescription = form.wishDescription.trim();
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
    onSave(req);
  }

  const all = allObstacles();
  // Duration validation: if Lock-In is enabled, duration must be > 0
  const isDurationZero =
    form.isLockIn &&
    form.lockInDurationHours === 0 &&
    form.lockInDurationMinutes === 0;
  const hasChanges =
    form.wish.trim() !== goal.wish ||
    form.wishDescription.trim() !== goal.wishDescription ||
    form.ifThenPlan.trim() !== goal.ifThenPlan ||
    form.iconName !== (goal.iconName ?? "target") ||
    form.themeColor !== (goal.themeColor ?? "#2563EB") ||
    form.isLockIn !== (goal.isLockIn ?? false) ||
    form.lockInStartTime !== (goal.startTime ?? "") ||
    form.lockInEndTime !== (goal.endTime ?? "");

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
        <Textarea
          id="edit-desc"
          data-ocid="goals.edit_description_input"
          value={form.wishDescription}
          maxLength={140}
          onChange={(e) =>
            setForm((f) => ({ ...f, wishDescription: e.target.value }))
          }
          onFocus={() => setFocusedField("wishDescription")}
          onBlur={() => setFocusedField(null)}
          rows={2}
          placeholder="Every day, I will…"
          className="bg-muted/60 border-border focus:border-primary resize-none text-sm"
        />
        <p
          className={`text-[10px] text-muted-foreground/60 text-right transition-opacity duration-200 ${focusedField === "wishDescription" ? "opacity-100" : "opacity-0"}`}
        >
          {form.wishDescription.length}/140
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
        <Input
          id="edit-wish"
          data-ocid="goals.edit_wish_input"
          value={form.wish}
          maxLength={140}
          onChange={(e) => setForm((f) => ({ ...f, wish: e.target.value }))}
          onFocus={() => setFocusedField("wish")}
          onBlur={() => setFocusedField(null)}
          className="bg-muted/60 border-border focus:border-primary text-sm"
        />
        <p
          className={`text-[10px] text-muted-foreground/60 text-right transition-opacity duration-200 ${focusedField === "wish" ? "opacity-100" : "opacity-0"}`}
        >
          {form.wish.length}/140
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
        <Textarea
          id="edit-plan"
          data-ocid="goals.edit_ifthen_input"
          value={form.ifThenPlan}
          maxLength={140}
          onChange={(e) =>
            setForm((f) => ({ ...f, ifThenPlan: e.target.value }))
          }
          onFocus={() => setFocusedField("ifThenPlan")}
          onBlur={() => setFocusedField(null)}
          rows={2}
          placeholder="If [obstacle], then I will…"
          className="bg-muted/60 border-border focus:border-primary resize-none text-sm font-mono"
        />
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
          {EDIT_OBSTACLE_PRESETS.map((label) => {
            const selected = form.obstacles.includes(label);
            return (
              <button
                key={label}
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
        {/* Custom obstacle chips */}
        {form.customObstacles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.customObstacles.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border"
                style={{
                  background: "oklch(var(--color-accent-skip) / 0.1)",
                  borderColor: "oklch(var(--color-accent-skip) / 0.35)",
                  color: "oklch(var(--color-accent-skip))",
                }}
              >
                {label}
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  onClick={() => removeCustomObstacle(label)}
                  className="ml-0.5 opacity-70 hover:opacity-100 transition-smooth"
                  data-ocid="goals.edit_remove_custom_obstacle"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Custom obstacle input */}
        <div className="flex gap-2">
          <Input
            ref={customInputRef}
            data-ocid="goals.edit_custom_obstacle_input"
            value={form.customObstacleInput}
            maxLength={60}
            placeholder="Add custom obstacle…"
            onChange={(e) =>
              setForm((f) => ({ ...f, customObstacleInput: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomObstacle();
              }
            }}
            className="bg-muted/60 border-border focus:border-primary text-xs h-8 flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addCustomObstacle}
            disabled={!form.customObstacleInput.trim()}
            className="h-8 px-2.5 text-xs gap-1"
            data-ocid="goals.edit_add_custom_obstacle_button"
          >
            <Plus size={11} />
            Add
          </Button>
        </div>
        {all.length > 0 && (
          <p className="text-[10px] text-muted-foreground/60">
            {all.length} obstacle{all.length !== 1 ? "s" : ""} selected
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
                  type="time"
                  data-ocid="goals.edit_lockin_start_time"
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
  goal: GoalPublic;
  onClose: () => void;
  onStateChange: (goalId: bigint, newState: GoalStateType) => void;
  isChangingState: boolean;
  onUpdateGoal: (goalId: bigint, req: UpdateGoalRequest) => void;
  isUpdating: boolean;
  onDeleteGoal: (goalId: bigint) => void;
  isDeleting: boolean;
  existingLockInGoals?: LockInGoalRef[];
}

function GoalDetailPanel({
  goal,
  onClose,
  onStateChange,
  isChangingState,
  onUpdateGoal,
  isUpdating,
  onDeleteGoal,
  isDeleting,
  existingLockInGoals = [],
}: GoalDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  function handleSaveEdit(req: UpdateGoalRequest) {
    onUpdateGoal(goal.id, req);
    setIsEditing(false);
  }

  return (
    <>
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
                  onClick={() => setIsEditing(true)}
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
                  disabled={isChangingState || isDeleting}
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
                  disabled={isChangingState || isDeleting}
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
                disabled={isChangingState || isDeleting}
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
                disabled={isChangingState || isDeleting}
                className="gap-1.5 text-xs"
                data-ocid="goals.restore_button"
              >
                <Play size={12} />
                Restore as Active
              </Button>
            )}
            {/* Delete Goal — available for all states */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isChangingState || isDeleting}
              className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
              data-ocid="goals.delete_button"
            >
              <Trash2 size={12} />
              Delete Goal
            </Button>
            {(isChangingState || isDeleting) && (
              <span
                className="text-xs text-muted-foreground flex items-center gap-1.5"
                data-ocid="goals.state_change_loading_state"
              >
                <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                {isDeleting ? "Deleting…" : "Updating…"}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-ocid="goals.delete_dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              "{goal.wish}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="goals.delete_cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false);
                onDeleteGoal(goal.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="goals.delete_confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Goals Page ───────────────────────────────────────────────────────────────
export function GoalsPage() {
  const [showWoop, setShowWoop] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>(GoalState.active);
  const [selectedGoalId, setSelectedGoalId] = useState<bigint | null>(null);
  const [changingStateId, setChangingStateId] = useState<bigint | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<bigint | null>(null);
  const { actor, isFetching } = useBackend();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: goals = [], isLoading } = useQuery<GoalPublic[]>({
    queryKey: ["myGoals"],
    queryFn: async () => {
      if (!actor || !("listMyGoals" in actor)) return [];
      try {
        return (await actor.listMyGoals()) as GoalPublic[];
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
      setSelectedGoalId(null);
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
    }: { goalId: bigint; req: UpdateGoalRequest }) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.updateGoal(goalId, req);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myGoals"] });
      toast.success("Goal updated successfully.");
    },
    onError: (err: Error) => {
      console.error("[GoalsPage] updateGoal error:", err);
      toast.error("Failed to update goal. Please try again.");
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async ({ goalId }: { goalId: bigint }) => {
      if (!actor) throw new Error("Actor not ready");
      // Backend uses "abandoned" state as deletion; these goals are hidden from the UI
      return actor.updateGoalState(goalId, GoalState.abandoned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myGoals"] });
      toast.success("Goal deleted.");
      setSelectedGoalId(null);
    },
    onError: (err: Error) => {
      console.error("[GoalsPage] deleteGoal error:", err);
      toast.error("Failed to delete goal. Please try again.");
    },
    onSettled: () => {
      setDeletingGoalId(null);
    },
  });

  function handleStateChange(goalId: bigint, newState: GoalStateType) {
    setChangingStateId(goalId);
    updateStateMutation.mutate({ goalId, newState });
  }

  function handleUpdateGoal(goalId: bigint, req: UpdateGoalRequest) {
    if (Object.keys(req).length === 0) return;
    updateGoalMutation.mutate({ goalId, req });
  }

  function handleDeleteGoal(goalId: bigint) {
    setDeletingGoalId(goalId);
    deleteGoalMutation.mutate({ goalId });
  }

  // Exclude abandoned goals from the list entirely
  const visibleGoals = goals.filter((g) => g.state !== GoalState.abandoned);

  const filtered = visibleGoals.filter((g) =>
    activeFilter === "all" ? true : g.state === activeFilter,
  );

  const activeCount = visibleGoals.filter(
    (g) => g.state === GoalState.active,
  ).length;
  const selectedGoal =
    visibleGoals.find((g) => g.id === selectedGoalId) ?? null;

  return (
    <div className="flex flex-col gap-6 px-4 pb-6">
      {/* Page header */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">
            My Habits
          </h1>
          <button
            type="button"
            onClick={() => setShowWoop(true)}
            data-ocid="goals.add_goal_button"
            aria-label="Create a new habit"
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-smooth shrink-0"
            style={{
              background: "#10B981",
              color: "#022c22",
              fontWeight: 500,
              fontFamily: "var(--font-body, inherit)",
              boxShadow:
                "-2px -2px 5px rgba(60,60,65,0.35), 3px 3px 8px rgba(0,0,0,0.65)",
              border: "none",
            }}
          >
            <Plus size={14} />
            Create Habit
          </button>
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
                setSelectedGoalId(null);
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
            Create your first keystone habit using the WOOP framework and start
            building meaningful behavioral change.
          </p>
          <Button
            type="button"
            onClick={() => setShowWoop(true)}
            className="gap-2 button-primary-neon"
            data-ocid="goals.create_first_habit_button"
          >
            <Plus className="w-4 h-4" />
            Create Your First Habit
          </Button>
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
          habits.{" "}
          {activeFilter === GoalState.active && (
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setShowWoop(true)}
              data-ocid="goals.filter_empty_create_button"
            >
              Create one now
            </button>
          )}
        </div>
      )}

      {/* Goal Detail Panel */}
      <AnimatePresence>
        {selectedGoal && (
          <GoalDetailPanel
            key={String(selectedGoal.id)}
            goal={selectedGoal}
            onClose={() => setSelectedGoalId(null)}
            onStateChange={handleStateChange}
            isChangingState={
              changingStateId === selectedGoal.id &&
              updateStateMutation.isPending
            }
            onUpdateGoal={handleUpdateGoal}
            isUpdating={updateGoalMutation.isPending}
            onDeleteGoal={handleDeleteGoal}
            isDeleting={
              deletingGoalId === selectedGoal.id && deleteGoalMutation.isPending
            }
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
          />
        )}
      </AnimatePresence>

      {/* Goal list */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3" data-ocid="goals.goal_list">
          {filtered.map((goal, index) => {
            const isSelected = selectedGoalId === goal.id;
            return (
              <motion.button
                key={String(goal.id)}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.3 }}
                onClick={() => setSelectedGoalId(isSelected ? null : goal.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-smooth card-neumorphic ${
                  isSelected
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/20 bg-card hover:border-primary/20"
                }`}
                data-ocid={`goals.goal_item.${index + 1}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
                        style={stateBadgeStyle(goal.state)}
                      >
                        {goal.state === GoalState.active && <Flame size={8} />}
                        {goal.state === GoalState.paused && <Pause size={8} />}
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
                    <h3 className="font-display font-semibold text-foreground leading-tight line-clamp-1">
                      {goal.wish}
                    </h3>
                    {goal.wishDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
                        {goal.wishDescription}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-muted-foreground">
                    <Edit3
                      size={14}
                      className={`transition-smooth ${
                        isSelected ? "text-primary" : ""
                      }`}
                    />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* WOOP Wizard */}
      <WoopWizard
        open={showWoop}
        onClose={() => setShowWoop(false)}
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
        onGoalCreated={(goalId) => {
          queryClient.invalidateQueries({ queryKey: ["myGoals"] });
          setActiveFilter(GoalState.active);
          // NOTE: Do NOT call setShowWoop(false) here.
          // WoopWizard.handleClose() already calls onClose() which sets showWoop=false.
          // A second setShowWoop(false) here creates a double-close that prevents
          // the wizard's useEffect(open) reset from running cleanly.
          // Store new habit ID so dashboard can highlight it
          if (goalId) {
            try {
              localStorage.setItem("cumulative-new-habit-id", goalId);
            } catch {}
          }
          // Redirect to dashboard
          void navigate({ to: "/" });
        }}
      />
    </div>
  );
}
