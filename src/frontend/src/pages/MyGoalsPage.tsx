import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Flame,
  MoreHorizontal,
  Pause,
  Play,
  Target,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { GoalState } from "../backend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useBackend, useDeleteGoal } from "../hooks/useBackend";
import {
  CATEGORY_DETAILS,
  type GoalCategory,
  type GoalState as GoalStateType,
  type GoalWithHabitsPublic,
  type HabitPublic,
  type MacroGoalPublic,
} from "../types";
import { GOAL_ICONS } from "../utils/goalIcons";

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

function stateIcon(state: GoalStateType, size = 10) {
  switch (state) {
    case GoalState.active:
      return <Flame size={size} />;
    case GoalState.paused:
      return <Pause size={size} />;
    case GoalState.completed:
      return <CheckCircle2 size={size} />;
    default:
      return null;
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

function categoryDetail(category: GoalCategory) {
  return CATEGORY_DETAILS.find((c) => c.id === category) ?? CATEGORY_DETAILS[0];
}

function goalIconSvg(name: string | undefined) {
  if (!name) return null;
  const found = GOAL_ICONS.find((i) => i.id === name);
  return found ? found.svg : null;
}

type FilterTab = "all" | GoalStateType;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: GoalState.active, label: "Active" },
  { key: GoalState.paused, label: "Paused" },
  { key: GoalState.completed, label: "Completed" },
];

// ─── State change menu ────────────────────────────────────────────────────────
//
// Lightweight accessible menu built from a button + popover. No shadcn
// dropdown-menu component is installed in this project, so we render a
// minimal focus-managed menu using a ref + outside-click + Escape handling.
// Each action transitions the goal to a new state via updateGoalState.

interface StateMenuProps {
  goal: MacroGoalPublic;
  onStateChange: (newState: GoalStateType) => void;
  pending: boolean;
}

