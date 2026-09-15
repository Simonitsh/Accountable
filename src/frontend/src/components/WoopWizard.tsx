import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Lock, X, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReusableGoalPublic } from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";
import { getPlaceholder } from "../lib/placeholders";
import { OBSTACLE_TEMPLATES, useResolveObstacleLabel } from "../types/index";
import { findOverlapGoal } from "../utils/goalDisplay";
import { DayPickerRow } from "./DayPickerRow";
import ExistingGoalChip from "./ExistingGoalChip";
import SuggestionButton from "./SuggestionButton";

interface WoopWizardProps {
  open: boolean;
  onClose: () => void;
  onGoalCreated?: (goalId?: string) => void;
  /** Existing active Lock-In goals — used for real-time overlap validation */
  existingLockInGoals?: Array<{
    id: bigint;
    startTime?: string;
    endTime?: string;
    wishDescription: string;
  }>;
  /**
   * Reusable goals fetched via listMyReusableGoals() — used for read-only
   * goal reuse in step 2 (Macro Goal). Each chip parses the stored `wish`
   * back into goalAction/goalReason AND fills wishDescription from the
   * referenced goal's wishDescription (the keystone habit name). The
   * goalAction, goalReason, and wishDescription/habit-name fields then
   * become READ-ONLY because the goal is immutable and there is no forking.
   *
   * Distinct from `existingLockInGoals` (which is filtered to active Lock-Ins
   * and used for overlap validation). Parent pages pass this from their
   * `useQuery(['myReusableGoals'])` cache.
   *
   * Typed as `ReusableGoalPublic[]` (the canonical backend type returned by
   * listMyReusableGoals()) so parent pages can pass reusable goals straight
   * from their query cache without any reshape and without falling back to
   * `any`. ReusableGoalPublic carries { id, wish, wishDescription, state }.
   */
  existingGoals?: ReusableGoalPublic[];
  /**
   * True while the parent's reusable-goals query (['myReusableGoals']) is still
   * fetching. When true, the GOAL_STEP renders a loading indicator instead of
   * the 'no goals yet' empty state, so goals are never hidden behind a
   * premature empty state on first open (the query resolves asynchronously
   * AFTER the wizard mounts). Only once this is false AND existingGoals is
   * empty does the true empty state render.
   */
  existingGoalsLoading?: boolean;
  /** ID of the goal being edited — excluded from the overlap check */
  editingGoalId?: bigint;
  /**
   * Optional macro goal ID that pre-scopes the wizard to create a habit
   * inside an existing goal. When provided:
   *   - `selectedGoalId` is initialized to `String(presetGoalId)` so the
   *     wizard treats the macro goal as already-selected (locked).
   *   - The goal-reuse chips in step 2 do NOT render (the user cannot pick
   *     a different goal); instead a locked indicator shows the habit is
   *     being created inside goal `presetGoalId`.
   *   - The macro goal's category is inherited so step 1 auto-advances with
   *     that category selected (the user can still change it).
   *   - The user still fills in habit-specific fields: type (Lock-In toggle),
   *     duration, schedule, obstacle, and if-then plan.
   *   - The macro goal text fields (goalAction/goalReason) are NOT shown
   *     because the goal is already chosen.
   *   - `createHabit` is called with `goalId: toBigInt(presetGoalId)` (or the
   *     reused/selected goal id if the user somehow changed it — but the
   *     locked UI prevents that).
   * Per the user instruction "Create Habit inside goal card opens habit
   * wizard pre-scoped to that goal".
   */
  presetGoalId?: bigint;
}

interface SelectedObstacle {
  id: string;
  label: string;
}

interface FormState {
  // Step 1 — Category
  category: string;
  // Step 2 — Wish + Keystone Habit
  habitAction: string;
  habitMinutes: string;
  // Lock-In
  isLockIn: boolean;
  lockInStartTime: string;
  lockInEndTime: string;
  lockInDurationHours: number;
  lockInDurationMinutes: number;
  // Scheduling
  scheduledDays: string[];
  // Step 3 — Obstacles
  selectedObstacles: SelectedObstacle[];
  // Step 4 — If-Then Plan
  ifThenPlan: string;
  // Step 5 — Color + Review
  themeColor: string;
}

type StepError = Partial<Record<string, string>>;

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

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const EMPTY: FormState = {
  category: "",
  habitAction: "",
  habitMinutes: "",
  isLockIn: false,
  lockInStartTime: "",
  lockInEndTime: "",
  lockInDurationHours: 0,
  lockInDurationMinutes: 0,
  scheduledDays: [...ALL_DAYS],
  selectedObstacles: [],
  ifThenPlan: "",
  themeColor: "#2563EB",
};

/**
 * Returns a FRESH FormState object each call by spreading the EMPTY defaults.
 * Used for every wizard open/reset so two wizard sessions never share the
 * same form object reference — this avoids stale habitAction (and any other
 * field) carrying over from a previously created habit. The EMPTY constant
 * stays the single source of defaults; the factory just produces a new
 * shallow copy per invocation.
 */
const getEmptyForm = (): FormState => ({ ...EMPTY });

function parseHHMMToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Defensive BigInt coercion for goal ids. BigInt() throws when the value is
 * already a bigint, and BigInt(null) throws too — both crash the wizard when
 * editing a habit (presetGoalId arrives as bigint from the backend) or when
 * selectedGoalId is somehow null at submit time. This helper:
 *  (a) returns the value unchanged when typeof value === 'bigint',
 *  (b) returns undefined when the value is null or undefined,
 *  (c) otherwise calls BigInt(value).
 * Callers must still guard against undefined when a value is required.
 */
function toBigInt(
  value: bigint | string | number | null | undefined,
): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (value === null || value === undefined) return undefined;
  return BigInt(value);
}

