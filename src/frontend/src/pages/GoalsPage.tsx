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
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
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

// ─── Edit Form ────────────────────────────────────────────────────────────────
interface EditFormData {
  wish: string;
  wishDescription: string;
  ifThenPlan: string;
}

interface GoalEditFormProps {
  goal: GoalPublic;
  onSave: (req: UpdateGoalRequest) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function GoalEditForm({ goal, onSave, onCancel, isSaving }: GoalEditFormProps) {
  const [form, setForm] = useState<EditFormData>({
    wish: goal.wish,
    wishDescription: goal.wishDescription,
    ifThenPlan: goal.ifThenPlan,
  });

  function handleSave() {
    const req: UpdateGoalRequest = {};
    if (form.wish.trim() !== goal.wish) req.wish = form.wish.trim();
    if (form.wishDescription.trim() !== goal.wishDescription)
      req.wishDescription = form.wishDescription.trim();
    if (form.ifThenPlan.trim() !== goal.ifThenPlan)
      req.ifThenPlan = form.ifThenPlan.trim();
    onSave(req);
  }

  const hasChanges =
    form.wish.trim() !== goal.wish ||
    form.wishDescription.trim() !== goal.wishDescription ||
    form.ifThenPlan.trim() !== goal.ifThenPlan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="space-y-4"
      data-ocid="goals.edit_form"
    >
      <div className="space-y-1.5">
        <Label
          htmlFor="edit-wish"
          className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
        >
          Goal Name
        </Label>
        <Input
          id="edit-wish"
          data-ocid="goals.edit_wish_input"
          value={form.wish}
          onChange={(e) => setForm((f) => ({ ...f, wish: e.target.value }))}
          className="bg-muted/60 border-border focus:border-primary text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="edit-desc"
          className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
        >
          Description
        </Label>
        <Textarea
          id="edit-desc"
          data-ocid="goals.edit_description_input"
          value={form.wishDescription}
          onChange={(e) =>
            setForm((f) => ({ ...f, wishDescription: e.target.value }))
          }
          rows={3}
          className="bg-muted/60 border-border focus:border-primary resize-none text-sm"
        />
      </div>

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
          onChange={(e) =>
            setForm((f) => ({ ...f, ifThenPlan: e.target.value }))
          }
          rows={3}
          className="bg-muted/60 border-border focus:border-primary resize-none text-sm font-mono"
        />
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
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Macro Goal
            </p>
            <h3 className="font-display text-xl font-bold text-foreground leading-tight">
              {goal.wish}
            </h3>
            {goal.wishDescription && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 block mb-0.5">
                  Keystone Habit
                </span>
                {goal.wishDescription}
              </p>
            )}
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
                    Best Outcome
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
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Habit Management
        </p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="font-display text-2xl font-bold text-foreground">
            My Goals
          </h1>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowWoop(true)}
            className="gap-1.5 button-primary-neon shrink-0"
            data-ocid="goals.add_goal_button"
          >
            <Plus size={15} />
            New Goal
          </Button>
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
            No goals yet
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
            Create your first keystone habit using the WOOP framework and start
            building meaningful behavioral change.
          </p>
          <Button
            type="button"
            onClick={() => setShowWoop(true)}
            className="gap-2 button-primary-neon"
            data-ocid="goals.create_first_goal_button"
          >
            <Plus className="w-4 h-4" />
            Create Your First Goal
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
          goals.{" "}
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
        onGoalCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["myGoals"] });
          setActiveFilter(GoalState.active);
          setShowWoop(false);
        }}
      />
    </div>
  );
}