function StateMenu({ goal, onStateChange, pending }: StateMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = goal.state === GoalState.active;
  const isPaused = goal.state === GoalState.paused;
  const isCompleted = goal.state === GoalState.completed;

  // Build the available state transitions. Hard-delete is handled by a
  // dedicated delete button + confirmation dialog, NOT through this menu.
  const actions: {
    state: GoalStateType;
    label: string;
    icon: React.ReactNode;
  }[] = [];
  if (!isActive)
    actions.push({
      state: GoalState.active,
      label: "Set Active",
      icon: <Play size={13} />,
    });
  if (!isPaused)
    actions.push({
      state: GoalState.paused,
      label: "Pause",
      icon: <Pause size={13} />,
    });
  if (!isCompleted)
    actions.push({
      state: GoalState.completed,
      label: "Mark Completed",
      icon: <CheckCircle2 size={13} />,
    });

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        id={buttonId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Change state of goal ${goal.wish}`}
        data-ocid="my_goals.state_menu_button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-smooth disabled:opacity-50"
      >
        {pending ? (
          <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
        ) : (
          <MoreHorizontal size={14} />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            id={menuId}
            aria-labelledby={buttonId}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl py-1.5"
            style={{
              background: "oklch(var(--card))",
              border: "1px solid oklch(var(--border))",
              boxShadow:
                "-4px -4px 10px rgba(70,70,80,0.45), 6px 6px 16px rgba(0,0,0,0.85)",
            }}
            data-ocid="my_goals.state_menu"
          >
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                data-ocid={`my_goals.state_change.${a.state}`}
                onClick={() => {
                  setOpen(false);
                  onStateChange(a.state);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-smooth"
                style={{
                  color: "oklch(var(--foreground))",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "oklch(var(--muted) / 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Delete confirmation dialog ──────────────────────────────────────────────
//
// Lists the habits that will be hard-deleted alongside the parent macro goal.
// When the goal has zero habits, states the goal has no habits and will be
// permanently deleted. Confirming triggers the atomic hard-delete via
// useDeleteGoal; canceling closes the dialog with no change.

interface DeleteGoalDialogProps {
  group: GoalWithHabitsPublic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (goalId: bigint) => void;
  isDeleting: boolean;
}

function DeleteGoalDialog({
  group,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteGoalDialogProps) {
  if (!group) return null;
  const { goal } = group;
  if (!goal) return null;
  // habits can come back undefined at runtime (e.g. a goal hard-deleted while
  // its habits still exist). Fall back to an empty array so habits.length is
  // treated as 0 instead of throwing "reading 'length'".
  const habits = group.habits ?? [];
  const hasHabits = habits.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        data-ocid="my_goals.delete_dialog"
        className="max-w-md"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-foreground flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-full"
              style={{
                backgroundColor: "oklch(var(--destructive) / 0.12)",
                color: "oklch(var(--destructive))",
              }}
            >
              <Trash2 size={16} />
            </span>
            Delete goal permanently?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-muted-foreground text-sm leading-relaxed">
              <p>
                You're about to permanently delete{" "}
                <span className="font-semibold text-foreground">
                  {goal.wish}
                </span>
                . This cannot be undone.
              </p>
              {hasHabits ? (
                <div className="mt-3">
                  <p className="mb-2">
                    The following{" "}
                    {habits.length === 1 ? "habit" : `${habits.length} habits`}{" "}
                    will also be permanently deleted:
                  </p>
                  <ul
                    className="space-y-1.5 max-h-44 overflow-y-auto pr-1"
                    data-ocid="my_goals.delete_dialog.habit_list"
                  >
                    {habits.map((habit, i) => (
                      <HabitListItem
                        key={String(habit.id)}
                        habit={habit}
                        index={i}
                      />
                    ))}
                  </ul>
                </div>
              ) : (
                <p
                  className="mt-3"
                  data-ocid="my_goals.delete_dialog.no_habits"
                >
                  This goal has no habits and will be permanently deleted.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            data-ocid="my_goals.delete_dialog.cancel_button"
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            data-ocid="my_goals.delete_dialog.confirm_button"
            disabled={isDeleting}
            // Mirror the working DeleteHabitDialog in GoalsPage.tsx: use
            // onClick (not onSelect, which is the DOM 'select' event and never
            // fires on a button click) with e.preventDefault() so the delete
            // mutation actually runs. The hook's onSettled closes the dialog
            // after the delete settles — on success OR error — so a failed
            // delete stays visible (toast).
            onClick={(e) => {
              e.preventDefault();
              onConfirm(goal.id);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                Deleting…
              </span>
            ) : (
              "Delete permanently"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function HabitListItem({
  habit,
  index,
}: { habit: HabitPublic; index: number }) {
  const label = habit.wishDescription || habit.ifThenPlan || habit.wish;
  return (
    <li
      data-ocid={`my_goals.delete_dialog.habit_item.${index + 1}`}
      className="flex items-start gap-2 rounded-md px-2.5 py-2"
      style={{
        backgroundColor: "oklch(var(--muted) / 0.35)",
        border: "1px solid oklch(var(--border) / 0.4)",
      }}
    >
      <span
        className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-mono"
        style={{
          backgroundColor: "oklch(var(--destructive) / 0.12)",
          color: "oklch(var(--destructive))",
        }}
        aria-hidden="true"
      >
        {index + 1}
      </span>
      <span className="min-w-0 text-foreground text-sm leading-snug line-clamp-2">
        {label}
      </span>
    </li>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: MacroGoalPublic;
  habitCount: number;
  index: number;
  onStateChange: (newState: GoalStateType) => void;
  isChangingState: boolean;
  onDelete: () => void;
}

function GoalCard({
  goal,
  habitCount,
  index,
  onStateChange,
  isChangingState,
  onDelete,
}: GoalCardProps) {
  const cat = categoryDetail(goal.category);
  const CatIcon = cat.icon;
  const iconSvg = goalIconSvg(goal.iconName);
  const accent = goal.themeColor ?? "oklch(var(--color-accent-success))";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="rounded-2xl p-4 card-neumorphic"
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: accent,
      }}
      data-ocid={`my_goals.goal_card.${index + 1}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* State badge + date */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={stateBadgeStyle(goal.state)}
            >
              {stateIcon(goal.state, 8)}
              {stateLabel(goal.state)}
            </span>
            <span className="text-[10px] text-muted-foreground/60 font-mono flex items-center gap-0.5">
              <Clock size={8} />
              {formatDate(goal.createdAt)}
            </span>
          </div>

          {/* Title — the wish */}
          <h3 className="font-display font-semibold text-foreground leading-tight line-clamp-2 flex items-start gap-2">
            {iconSvg ? (
              <span
                className="shrink-0 mt-0.5 w-4 h-4"
                style={{ color: accent }}
                aria-hidden="true"
              >
                {iconSvg}
              </span>
            ) : null}
            <span className="min-w-0">{goal.wish}</span>
          </h3>

          {/* Subtitle — the outcome (wishDescription is the keystone habit name) */}
          {goal.outcome && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {goal.outcome}
            </p>
          )}

          {/* Category badge + habit count */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "oklch(var(--muted) / 0.5)",
                color: "oklch(var(--muted-foreground))",
                border: "1px solid oklch(var(--border) / 0.4)",
              }}
            >
              <CatIcon size={9} />
              {cat.title}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "oklch(var(--color-accent-success) / 0.08)",
                color: "oklch(var(--color-accent-success))",
                border: "1px solid oklch(var(--color-accent-success) / 0.2)",
              }}
            >
              <Target size={9} />
              {habitCount} {habitCount === 1 ? "habit" : "habits"}
            </span>
          </div>
        </div>

        {/* State change menu + delete button */}
        <div className="shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Delete goal ${goal.wish}`}
            data-ocid={`my_goals.delete_button.${index + 1}`}
            onClick={onDelete}
            className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground transition-smooth hover:text-foreground"
            style={
              {
                // Destructive tint on hover so the delete affordance reads as dangerous
              }
            }
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "oklch(var(--destructive) / 0.15)";
              e.currentTarget.style.color = "oklch(var(--destructive))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "oklch(var(--muted) / 0.4)";
              e.currentTarget.style.color = "oklch(var(--muted-foreground))";
            }}
          >
            <Trash2 size={14} />
          </button>
          <StateMenu
            goal={goal}
            onStateChange={onStateChange}
            pending={isChangingState}
          />
        </div>
      </div>
    </motion.article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyGoalsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [changingStateId, setChangingStateId] = useState<bigint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalWithHabitsPublic | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { actor, isFetching } = useBackend();
  const queryClient = useQueryClient();

  // listMyGoals() returns GoalWithHabitsPublic[] — macro goals grouped with
  // their linked habits. We keep the groups intact so each card can show the
  // habit count (habits.length) alongside the macro goal (group.goal), and so
  // the delete dialog can list the affected habits.
  const { data: groups = [], isLoading } = useQuery<GoalWithHabitsPublic[]>({
    queryKey: ["myGoals"],
    queryFn: async () => {
      if (!actor || !("listMyGoals" in actor)) return [];
      try {
        return (await actor.listMyGoals()) as GoalWithHabitsPublic[];
      } catch (err) {
        console.error("[MyGoalsPage] listMyGoals error:", err);
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
    },
    onError: (err: Error) => {
      console.error("[MyGoalsPage] updateGoalState error:", err);
      toast.error("Failed to update goal state. Please try again.");
    },
    onSettled: () => {
      setChangingStateId(null);
    },
  });

  // Hard-delete via the shared useDeleteGoal hook. The hook invalidates the
  // myGoals and myReusableGoals caches on success, so every surface that lists
  // goals refetches without the deleted goal — no stale-goal bug.
  const deleteGoalMutation = useDeleteGoal({
    onSuccess: () => {
      toast.success("Goal deleted permanently.");
    },
    onError: (err: Error) => {
      toast.error(
        err.message?.trim().length > 0
          ? err.message
          : "Failed to delete goal. Please try again.",
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

  function handleDeleteRequest(group: GoalWithHabitsPublic) {
    setDeleteTarget(group);
    setDeleteDialogOpen(true);
  }

  function handleDeleteConfirm(goalId: bigint) {
    deleteGoalMutation.mutate({ goalId });
  }

  // Hard-delete means deleted goals are gone entirely — no abandoned-goal
  // filter is needed. The list reflects exactly what the backend returns.
  //
  // Belt-and-suspenders null-guard: the backend type declares `goal` as
  // required, but at runtime a group can come back with `goal: undefined`
  // (e.g. a goal hard-deleted while its habits still exist). Filter those
  // groups out at the point of consumption so downstream rendering never
  // sees a null goal, AND use optional chaining at each access site.
  const safeGroups = groups.filter(
    (g) => g.goal !== undefined && g.habits !== undefined,
  );

  const filtered = safeGroups.filter((g) =>
    activeFilter === "all" ? true : g.goal?.state === activeFilter,
  );

  const activeCount = safeGroups.filter(
    (g) => g.goal?.state === GoalState.active,
  ).length;

  return (
    <div
      className="flex flex-col px-4 pb-6 pt-3"
      style={{ gap: "1.5rem" }}
      data-ocid="my_goals.page"
    >
      {/* Page header */}
      <div className="pt-2" data-ocid="my_goals.header">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">
            My Goals
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Your high-level destinations and the keystone habits that power them.
        </p>
        {activeCount > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            <span
              className="font-semibold"
              style={{ color: "oklch(var(--color-accent-success))" }}
            >
              {activeCount}
            </span>{" "}
            active {activeCount === 1 ? "goal" : "goals"} in progress
          </p>
        )}
      </div>

      {/* Filter tabs */}
      {safeGroups.length > 0 && (
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
          data-ocid="my_goals.filter_tabs"
        >
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? safeGroups.length
                : safeGroups.filter((g) => g.goal?.state === tab.key).length;
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                data-ocid={`my_goals.filter.${tab.key}`}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-smooth border ${
                  isActive
                    ? "bg-primary/10 border-primary/30 text-foreground"
                    : "bg-muted/30 border-border text-muted-foreground hover:border-primary/20"
                }`}
                style={
                  isActive
                    ? {
                        borderColor:
                          "oklch(var(--color-accent-success) / 0.35)",
                      }
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
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3" data-ocid="my_goals.loading_state">
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
      {!isLoading && safeGroups.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl bg-card border border-border/20"
          style={{
            boxShadow:
              "-4px -4px 10px rgba(60,60,65,0.4), 6px 6px 12px rgba(0,0,0,0.8)",
          }}
          data-ocid="my_goals.empty_state"
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
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Your high-level destinations and the keystone habits that power them
            will appear here once you create a goal.
          </p>
        </motion.div>
      )}

      {/* Filtered empty state */}
      {!isLoading && safeGroups.length > 0 && filtered.length === 0 && (
        <div
          className="text-center py-10 rounded-2xl bg-card border border-border/20 text-muted-foreground text-sm"
          data-ocid="my_goals.filter_empty_state"
        >
          No{" "}
          {activeFilter !== "all"
            ? stateLabel(activeFilter as GoalStateType).toLowerCase()
            : ""}{" "}
          goals.
        </div>
      )}

      {/* Goal list */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3" data-ocid="my_goals.goal_list">
          <AnimatePresence>
            {filtered.map((group, index) => {
              // safeGroups already filtered out groups with undefined goal,
              // but guard defensively in case the filter is bypassed.
              if (!group.goal) return null;
              return (
                <GoalCard
                  key={String(group.goal.id)}
                  goal={group.goal}
                  habitCount={(group.habits ?? []).length}
                  index={index}
                  onStateChange={(newState) =>
                    handleStateChange(group.goal!.id, newState)
                  }
                  isChangingState={
                    changingStateId === group.goal.id &&
                    updateStateMutation.isPending
                  }
                  onDelete={() => handleDeleteRequest(group)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <DeleteGoalDialog
        group={deleteTarget}
        open={deleteDialogOpen}
        onOpenChange={(next) => {
          setDeleteDialogOpen(next);
          if (!next) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteGoalMutation.isPending}
      />
    </div>
  );
}