export default function WoopWizard({
  open,
  onClose,
  onGoalCreated,
  existingLockInGoals = [],
  existingGoals = [],
  existingGoalsLoading = false,
  editingGoalId,
  presetGoalId,
}: WoopWizardProps) {
  const [step, setStep] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<"fwd" | "bwd">("fwd");
  const [mounted, setMounted] = useState(false);
  const [errors, setErrors] = useState<StepError>({});
  const [form, setForm] = useState<FormState>(EMPTY);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  /**
   * ID of the goal currently reused in step 2 (Macro Goal). Null means no goal
   * is reused and the chip list is visible. Reset on every wizard open so a
   * previous session's selection never leaks into a new one.
   */
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  /**
   * In-component "Discard changes?" confirmation overlay state. Set to true
   * when the user presses the red X exit button (or Escape) AND the form is
   * dirty (isDirty). The overlay is rendered inside the wizard dialog (NOT
   * the route-based UnsavedChangesDialog, which uses TanStack Router
   * useBlocker and is unsuitable for a modal). "Discard" calls the existing
   * reset + onClose flow; "Keep editing" dismisses the overlay.
   */
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { actor } = useBackend();
  const queryClient = useQueryClient();
  // Resolves a built-in obstacle label to a real, reusable obstacle template
  // id (find-or-create). The first pick creates the record; later picks of the
  // same label reuse the same template id instead of creating a duplicate.
  const resolveObstacleLabel = useResolveObstacleLabel();

  // ── Dynamic step model ─────────────────────────────────────────────────────
  // The step layout depends on ONE flag: hasPreset. When the wizard is opened
  // WITH a preset goal, the GOAL_STEP (goal selection) is skipped because the
  // goal is already locked. The wizard always creates a habit inside an
  // existing goal, so the sequence is:
  //   no preset: GOAL → WISH → OBSTACLE → PLAN → REVIEW
  //   preset:    WISH → OBSTACLE → PLAN → REVIEW
  // All downstream step references use these constants so the rest of the
  // wizard behaves identically across both layouts.
  const hasPreset = presetGoalId !== undefined && presetGoalId !== null;
  const showGoalStep = !hasPreset;
  // Build the ordered list of step ids, then derive each named step constant
  // from its position so the rest of the wizard can reference them by name.
  const stepSequence = useMemo(() => {
    const seq: string[] = [];
    if (showGoalStep) seq.push("GOAL");
    seq.push("WISH", "OBSTACLE", "PLAN", "REVIEW");
    return seq;
  }, [showGoalStep]);
  const stepIndex = useMemo(() => {
    const m: Record<string, number> = {};
    stepSequence.forEach((name, i) => {
      m[name] = i + 1;
    });
    return m;
  }, [stepSequence]);
  const GOAL_STEP = stepIndex.GOAL ?? -1;
  const WISH_STEP = stepIndex.WISH;
  const OBSTACLE_STEP = stepIndex.OBSTACLE;
  const PLAN_STEP = stepIndex.PLAN;
  const REVIEW_STEP = stepIndex.REVIEW;
  const steps = useMemo(() => {
    const labelFor = (name: string): string => {
      switch (name) {
        case "GOAL":
          return "Goal";
        case "WISH":
          return "Wish";
        case "OBSTACLE":
          return "Obstacle";
        case "PLAN":
          return "Plan";
        case "REVIEW":
          return "Review";
        default:
          return name;
      }
    };
    return stepSequence.map((name, i) => ({
      id: i + 1,
      label: labelFor(name),
    }));
  }, [stepSequence]);
  const totalSteps = steps.length;

  // Slide-up entrance animation + full reset on open.
  //
  // This effect runs EXACTLY ONCE per wizard open: its dependency array is
  // [open, presetGoalId] ONLY. It deliberately does NOT depend on
  // existingGoals, because existingGoals is sourced from an async React Query
  // (['myReusableGoals']) that resolves AFTER the wizard mounts. Listing it
  // here caused this effect to re-fire when the query resolved, which
  // (a) disrupted the dialog entrance transition so the first tap on a goal
  // chip missed (Bug 1), and (b) re-clobbered form state with setForm(EMPTY)
  // at unexpected times, racing with the preset-goal category fill and
  // letting stale habitAction persist across sessions (Bug 2).
  //
  // The async preset-goal category fill (which DOES need existingGoals) lives
  // in a separate effect below.
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    // Full reset every time the wizard opens so custom obstacles never leak
    // between sessions. Use a FRESH empty form each open (not the shared EMPTY
    // reference) so two wizard sessions never share form object identity —
    // this is what stops a previously created habit's name from carrying over.
    setForm(getEmptyForm());
    setStep(1);
    setErrors({});
    // Reset the reused-goal selection so a previous session's chip pick never
    // leaks into a new one. Placed AFTER the form reset above so the
    // empty-state reset fires first, then the goal-reuse state is cleared on
    // top.
    setSelectedGoalId(null);
    // When presetGoalId is provided, lock selectedGoalId to the preset
    // immediately so step 2 hides the chips + macro inputs and shows the
    // locked indicator. The preset goal's CATEGORY fill is deferred to the
    // second effect below (it needs existingGoals, which may not be loaded
    // yet). Per the user instruction "Create Habit inside goal card opens
    // habit wizard pre-scoped to that goal".
    if (presetGoalId !== undefined && presetGoalId !== null) {
      setSelectedGoalId(String(presetGoalId));
    }
    // Tiny delay lets the browser paint the initial off-screen position first
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [open, presetGoalId]);

  // Preset-goal category fill — the async half of the old open effect.
  //
  // Depends on [open, presetGoalId, existingGoals] and ONLY fills the preset
  // goal's category once the goals list has loaded. It must NOT call
  // setForm(getEmptyForm()), setStep, setSelectedGoalId(null), or
  // setGoalFillKey — those belong to the one-time open reset above, and
  // re-running them here would re-introduce both bugs. It uses the functional
  // setForm spread so it only touches `category` and preserves any habit name
  // or other field the user may have already entered before the query
  // resolved.
  useEffect(() => {
    if (!open) return;
    if (presetGoalId === undefined || presetGoalId === null) return;
    const presetGoal = existingGoals.find((g) => g.id === presetGoalId);
    if (presetGoal) {
      setForm((f) => ({ ...f, category: presetGoal.category }));
    }
  }, [open, presetGoalId, existingGoals]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  /**
   * The preset goal object (looked up in existingGoals by Number(id) match)
   * when presetGoalId is provided. Used to render the locked indicator in
   * step 2 — shows the preset goal's wish text read-only so the user sees
   * which goal their new habit is being created inside. Undefined when no
   * presetGoalId is set or when the goal isn't found in existingGoals.
   */
  const presetGoal =
    presetGoalId !== undefined && presetGoalId !== null
      ? existingGoals.find((g) => g.id === presetGoalId)
      : undefined;
  const effectiveHabitMinutes = form.isLockIn
    ? form.lockInDurationHours * 60 + form.lockInDurationMinutes
    : Number(form.habitMinutes) || 0;
  const assembledHabit =
    form.habitAction.trim() && effectiveHabitMinutes > 0
      ? `I will ${form.habitAction.trim()} for ${effectiveHabitMinutes} minutes`
      : "";

  // Calculate max allowed Lock-In minutes based on start time (cutoff 23:55 = 1435 min)
  const maxLockInMinutes = useMemo(() => {
    if (!form.lockInStartTime) return 0;
    const [h, m] = form.lockInStartTime.split(":").map(Number);
    const startTotal = h * 60 + m;
    return Math.max(0, 1435 - startTotal);
  }, [form.lockInStartTime]);

  // Derived caps for the wheels
  const maxLockInHours = Math.floor(maxLockInMinutes / 60);

  const maxLockInMinutesAtMaxHour =
    form.lockInDurationHours === maxLockInHours
      ? Math.floor((maxLockInMinutes % 60) / 5) * 5
      : 55;

  // Auto-calculate lockInEndTime from startTime + duration; also clamp duration to max
  useEffect(() => {
    if (form.lockInStartTime) {
      const [h, m] = form.lockInStartTime.split(":").map(Number);
      const startTotal = h * 60 + m;
      const maxMins = Math.max(0, 1435 - startTotal);
      const currentDuration =
        (form.lockInDurationHours || 0) * 60 +
        (form.lockInDurationMinutes || 0);

      // Clamp duration if it exceeds the new max
      if (currentDuration > maxMins) {
        const clampedHours = Math.floor(maxMins / 60);
        const clampedMinutes = Math.floor((maxMins % 60) / 5) * 5;
        setForm((prev) => ({
          ...prev,
          lockInDurationHours: clampedHours,
          lockInDurationMinutes: clampedMinutes,
          lockInEndTime: `${String(h + (Math.floor((m + maxMins) / 60) % 24)).padStart(2, "0")}:${String((m + maxMins) % 60).padStart(2, "0")}`,
        }));
        return;
      }

      const totalMinutes = startTotal + currentDuration;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      setForm((prev) => ({
        ...prev,
        lockInEndTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      }));
    }
  }, [
    form.lockInStartTime,
    form.lockInDurationHours,
    form.lockInDurationMinutes,
  ]);

  // Continuous overlap watcher — runs on every start-time or end-time change
  useEffect(() => {
    if (!form.isLockIn || !form.lockInStartTime) {
      setOverlapError(null);
      return;
    }
    const newDurationMinutes =
      (form.lockInDurationHours || 0) * 60 + (form.lockInDurationMinutes || 0);
    // For a point-in-time check (duration still 0), pass startTime for both args
    const endTimeArg =
      newDurationMinutes === 0 ? form.lockInStartTime : form.lockInEndTime;
    const conflict = findOverlapGoal(
      existingLockInGoals,
      form.lockInStartTime,
      endTimeArg,
      editingGoalId,
    );
    setOverlapError(
      conflict ? `Conflict: This overlaps with ${conflict}.` : null,
    );
  }, [
    form.isLockIn,
    form.lockInStartTime,
    form.lockInEndTime,
    form.lockInDurationHours,
    form.lockInDurationMinutes,
    existingLockInGoals,
    editingGoalId,
  ]);
  const primaryObstacle = form.selectedObstacles[0]?.label ?? "";

  const createGoalMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready — please wait and retry.");

      // Resolve the primary obstacle to a real, reusable obstacle template id
      // so the habit links to a persisted ObstacleTemplate record instead of
      // storing the builtin label only as text in goal.outcome. Obstacles are
      // locked to the seven built-in OBSTACLE_TEMPLATES, so every selection
      // resolves via useResolveObstacleLabel (find-or-create — the first pick
      // creates the record, later picks of the same label reuse the same id).
      const primaryObs = form.selectedObstacles[0];
      let obstacleTemplateId: bigint | undefined;
      if (primaryObs) {
        obstacleTemplateId = await resolveObstacleLabel(primaryObs.label);
      }

      // goalId is required as BigInt. Prefer presetGoalId (the wizard was
      // opened pre-scoped to a goal); fall back to selectedGoalId when the
      // user picked a goal in the GOAL_STEP. The GOAL_STEP validation
      // guarantees selectedGoalId !== null when there is no preset, so this
      // is always defined.
      const goalId =
        presetGoalId !== undefined && presetGoalId !== null
          ? toBigInt(presetGoalId)
          : selectedGoalId !== null
            ? toBigInt(selectedGoalId)
            : undefined;
      if (goalId === undefined)
        throw new Error("No goal selected — cannot create habit.");

      const created = await actor.createHabit({
        goalId,
        // The habit's stored name is the user's typed daily action
        // (assembledHabit = "I will <habitAction> for <N> minutes"), NOT the
        // parent goal's wishDescription. Without this the saved habit fell
        // back to the parent goal's keystone-habit name. The backend's
        // CreateHabitRequest now accepts an optional wishDescription for
        // exactly this. Pass the trimmed typed habit name here.
        wishDescription: assembledHabit || form.habitAction.trim() || undefined,
        ifThenPlan: form.ifThenPlan.trim(),
        obstacleTemplateId,
        isLockIn: form.isLockIn,
        scheduledDays: form.scheduledDays,
        startTime:
          form.isLockIn && form.lockInStartTime
            ? form.lockInStartTime
            : undefined,
        endTime:
          form.isLockIn && form.lockInEndTime ? form.lockInEndTime : undefined,
        lockInDurationMinutes: form.isLockIn
          ? BigInt(form.lockInDurationHours * 60 + form.lockInDurationMinutes)
          : BigInt(0),
        startTimeMinutes:
          form.isLockIn && form.lockInStartTime
            ? BigInt(parseHHMMToMinutes(form.lockInStartTime))
            : BigInt(0),
        endTimeMinutes:
          form.isLockIn && form.lockInStartTime
            ? BigInt(
                Math.min(
                  1435,
                  parseHHMMToMinutes(form.lockInStartTime) +
                    form.lockInDurationHours * 60 +
                    form.lockInDurationMinutes,
                ),
              )
            : BigInt(0),
        // Habits do not get an icon (only goals do). iconName is omitted
        // entirely so the backend stores nothing for it.
        iconName: undefined,
        themeColor: form.themeColor || undefined,
      });
      if (created.__kind__ === "err") throw new Error(created.err);
      return created.ok;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["myGoals"],
        refetchType: "all",
      });
      await queryClient.refetchQueries({ queryKey: ["myGoals"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Habit created! Check it out on your dashboard.", {
        description: assembledHabit,
        duration: 5000,
      });
      const goalIdStr = data?.id !== undefined ? String(data.id) : undefined;
      onGoalCreated?.(goalIdStr);
      handleClose();
    },
    onError: (error: Error) => {
      toast.error("Failed to create. Please try again.", {
        description: error.message,
      });
    },
  });

  const handleClose = useCallback(() => {
    setStep(1);
    setForm(getEmptyForm());
    setErrors({});
    setShowExitConfirm(false);
    onClose();
  }, [onClose]);

  /**
   * Deep-compares the current form state against the EMPTY baseline across
   * every FormState field (scalars, the scheduledDays string array, and the
   * selectedObstacles array of objects). Returns true when ANY field differs
   * from its empty baseline value. Also treats step > 1 as dirty so a user
   * who advanced past step 1 (even without filling anything) is prompted
   * before exiting — advancing is itself an unsaved change.
   */
  const isFormDirty = useCallback((): boolean => {
    if (step > 1) return true;
    if (form.category !== EMPTY.category) return true;
    if (form.habitAction !== EMPTY.habitAction) return true;
    if (form.habitMinutes !== EMPTY.habitMinutes) return true;
    if (form.isLockIn !== EMPTY.isLockIn) return true;
    if (form.lockInStartTime !== EMPTY.lockInStartTime) return true;
    if (form.lockInEndTime !== EMPTY.lockInEndTime) return true;
    if (form.lockInDurationHours !== EMPTY.lockInDurationHours) return true;
    if (form.lockInDurationMinutes !== EMPTY.lockInDurationMinutes) return true;
    if (form.ifThenPlan !== EMPTY.ifThenPlan) return true;
    if (form.themeColor !== EMPTY.themeColor) return true;
    // Array deep-compare: scheduledDays (order-insensitive since it's a set of days)
    const emptyDays = new Set(EMPTY.scheduledDays);
    if (form.scheduledDays.length !== EMPTY.scheduledDays.length) return true;
    for (const d of form.scheduledDays) {
      if (!emptyDays.has(d)) return true;
    }
    // Array deep-compare: selectedObstacles (compare by id, label)
    if (form.selectedObstacles.length !== EMPTY.selectedObstacles.length)
      return true;
    for (const o of form.selectedObstacles) {
      const match = EMPTY.selectedObstacles.find((e) => e.id === o.id);
      if (!match) return true;
      if (match.label !== o.label) return true;
    }
    return false;
  }, [step, form]);

  /**
   * Exit request handler shared by the red X button and the Escape key. When
   * the form is dirty, opens the in-component confirmation overlay instead of
   * closing immediately; when clean, closes immediately (existing behavior).
   */
  const requestClose = useCallback(() => {
    if (isFormDirty()) {
      setShowExitConfirm(true);
    } else {
      handleClose();
    }
  }, [isFormDirty, handleClose]);

  const validate = (s: number): boolean => {
    const e: StepError = {};
    if (s === GOAL_STEP) {
      // The GOAL_STEP is a hard gate: the user MUST select an existing goal
      // (the habit has to live inside one). There is no "continue to create a
      // new goal" path — if there are no existing goals the empty-state
      // message tells the user to create a goal first and the Next button is
      // disabled (see goNext / nav bar).
      if (selectedGoalId === null) {
        e.goal = "Select an existing goal to build this habit inside.";
      }
    }
    if (s === WISH_STEP) {
      if (!form.habitAction.trim()) e.habitAction = "Name the daily action.";
      if (!effectiveHabitMinutes) e.habitMinutes = "How many minutes?";
      if (form.isLockIn) {
        if (!form.lockInStartTime) e.lockInStartTime = "Pick a start time.";
        if (!form.lockInEndTime) e.lockInEndTime = "Pick an end time.";
        if (
          form.lockInStartTime &&
          form.lockInEndTime &&
          form.lockInStartTime >= form.lockInEndTime
        )
          e.lockInEndTime = "End time must be after start time.";
        if (overlapError) e.lockInEndTime = overlapError;
        if (
          form.isLockIn &&
          form.lockInDurationHours === 0 &&
          form.lockInDurationMinutes === 0
        ) {
          e.lockInEndTime = "Duration must be at least 1 minute";
        }
      }
    }
    if (s === OBSTACLE_STEP && form.selectedObstacles.length === 0) {
      e.obstacles = "Select at least one obstacle you might face.";
    }
    if (s === PLAN_STEP && !form.ifThenPlan.trim()) {
      e.ifThenPlan = "Write your backup plan.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Scroll the wizard content back to the top whenever the step changes
  useEffect(() => {
    // step is intentionally read so the effect re-runs on step changes
    void step;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [step]);

  const navigate = (dir: "fwd" | "bwd") => {
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => (dir === "fwd" ? s + 1 : s - 1));
      setAnimating(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, 180);
  };

  const goNext = () => {
    if (step === REVIEW_STEP) {
      createGoalMutation.mutate();
      return;
    }
    if (!validate(step)) return;
    if (step === WISH_STEP && overlapError) return;
    navigate("fwd");
  };

  const goBack = () => {
    if (step === 1) return;
    setErrors({});
    navigate("bwd");
  };

  const toggleObstacle = (obs: SelectedObstacle) => {
    setForm((f) => {
      const exists = f.selectedObstacles.find((o) => o.id === obs.id);
      const updated = exists
        ? f.selectedObstacles.filter((o) => o.id !== obs.id)
        : [...f.selectedObstacles, obs];
      return { ...f, selectedObstacles: updated };
    });
    setErrors((e) => ({ ...e, obstacles: undefined }));
  };

  if (!open) return null;

  const slideClass = animating
    ? animDir === "fwd"
      ? "opacity-0 translate-x-8"
      : "opacity-0 -translate-x-8"
    : "opacity-100 translate-x-0";

  // Obstacles are locked to exactly the seven built-in OBSTACLE_TEMPLATES.
  // There are no user-created or custom obstacles, so the chip list is simply
  // the built-in templates.
  const allObstacleChips: SelectedObstacle[] = OBSTACLE_TEMPLATES.map((o) => ({
    id: o.id,
    label: o.label,
  }));

  const isSelected = (id: string) =>
    form.selectedObstacles.some((o) => o.id === id);

  return (
    <>
      {/* Full-screen takeover — slides up from the bottom */}
      <dialog
        open
        aria-modal="true"
        aria-label="WOOP Goal Builder"
        data-ocid="woop_wizard.dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") requestClose();
        }}
        style={{
          transform: mounted ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        className="fixed inset-0 z-[300] flex flex-col bg-card overflow-hidden w-full max-w-none h-full max-h-none m-0 p-0 border-0 rounded-none"
      >
        {/* ── Step Indicator ── rendered at the very TOP of the dialog ── */}
        <div
          className="shrink-0 px-6 pt-2 pb-3"
          aria-label={`Step ${step} of ${totalSteps}`}
        >
          <div className="relative flex items-center max-w-2xl mx-auto">
            {/* Background track — starts at the leftmost edge of the first circle
                and ends at the rightmost edge of the last circle.
                Each circle is 40px (w-10) centered in its flex-1 column (20% of width),
                so the first circle's left edge is at calc(10% - 20px) and the last
                circle's right edge is at calc(90% + 20px). */}
            <div
              className="absolute h-[2px] top-10 rounded-full"
              style={{
                left: "calc(10% - 20px)",
                right: "calc(10% - 20px)",
                background: "oklch(var(--color-accent-missed) / 0.18)",
              }}
              aria-hidden="true"
            />
            {/* Progress track — same start as the background track, grows from
                the first circle's left edge toward the current step. */}
            <div
              className="absolute h-[2px] top-10 rounded-full transition-all duration-500 ease-out"
              style={{
                left: "calc(10% - 20px)",
                right: `calc(${(totalSteps - step) * (100 / totalSteps)}% + 20px)`,
                background: "oklch(var(--color-accent-success))",
                boxShadow:
                  "0 0 8px 1px oklch(var(--color-accent-success) / 0.45)",
              }}
              aria-hidden="true"
            />
            {steps.map((s) => {
              const isActive = step === s.id;
              const isComplete = step > s.id;
              return (
                <div
                  key={s.id}
                  data-ocid={`woop_wizard.step_indicator.${s.id}`}
                  className="relative z-10 flex-1 flex flex-col items-center gap-2"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-bold text-sm"
                    style={
                      isComplete
                        ? {
                            backgroundColor:
                              "oklch(var(--color-accent-success))",
                            color: "oklch(0.12 0 0)",
                            boxShadow:
                              "0 0 16px 3px oklch(var(--color-accent-success) / 0.55)",
                          }
                        : isActive
                          ? {
                              backgroundColor:
                                "oklch(var(--color-accent-success) / 0.15)",
                              border:
                                "2.5px solid oklch(var(--color-accent-success))",
                              color: "oklch(var(--color-accent-success))",
                              boxShadow:
                                "0 0 20px 4px oklch(var(--color-accent-success) / 0.3)",
                            }
                          : {
                              backgroundColor: "oklch(var(--muted))",
                              border:
                                "2px solid oklch(var(--color-accent-missed) / 0.3)",
                              color: "oklch(var(--muted-foreground))",
                            }
                    }
                  >
                    {isComplete ? (
                      <svg
                        viewBox="0 0 12 12"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    ) : (
                      s.id
                    )}
                  </div>
                  <span
                    className="text-xs font-mono tracking-wider uppercase transition-colors duration-200"
                    style={
                      isComplete
                        ? { color: "oklch(var(--color-accent-success) / 0.7)" }
                        : isActive
                          ? {
                              color: "oklch(var(--color-accent-success))",
                              fontWeight: 700,
                            }
                          : { color: "oklch(var(--muted-foreground) / 0.5)" }
                    }
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Scrollable Step Content ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div
            className={`max-w-2xl mx-auto px-6 sm:px-10 pt-5 pb-8 transition-all duration-180 ${slideClass}`}
          >
            {/* STEP 1 — Goal Selection (only when no preset goal) */}
            {step === GOAL_STEP && (
              <div className="space-y-8">
                <p className="text-lg text-muted-foreground border-l-4 border-primary/30 pl-4 italic leading-relaxed">
                  Every habit belongs to a goal. Pick the goal you want to build
                  this habit inside.
                </p>

                <div className="space-y-4">
                  <p className="text-base font-semibold font-mono tracking-widest text-foreground uppercase">
                    Which goal does this habit belong to?
                  </p>

                  {existingGoalsLoading ? (
                    <div
                      className="flex items-center gap-3 py-2"
                      data-ocid="woop_wizard.existing_goals_loading_state"
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 animate-spin shrink-0"
                        style={{
                          borderColor: "oklch(var(--muted-foreground) / 0.3)",
                          borderTopColor: "oklch(var(--muted-foreground))",
                        }}
                      />
                      <span className="text-base text-muted-foreground">
                        Loading your goals…
                      </span>
                    </div>
                  ) : existingGoals.length > 0 ? (
                    <div
                      className="flex flex-col gap-2"
                      data-ocid="woop_wizard.existing_goal_chips"
                    >
                      {existingGoals.map((g, i) => (
                        <ExistingGoalChip
                          key={String(g.id)}
                          goal={g}
                          selected={selectedGoalId === String(g.id)}
                          onSelect={(goal) => {
                            setSelectedGoalId(String(goal.id));
                            setErrors((e) => ({ ...e, goal: undefined }));
                          }}
                          index={i + 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <p
                      className="text-base text-muted-foreground"
                      data-ocid="woop_wizard.no_existing_goals_state"
                    >
                      You don't have any goals yet. Create a goal first, then
                      add a habit to it.
                    </p>
                  )}

                  {selectedGoalId !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGoalId(null);
                        setErrors((e) => ({ ...e, goal: undefined }));
                      }}
                      data-ocid="woop_wizard.clear_goal_button"
                      className="button-clear-neumorphic"
                    >
                      Clear selection
                    </button>
                  )}

                  {errors.goal && (
                    <p
                      className="text-base text-destructive"
                      data-ocid="woop_wizard.goal_step.field_error"
                    >
                      {errors.goal}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 — Wish + Keystone Habit */}
            {step === WISH_STEP && (
              <div className="space-y-10">
                <p className="text-lg text-muted-foreground border-l-4 border-primary/30 pl-4 italic leading-relaxed">
                  Your keystone habit is the daily action. Your goal is the
                  destination. Focus on the action.
                </p>

                <div className="space-y-4">
                  {/* In habit mode the macro goal free-text inputs are removed
                      entirely (the parent goal is chosen in GOAL_STEP). The
                      "The Macro goal" section is still rendered when there is
                      a preset goal so the locked indicator below can show
                      which goal the habit is being created inside; in habit
                      mode without a preset the user already selected a goal in
                      GOAL_STEP so this whole section is hidden. */}
                  {hasPreset && (
                    <>
                      <p className="text-base font-semibold font-mono tracking-widest text-foreground uppercase">
                        The Macro goal
                      </p>
                      <div className="rounded-2xl border border-border/20 p-5 space-y-4 shadow-neumorphic-inset macrogoal-vibrate macrogoal-reused-bg">
                        {/*
                      Preset-goal locked indicator — shown ONLY when the wizard
                      was opened pre-scoped to a goal (presetGoalId set). The
                      goal-reuse chips and the macro goal inputs are already
                      hidden (selectedGoalId is initialized to the preset, so
                      the `selectedGoalId === null` gates below stay closed).
                      This badge replaces them: a lock icon + "Creating habit
                      inside:" label + the preset goal's wish text rendered
                      read-only on a subtle opaque emerald background (the
                      existing --goal-reuse-accent token, the same emerald used
                      for the reused-goal state, applied via the
                      .macrogoal-reused-bg utility already on the parent box
                      plus an inset neumorphic shadow for the soft "locked
                      well" feel). Per the user instruction "Create Habit
                      inside goal card opens habit wizard pre-scoped to that
                      goal".
                    */}
                        {presetGoalId !== undefined &&
                          presetGoalId !== null &&
                          presetGoal && (
                            <div
                              data-ocid="woop_wizard.preset_goal_locked_indicator"
                              className="rounded-2xl p-4 space-y-2"
                              style={{
                                background:
                                  "oklch(var(--goal-reuse-accent) / 0.10)",
                                border:
                                  "1px solid oklch(var(--goal-reuse-accent) / 0.35)",
                                boxShadow:
                                  "inset 2px 2px 6px rgba(0,0,0,0.35), inset -1px -1px 3px rgba(80,80,85,0.12), 0 0 12px oklch(var(--goal-reuse-accent) / 0.10)",
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                                  style={{
                                    background:
                                      "oklch(var(--goal-reuse-accent) / 0.18)",
                                    border:
                                      "1px solid oklch(var(--goal-reuse-accent) / 0.5)",
                                    color: "oklch(var(--goal-reuse-accent))",
                                  }}
                                >
                                  <Lock size={13} aria-hidden="true" />
                                </span>
                                <span
                                  className="text-xs font-mono tracking-widest uppercase"
                                  style={{
                                    color: "oklch(var(--goal-reuse-accent))",
                                  }}
                                >
                                  Creating habit inside
                                </span>
                              </div>
                              <p
                                className="text-base font-medium leading-relaxed break-words"
                                style={{
                                  color: "oklch(var(--goal-reuse-accent))",
                                }}
                              >
                                {presetGoal.wish}
                              </p>
                            </div>
                          )}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-base font-semibold font-mono tracking-widest text-foreground uppercase flex items-center gap-2">
                    <Zap size={13} className="text-accent-success" />
                    the habit
                  </p>
                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 space-y-4 shadow-neumorphic-inset macrogoal-vibrate">
                    {/* `relative` anchors the SuggestionButton dropdown under
                        the full input-row width (see SuggestionButton contract). */}
                    <div className="relative flex flex-wrap items-center gap-3 text-xl">
                      <span className="text-muted-foreground shrink-0">
                        Every day, I will
                      </span>
                      <div className="relative flex flex-1 min-w-24 items-center gap-2">
                        <input
                          data-ocid="woop_wizard.habit_action_input"
                          value={form.habitAction}
                          onChange={(e) => {
                            const val = e.target.value.slice(0, 40);
                            setForm((f) => ({ ...f, habitAction: val }));
                            setErrors((er) => ({
                              ...er,
                              habitAction: undefined,
                            }));
                          }}
                          onFocus={() => setFocusedField("habitAction")}
                          onBlur={() => setFocusedField(null)}
                          placeholder={getPlaceholder(
                            form.category,
                            "habitAction",
                          )}
                          maxLength={40}
                          className="input-neumorphic w-full text-foreground text-xl font-medium"
                          aria-label="Daily habit action"
                          autoComplete="off"
                          name="woop-wizard-habit-action"
                          autoCorrect="off"
                          spellCheck={false}
                          autoCapitalize="off"
                        />
                        <SuggestionButton
                          category={form.category}
                          field="habitAction"
                          onSelect={(value) =>
                            setForm((f) => ({ ...f, habitAction: value }))
                          }
                          disabled={false}
                        />
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        for
                      </span>
                      <div className="relative flex w-28 items-center gap-2">
                        <input
                          data-ocid="woop_wizard.habit_minutes_input"
                          value={
                            effectiveHabitMinutes > 0
                              ? String(effectiveHabitMinutes)
                              : form.habitMinutes
                          }
                          readOnly={form.isLockIn}
                          onChange={(e) => {
                            if (form.isLockIn) return;
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            const num = Number.parseInt(raw, 10);
                            const capped = Number.isNaN(num)
                              ? ""
                              : String(Math.min(num, 1440));
                            setForm((f) => ({ ...f, habitMinutes: capped }));
                            setErrors((er) => ({
                              ...er,
                              habitMinutes: undefined,
                            }));
                          }}
                          placeholder={getPlaceholder(
                            form.category,
                            "habitMinutes",
                          )}
                          inputMode="numeric"
                          style={{
                            opacity: form.isLockIn ? 0.5 : 1,
                            cursor: form.isLockIn ? "not-allowed" : "auto",
                          }}
                          className="input-neumorphic w-full text-foreground text-xl font-medium text-center"
                          aria-label="Minutes per day"
                          autoComplete="off"
                          name="woop-wizard-habit-minutes"
                          autoCorrect="off"
                          spellCheck={false}
                          autoCapitalize="off"
                        />
                        <SuggestionButton
                          category={form.category}
                          field="habitMinutes"
                          onSelect={(value) =>
                            setForm((f) => ({ ...f, habitMinutes: value }))
                          }
                          disabled={form.isLockIn}
                        />
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        minutes
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-xs text-muted-foreground/60 font-mono">
                      <span
                        className={`transition-opacity duration-200 ${focusedField === "habitAction" ? "opacity-100" : "opacity-0"}`}
                      >
                        {form.habitAction.length}/140
                      </span>
                      {form.habitMinutes &&
                        Number.parseInt(form.habitMinutes, 10) >= 1440 && (
                          <span className="text-amber-400/80">
                            Max 1440 min (24 h)
                          </span>
                        )}
                    </div>
                    {(errors.habitAction || errors.habitMinutes) && (
                      <p
                        className="text-base text-destructive"
                        data-ocid="woop_wizard.habit.field_error"
                      >
                        {errors.habitAction || errors.habitMinutes}
                      </p>
                    )}
                    {assembledHabit && (
                      <p className="text-base text-accent-success font-medium leading-relaxed">
                        {assembledHabit}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lock-In Mode Toggle */}
                <div className="space-y-4">
                  <div
                    className={`rounded-2xl border border-border/20 bg-muted/30 p-5 shadow-neumorphic-inset space-y-4 lockin-vibrate${form.isLockIn ? " lockin-vibrate-active" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-display font-semibold text-foreground">
                          Enable Lock-In Mode
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Strict time block — check in &amp; out within a
                          defined window
                        </p>
                        {form.isLockIn && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Lock-In Mode overrides your standard habit time. It
                            must finish by 23:55 to log correctly today. Your
                            max duration is calculated based on your start time.
                          </p>
                        )}
                      </div>
                      {/* Neumorphic CSS toggle switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.isLockIn}
                        data-ocid="woop_wizard.lockin_toggle"
                        onClick={() =>
                          setForm((f) => ({ ...f, isLockIn: !f.isLockIn }))
                        }
                        className="relative shrink-0 w-14 h-7 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{
                          background: form.isLockIn
                            ? "#F59E0B"
                            : "oklch(var(--muted))",
                          boxShadow: form.isLockIn
                            ? "inset 2px 2px 5px rgba(0,0,0,0.35), inset -1px -1px 3px rgba(255,255,255,0.12)"
                            : "inset 2px 2px 5px rgba(0,0,0,0.45), inset -2px -2px 4px rgba(255,255,255,0.07)",
                        }}
                      >
                        <span
                          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-300"
                          style={{
                            left: form.isLockIn ? "calc(100% - 24px)" : "4px",
                            boxShadow: "1px 1px 4px rgba(0,0,0,0.4)",
                          }}
                        />
                      </button>
                    </div>

                    {/* Time pickers — shown when Lock-In is enabled */}
                    {form.isLockIn && (
                      <div className="space-y-4 pt-2 border-t border-border/20">
                        {/* Start Time — always shown first */}
                        <div className="space-y-2">
                          <label
                            htmlFor="lockin-start-time"
                            className="text-xs font-mono tracking-widest text-muted-foreground uppercase"
                          >
                            Start Time
                          </label>
                          <input
                            id="lockin-start-time"
                            type="time"
                            data-ocid="woop_wizard.lockin_start_time"
                            value={form.lockInStartTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm((f) => ({
                                ...f,
                                lockInStartTime: val,
                              }));
                              setErrors((er) => ({
                                ...er,
                                lockInStartTime: undefined,
                              }));
                            }}
                            className="w-full rounded-xl px-3 py-2.5 text-base font-mono text-foreground border border-border/30 transition-smooth focus:outline-none focus:ring-2 focus:ring-primary/40"
                            style={{
                              background: "oklch(var(--card))",
                              boxShadow:
                                "inset 2px 2px 5px rgba(0,0,0,0.4), inset -1px -1px 3px rgba(80,80,85,0.15)",
                            }}
                            autoComplete="off"
                            name="woop-wizard-lockin-start-time"
                            autoCorrect="off"
                            spellCheck={false}
                            autoCapitalize="off"
                          />
                          {errors.lockInStartTime && (
                            <p
                              className="text-xs text-destructive"
                              data-ocid="woop_wizard.lockin_start_time.field_error"
                            >
                              {errors.lockInStartTime}
                            </p>
                          )}
                        </div>

                        {/* Duration — only shown once start time is set */}
                        {!form.lockInStartTime ? (
                          <p className="text-xs text-muted-foreground/70 italic">
                            Please select a start time first to calculate your
                            available lock-in window.
                          </p>
                        ) : (
                          <div>
                            <span className="block text-xs font-mono tracking-widest text-muted-foreground uppercase mb-2">
                              Duration
                            </span>
                            {maxLockInMinutes === 0 ? (
                              <p className="text-xs text-destructive">
                                No duration available — the chosen start time
                                leaves no room before the 23:55 daily cutoff.
                              </p>
                            ) : (
                              <div className="flex gap-3">
                                {/* Hours wheel — capped at maxLockInHours */}
                                <div className="flex-1">
                                  <label
                                    htmlFor="lockin-hours"
                                    className="block text-[11px] text-muted-foreground/60 mb-1.5"
                                  >
                                    Hours
                                  </label>
                                  <select
                                    id="lockin-hours"
                                    data-ocid="woop_wizard.lockin_duration_hours"
                                    value={form.lockInDurationHours}
                                    onChange={(e) =>
                                      setForm((prev) => ({
                                        ...prev,
                                        lockInDurationHours: Number(
                                          e.target.value,
                                        ),
                                      }))
                                    }
                                    size={5}
                                    className="w-full rounded-xl font-mono text-base text-center appearance-none cursor-pointer"
                                    style={{
                                      background: "oklch(var(--card))",
                                      border: "1px solid rgba(245,158,11,0.25)",
                                      boxShadow:
                                        "inset 2px 2px 6px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(80,80,85,0.15)",
                                      color: "oklch(var(--foreground))",
                                      padding: "6px 0",
                                      outline: "none",
                                      overflowY: "auto",
                                    }}
                                  >
                                    {Array.from(
                                      { length: maxLockInHours + 1 },
                                      (_, h) => (
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
                                              form.lockInDurationHours === h
                                                ? 700
                                                : 400,
                                          }}
                                        >
                                          {String(h).padStart(2, "0")}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>
                                {/* Minutes wheel — capped when at maxHours */}
                                <div className="flex-1">
                                  <label
                                    htmlFor="lockin-minutes"
                                    className="block text-[11px] text-muted-foreground/60 mb-1.5"
                                  >
                                    Min
                                  </label>
                                  <select
                                    id="lockin-minutes"
                                    data-ocid="woop_wizard.lockin_duration_minutes"
                                    value={form.lockInDurationMinutes}
                                    onChange={(e) =>
                                      setForm((prev) => ({
                                        ...prev,
                                        lockInDurationMinutes: Number(
                                          e.target.value,
                                        ),
                                      }))
                                    }
                                    size={5}
                                    className="w-full rounded-xl font-mono text-base text-center appearance-none cursor-pointer"
                                    style={{
                                      background: "oklch(var(--card))",
                                      border: "1px solid rgba(245,158,11,0.25)",
                                      boxShadow:
                                        "inset 2px 2px 6px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(80,80,85,0.15)",
                                      color: "oklch(var(--foreground))",
                                      padding: "6px 0",
                                      outline: "none",
                                      overflowY: "auto",
                                    }}
                                  >
                                    {[
                                      0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
                                      55,
                                    ]
                                      .filter(
                                        (m) => m <= maxLockInMinutesAtMaxHour,
                                      )
                                      .map((m) => (
                                        <option
                                          key={m}
                                          value={m}
                                          style={{
                                            background: "oklch(var(--card))",
                                            color:
                                              form.lockInDurationMinutes === m
                                                ? "#F59E0B"
                                                : "oklch(var(--foreground))",
                                            fontWeight:
                                              form.lockInDurationMinutes === m
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
                            {form.lockInStartTime &&
                              (form.lockInDurationHours > 0 ||
                                form.lockInDurationMinutes > 0) && (
                                <p className="text-xs font-mono text-muted-foreground/70 mt-2">
                                  Ends at{" "}
                                  <span style={{ color: "#F59E0B" }}>
                                    {form.lockInEndTime}
                                  </span>
                                </p>
                              )}
                            {errors.lockInEndTime && (
                              <p
                                className="text-xs text-destructive mt-2"
                                data-ocid="woop_wizard.lockin_end_time.field_error"
                              >
                                {errors.lockInEndTime}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Current Lock-In Habits reference list */}
                        {(() => {
                          const otherLockInHabits = (existingLockInGoals ?? [])
                            .filter(
                              (g) =>
                                !editingGoalId ||
                                String(g.id) !== String(editingGoalId),
                            )
                            .sort((a, b) => {
                              const aT = a.startTime ?? "";
                              const bT = b.startTime ?? "";
                              return aT.localeCompare(bT);
                            });
                          if (otherLockInHabits.length === 0) return null;

                          const toMins = (t: string) => {
                            const [h, m] = t.split(":").map(Number);
                            return h * 60 + m;
                          };

                          const newStart = form.lockInStartTime
                            ? toMins(form.lockInStartTime)
                            : null;
                          const newEnd = form.lockInEndTime
                            ? toMins(form.lockInEndTime)
                            : null;

                          return (
                            <div style={{ marginTop: "1rem" }}>
                              <p
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 500,
                                  color: "rgba(253,230,138,0.45)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  marginBottom: "0.5rem",
                                }}
                              >
                                Current Lock-In Habits
                              </p>
                              <div
                                style={{
                                  maxHeight: "10rem",
                                  overflowY: "auto",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                  paddingRight: "4px",
                                }}
                              >
                                {otherLockInHabits.map((habit) => {
                                  const hStart = habit.startTime
                                    ? toMins(habit.startTime)
                                    : null;
                                  const hEnd = habit.endTime
                                    ? toMins(habit.endTime)
                                    : null;
                                  const isConflicting =
                                    newStart !== null &&
                                    newEnd !== null &&
                                    newEnd > newStart &&
                                    hStart !== null &&
                                    hEnd !== null &&
                                    newStart < hEnd &&
                                    newEnd > hStart;

                                  return (
                                    <div
                                      key={String(habit.id)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        padding: "0.375rem 0.75rem",
                                        borderRadius: "0.75rem",
                                        border: isConflicting
                                          ? "1px solid rgba(239,68,68,0.4)"
                                          : "1px solid rgba(255,255,255,0.06)",
                                        boxShadow:
                                          "inset 2px 2px 5px rgba(0,0,0,0.5), inset -1px -1px 3px rgba(255,255,255,0.03)",
                                        transition: "all 0.2s ease",
                                      }}
                                    >
                                      {/* Colored dot */}
                                      <span
                                        style={{
                                          width: "0.5rem",
                                          height: "0.5rem",
                                          borderRadius: "50%",
                                          flexShrink: 0,
                                          backgroundColor: isConflicting
                                            ? "#ef4444"
                                            : "rgba(245,158,11,0.6)",
                                          boxShadow: isConflicting
                                            ? "0 0 6px rgba(239,68,68,0.7)"
                                            : "none",
                                          transition: "all 0.2s ease",
                                        }}
                                      />
                                      {/* Habit name */}
                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          fontWeight: 500,
                                          color: isConflicting
                                            ? "#f87171"
                                            : "rgba(254,243,199,0.7)",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          flex: 1,
                                          transition: "color 0.2s ease",
                                        }}
                                      >
                                        {habit.wishDescription}
                                      </span>
                                      {/* Time block */}
                                      <span
                                        style={{
                                          fontSize: "0.7rem",
                                          color: isConflicting
                                            ? "rgba(248,113,113,0.7)"
                                            : "rgba(254,243,199,0.35)",
                                          whiteSpace: "nowrap",
                                          flexShrink: 0,
                                          transition: "color 0.2s ease",
                                        }}
                                      >
                                        {habit.startTime ?? "??:??"} –{" "}
                                        {habit.endTime ?? "??:??"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                        {overlapError && (
                          <p
                            className="text-sm font-medium"
                            style={{ color: "#EF4444" }}
                            data-ocid="woop_wizard.lockin_overlap.field_error"
                          >
                            {overlapError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Active Days */}
            {step === WISH_STEP && (
              <div className="mt-6 px-1">
                <p className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Active Days
                </p>
                <p className="text-xs text-muted-foreground/60 mb-3">
                  Select which days this habit is active.
                </p>
                <DayPickerRow
                  selectedDays={form.scheduledDays}
                  onChange={(days) =>
                    setForm((f) => ({ ...f, scheduledDays: days }))
                  }
                />
              </div>
            )}
            {/* STEP 3 — Obstacles */}
            {step === OBSTACLE_STEP && (
              <div className="space-y-8">
                <p className="text-lg text-muted-foreground border-l-4 border-primary/30 pl-4 italic leading-relaxed">
                  Unlike wishful thinking, WOOP asks you to name what stands
                  between you and your habit.
                </p>

                <p className="text-xl font-medium text-foreground">
                  What stands between me and my habit?
                </p>

                <div
                  className="flex flex-wrap gap-3"
                  data-ocid="woop_wizard.obstacle_list"
                >
                  {allObstacleChips.map((obs, idx) => {
                    const selected = isSelected(obs.id);
                    return (
                      <button
                        type="button"
                        key={obs.id}
                        data-ocid={`woop_wizard.obstacle.${idx + 1}`}
                        onClick={() => toggleObstacle(obs)}
                        aria-pressed={selected}
                        className={`chip-neumorphic text-base px-4 py-2.5 transition-all duration-200 ${selected ? "active" : ""}`}
                        style={
                          selected
                            ? {
                                backgroundColor:
                                  "oklch(var(--color-accent-social) / 0.2)",
                                borderColor:
                                  "oklch(var(--color-accent-social))",
                                boxShadow:
                                  "0 0 14px oklch(var(--color-accent-social) / 0.4)",
                                color: "oklch(var(--color-accent-social))",
                              }
                            : undefined
                        }
                      >
                        {selected && (
                          <Check size={13} className="inline mr-1.5" />
                        )}
                        {obs.label}
                      </button>
                    );
                  })}
                </div>

                {errors.obstacles && (
                  <p
                    className="text-base text-destructive"
                    data-ocid="woop_wizard.obstacle.field_error"
                  >
                    {errors.obstacles}
                  </p>
                )}
                {form.selectedObstacles.length > 0 && (
                  <p className="text-base text-accent-success">
                    Selected:{" "}
                    {form.selectedObstacles.map((o) => o.label).join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* STEP 4 — If-Then Plan */}
            {step === PLAN_STEP && (
              <div className="space-y-8">
                <p className="text-lg text-muted-foreground border-l-4 border-primary/30 pl-4 italic leading-relaxed">
                  Implementation intentions double follow-through. When you
                  encounter your obstacle, this plan becomes your autopilot.
                </p>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 shadow-neumorphic-inset space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-mono tracking-widest text-muted-foreground uppercase shrink-0">
                        IF
                      </span>
                      {form.selectedObstacles.map((obs) => (
                        <span
                          key={obs.id}
                          className="px-3 py-1.5 rounded-xl text-base font-medium"
                          style={{
                            backgroundColor:
                              "oklch(var(--color-accent-social) / 0.15)",
                            color: "oklch(var(--color-accent-social))",
                            border:
                              "1px solid oklch(var(--color-accent-social) / 0.4)",
                          }}
                        >
                          {obs.label}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-2 pt-1">
                      <p className="text-sm font-mono tracking-widest text-muted-foreground uppercase">
                        Then I will...
                      </p>
                      <Textarea
                        data-ocid="woop_wizard.if_then_plan_input"
                        value={form.ifThenPlan}
                        onChange={(e) => {
                          const val = e.target.value.slice(0, 40);
                          setForm((f) => ({ ...f, ifThenPlan: val }));
                          setErrors((er) => ({
                            ...er,
                            ifThenPlan: undefined,
                          }));
                        }}
                        onFocus={() => setFocusedField("ifThenPlan")}
                        onBlur={() => setFocusedField(null)}
                        placeholder={getPlaceholder(
                          form.category,
                          "ifThenPlan",
                        )}
                        maxLength={40}
                        rows={4}
                        className="placeholder-subtle w-full bg-transparent border-0 resize-none text-foreground text-lg focus:ring-0 focus:outline-none shadow-none"
                        aria-label="Your If-Then plan"
                        autoComplete="off"
                        name="woop-wizard-if-then-plan"
                        autoCorrect="off"
                        spellCheck={false}
                        autoCapitalize="off"
                      />
                    </div>
                    <div className="flex justify-end">
                      <span
                        className={`text-xs text-muted-foreground/60 font-mono transition-opacity duration-200 ${focusedField === "ifThenPlan" ? "opacity-100" : "opacity-0"}`}
                      >
                        {form.ifThenPlan.length}/40
                      </span>
                    </div>
                  </div>
                  {errors.ifThenPlan && (
                    <p
                      className="text-base text-destructive"
                      data-ocid="woop_wizard.if_then_plan.field_error"
                    >
                      {errors.ifThenPlan}
                    </p>
                  )}
                </div>

                {createGoalMutation.isError &&
                  !createGoalMutation.error?.message?.includes("limit") && (
                    <p
                      className="text-base text-destructive"
                      data-ocid="woop_wizard.create_goal.error_state"
                    >
                      Something went wrong. Please try again.
                    </p>
                  )}
                {!actor && (
                  <p
                    className="text-base text-muted-foreground"
                    data-ocid="woop_wizard.actor_loading_state"
                  >
                    Connecting to backend…
                  </p>
                )}
              </div>
            )}

            {/* STEP 5 — Review + Icon + Color */}
            {step === REVIEW_STEP && (
              <div className="space-y-8">
                <p className="text-lg text-muted-foreground border-l-4 border-primary/30 pl-4 italic leading-relaxed">
                  Review your commitment and personalize your goal. This is the
                  contract with yourself — make it real.
                </p>

                {/* Summaries */}
                <div className="space-y-4">
                  <div
                    className="rounded-2xl p-5 space-y-1.5"
                    style={{
                      background: "oklch(var(--color-accent-success) / 0.08)",
                      border:
                        "1px solid oklch(var(--color-accent-success) / 0.3)",
                      boxShadow:
                        "0 0 14px oklch(var(--color-accent-success) / 0.12)",
                    }}
                  >
                    <p
                      className="text-xs font-mono tracking-widest uppercase"
                      style={{ color: "oklch(var(--color-accent-success))" }}
                    >
                      Daily Habit
                    </p>
                    <p
                      className="text-lg font-semibold leading-relaxed"
                      style={{ color: "oklch(var(--color-accent-success))" }}
                    >
                      {assembledHabit}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 shadow-neumorphic-inset space-y-2">
                    <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
                      Obstacle(s)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {form.selectedObstacles.map((obs) => (
                        <span
                          key={obs.id}
                          className="px-3 py-1 rounded-lg text-base font-medium"
                          style={{
                            backgroundColor:
                              "oklch(var(--color-accent-social) / 0.15)",
                            color: "oklch(var(--color-accent-social))",
                          }}
                        >
                          {obs.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 shadow-neumorphic-inset space-y-1.5">
                    <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
                      Your Plan
                    </p>
                    <p className="text-base text-foreground leading-relaxed">
                      IF "{primaryObstacle}", THEN I will {form.ifThenPlan}
                    </p>
                  </div>
                </div>

                {/* Theme Color Picker */}
                <div className="space-y-4">
                  <p className="text-sm font-mono tracking-widest text-muted-foreground uppercase">
                    Theme Color
                  </p>
                  <div
                    className="flex flex-wrap gap-4"
                    data-ocid="woop_wizard.color_selector"
                  >
                    {THEME_COLORS.map((color) => {
                      const isColorSelected = form.themeColor === color.value;
                      return (
                        <div
                          key={color.id}
                          className="flex flex-col items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                themeColor: color.value,
                              }))
                            }
                            aria-label={color.label}
                            aria-pressed={isColorSelected}
                            data-ocid={`woop_wizard.color.${color.id}`}
                            className="w-11 h-11 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            style={{
                              backgroundColor: color.value,
                              boxShadow: isColorSelected
                                ? `0 0 0 3px oklch(var(--card)), 0 0 0 5px ${color.value}, 0 0 14px 3px ${color.value}66`
                                : "inset 0 1px 2px rgba(0,0,0,0.3)",
                              transform: isColorSelected
                                ? "scale(1.2)"
                                : "scale(1)",
                            }}
                          />
                          <span className="text-sm text-muted-foreground font-mono">
                            {color.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {createGoalMutation.isError &&
                  !createGoalMutation.error?.message?.includes("limit") && (
                    <p
                      className="text-base text-destructive"
                      data-ocid="woop_wizard.create_goal.error_state"
                    >
                      Something went wrong. Please try again.
                    </p>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* ── Back / Next Nav Bar ── rendered at the BOTTOM of the dialog ── */}
        {/* Last child of the dialog content (after the step indicator at the top
            and the scrollable step body in the middle). Single horizontal row
            using a 3-column flex layout so the page indicator is EXACTLY
            centered between Back and Next with equal spacing on both sides:
              [red X (shrink-0, outside the 3-col group)] [Back (flex-1 justify-start)] [indicator (flex-1 justify-center)] [Next (flex-1 justify-end)]
            The red X sits to the LEFT of Back in its own shrink-0 wrapper so it
            does not disturb the equal Back/indicator/Next spacing. border-t
            (not border-b) since the bar is now at the bottom. */}
        <div className="shrink-0 flex items-stretch gap-3 px-6 py-4 border-t border-border bg-card">
          {/* Red icon-only Exit/Close button — far LEFT corner of the nav bar,
              in its own shrink-0 wrapper OUTSIDE the 3-column equal-spacing
              group so it does not disturb the Back/indicator/Next centering.
              Destructive variant, square icon button (no text label). Uses
              requestClose so a dirty form opens the in-component confirm
              overlay instead of closing immediately. */}
          <div className="flex items-center shrink-0">
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={requestClose}
              data-ocid="woop_wizard.close_button"
              aria-label="Close goal builder"
              className="w-10 h-10 p-0"
            >
              <X size={18} />
            </Button>
          </div>

          {/* 3-column equal-spacing group: Back (left), indicator (center), Next (right) */}
          <div className="flex-1 flex items-center gap-3">
            {/* Left column — Back button, justify-start */}
            <div className="flex-1 flex items-center justify-start">
              <Button
                type="button"
                variant="outline"
                size="lg"
                data-ocid="woop_wizard.back_button"
                onClick={
                  step === REVIEW_STEP
                    ? () => {
                        setErrors({});
                        setStep(PLAN_STEP);
                      }
                    : goBack
                }
                disabled={step === GOAL_STEP}
                className="gap-2 button-primary-neon text-base min-w-[100px]"
              >
                <ChevronLeft size={16} />
                {step === REVIEW_STEP ? "Edit" : "Back"}
              </Button>
            </div>

            {/* Center column — page indicator, justify-center (exactly centered
                between Back and Next with equal spacing on both sides) */}
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
                {step} / {totalSteps}
              </span>
            </div>

            {/* Right column — Next button, justify-end */}
            <div className="flex-1 flex items-center justify-end">
              <Button
                type="button"
                size="lg"
                data-ocid={
                  step === REVIEW_STEP
                    ? "woop_wizard.commit_button"
                    : "woop_wizard.next_button"
                }
                onClick={goNext}
                disabled={
                  createGoalMutation.isPending ||
                  (step === REVIEW_STEP && !actor) ||
                  (step === WISH_STEP && !!overlapError) ||
                  // In habit mode the GOAL_STEP is a hard gate: disable Next
                  // until the user selects an existing goal. This also covers
                  // the empty-state (no existing goals) — the user is told to
                  // create a goal first and cannot proceed.
                  (step === GOAL_STEP && selectedGoalId === null)
                }
                className="gap-2 button-primary-neon text-base min-w-[130px]"
              >
                {step === REVIEW_STEP ? (
                  createGoalMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                      Committing…
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Commit →
                    </>
                  )
                ) : (
                  "Next →"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ── In-component "Discard changes?" confirmation overlay ── */}
        {/* Rendered inside the wizard dialog (NOT the route-based
            UnsavedChangesDialog, which uses TanStack Router useBlocker and is
            unsuitable for a modal). Shown when the user presses the red X
            exit button (or Escape) AND the form is dirty. "Discard" calls the
            existing reset + onClose flow; "Keep editing" dismisses the overlay. */}
        {showExitConfirm && (
          <dialog
            open
            className="absolute inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            aria-label="Discard changes confirmation"
            data-ocid="woop_wizard.exit_confirm_modal"
            onClick={(e) => {
              // Clicking the backdrop (the dialog itself, not its contents)
              // dismisses the overlay (keep editing).
              if (e.target === e.currentTarget) {
                setShowExitConfirm(false);
              }
            }}
            onKeyDown={(e) => {
              // Keyboard equivalent of the backdrop click: Enter or Space on
              // the dialog (when the backdrop itself has focus) dismisses it.
              if (
                (e.key === "Enter" || e.key === " ") &&
                e.target === e.currentTarget
              ) {
                e.preventDefault();
                setShowExitConfirm(false);
              }
            }}
            onCancel={(e) => {
              // Escape key dismisses the overlay (keep editing).
              e.preventDefault();
              setShowExitConfirm(false);
            }}
          >
            <div className="mx-6 max-w-sm w-full rounded-2xl border border-border bg-card p-6 shadow-neumorphic-emboss">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "oklch(var(--destructive) / 0.15)",
                    border: "1px solid oklch(var(--destructive) / 0.4)",
                  }}
                >
                  <X
                    size={18}
                    className="text-destructive"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-display font-semibold text-foreground">
                    Discard changes?
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    You have unsaved input. Discarding will close the wizard and
                    lose your progress.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  data-ocid="woop_wizard.exit_confirm.keep_editing_button"
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 gap-2 button-primary-neon text-base"
                >
                  Keep editing
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  data-ocid="woop_wizard.exit_confirm.discard_button"
                  onClick={handleClose}
                  className="flex-1 gap-2 text-base"
                >
                  Discard
                </Button>
              </div>
            </div>
          </dialog>
        )}
      </dialog>
    </>
  );
}
