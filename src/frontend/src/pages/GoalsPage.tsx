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
import { useRef, useState } from "react";
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

// ─── Edit Form ────────────────────────────────────────────────────────────────
interface EditFormData {
  wish: string;
  wishDescription: string;
  ifThenPlan: string;
  iconName: string;
  themeColor: string;
  obstacles: string[];
  customObstacleInput: string;
  customObstacles: string[];
}

interface GoalEditFormProps {
  goal: GoalPublic;
  onSave: (req: UpdateGoalRequest) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function GoalEditForm({ goal, onSave, onCancel, isSaving }: GoalEditFormProps) {
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

  const [form, setForm] = useState<EditFormData>({
    wish: goal.wish,
    wishDescription: goal.wishDescription,
    ifThenPlan: goal.ifThenPlan,
    iconName: goal.iconName ?? "target",
    themeColor: goal.themeColor ?? "#2563EB",
    obstacles: existingPreset,
    customObstacleInput: "",
    customObstacles: existingCustom,
  });

  const customInputRef = useRef<HTMLInputElement>(null);

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
    onSave(req);
  }

  const all = allObstacles();
  const hasChanges =
    form.wish.trim() !== goal.wish ||
    form.wishDescription.trim() !== goal.wishDescription ||
    form.ifThenPlan.trim() !== goal.ifThenPlan ||
    form.iconName !== (goal.iconName ?? "target") ||
    form.themeColor !== (goal.themeColor ?? "#2563EB");

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
          rows={2}
          placeholder="Every day, I will…"
          className="bg-muted/60 border-border focus:border-primary resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground/60 text-right">
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
          className="bg-muted/60 border-border focus:border-primary text-sm"
        />
        <p className="text-[10px] text-muted-foreground/60 text-right">
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
          rows={2}
          placeholder="If [obstacle], then I will…"
          className="bg-muted/60 border-border focus:border-primary resize-none text-sm font-mono"
        />
        <p className="text-[10px] text-muted-foreground/60 text-right">
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

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !hasChanges || !form.wish.trim()}
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
}: GoalDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
            {!isEditing && (isActive || isPaused) && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-smooth"
                aria-label="Edit goal"
                data-ocid="goals.detail_edit_button"
              >
                <Edit3 size={13} />
              </button>
            )}
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
