import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Plus, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ObstacleTemplate as BackendObstacleTemplate } from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";
import { OBSTACLE_TEMPLATES } from "../types/index";
import { GOAL_ICONS } from "../utils/goalIcons";

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
  /** ID of the goal being edited — excluded from the overlap check */
  editingGoalId?: bigint;
}

interface SelectedObstacle {
  id: string;
  label: string;
  kind: "builtin" | "user" | "custom";
  backendId?: bigint;
}

interface FormState {
  // Step 1 — Wish + Keystone Habit
  goalAction: string;
  goalReason: string;
  habitAction: string;
  habitMinutes: string;
  // Lock-In
  isLockIn: boolean;
  lockInStartTime: string;
  lockInEndTime: string;
  lockInDurationHours: number;
  lockInDurationMinutes: number;
  // Step 2 — Obstacles
  selectedObstacles: SelectedObstacle[];
  customInput: string;
  customChips: SelectedObstacle[];
  // Step 3 — If-Then Plan
  ifThenPlan: string;
  // Step 4 — Icon + Color
  iconName: string;
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

const STEPS = [
  { id: 1, label: "Wish" },
  { id: 2, label: "Obstacle" },
  { id: 3, label: "Plan" },
  { id: 4, label: "Review" },
];

const EMPTY: FormState = {
  goalAction: "",
  goalReason: "",
  habitAction: "",
  habitMinutes: "",
  isLockIn: false,
  lockInStartTime: "",
  lockInEndTime: "",
  lockInDurationHours: 0,
  lockInDurationMinutes: 0,
  selectedObstacles: [],
  customInput: "",
  customChips: [],
  ifThenPlan: "",
  iconName: "target",
  themeColor: "#2563EB",
};

/** Returns the conflicting Lock-In goal name if newStart/newEnd overlaps any existing block. */
/** Returns the conflicting Lock-In goal name if the new block overlaps any existing one.
 *  - Point-in-time check (newDurationMinutes === 0): checks if newStartTime falls strictly
 *    *inside* an existing block (exclusive on both ends).
 *  - Range check (newDurationMinutes > 0): standard interval overlap of [start, end].
 */
function findOverlapGoal(
  goals: Array<{
    id: bigint;
    startTime?: string;
    endTime?: string;
    wishDescription: string;
  }>,
  newStartTime: string,
  newEndTime: string,
  editingGoalId?: bigint | null,
): string | null {
  if (!newStartTime) return null;
  for (const g of goals) {
    if (
      editingGoalId !== undefined &&
      editingGoalId !== null &&
      g.id === editingGoalId
    )
      continue;
    if (!g.startTime || !g.endTime) continue;
    const isPointInTime = newStartTime === newEndTime;
    if (isPointInTime) {
      // Strictly inside: existingStart < newStart < existingEnd
      if (g.startTime < newStartTime && newStartTime < g.endTime) {
        return g.wishDescription || "an existing Lock-In";
      }
    } else {
      // Standard overlap: [newStart, newEnd) overlaps [existingStart, existingEnd)
      if (newStartTime < g.endTime && newEndTime > g.startTime) {
        return g.wishDescription || "an existing Lock-In";
      }
    }
  }
  return null;
}

export default function WoopWizard({
  open,
  onClose,
  onGoalCreated,
  existingLockInGoals = [],
  editingGoalId,
}: WoopWizardProps) {
  const [step, setStep] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<"fwd" | "bwd">("fwd");
  const [mounted, setMounted] = useState(false);
  const [errors, setErrors] = useState<StepError>({});
  const [form, setForm] = useState<FormState>(EMPTY);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [overlapError, setOverlapError] = useState<string | null>(null);

  const { actor, isFetching } = useBackend();
  const queryClient = useQueryClient();

  // Slide-up entrance animation + full reset on open
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    // Full reset every time the wizard opens so custom obstacles never leak
    // between sessions. EMPTY already has customChips: [] and selectedObstacles: [].
    setForm(EMPTY);
    setStep(1);
    setErrors({});
    // Tiny delay lets the browser paint the initial off-screen position first
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const assembledWish =
    form.goalAction.trim() && form.goalReason.trim()
      ? `I want to ${form.goalAction.trim()} so that I can ${form.goalReason.trim()}`
      : "";
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
    form.lockInDurationHours === maxLockInHours ? maxLockInMinutes % 60 : 59;

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
        const clampedMinutes = maxMins % 60;
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
  const assembledObstacles = form.selectedObstacles
    .map((o) => o.label)
    .join(", ");
  const primaryObstacle = form.selectedObstacles[0]?.label ?? "";

  const { data: userObstacles = [] } = useQuery<BackendObstacleTemplate[]>({
    queryKey: ["obstacleTemplates"],
    queryFn: async () => {
      if (!actor || !("listMyObstacleTemplates" in actor)) return [];
      try {
        return await actor.listMyObstacleTemplates();
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching,
  });

  const createGoalMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready — please wait and retry.");

      // Only link an already-persisted user obstacle template (kind==='user').
      // Do NOT create new obstacle templates for builtin or custom obstacles —
      // they accumulate in listMyObstacleTemplates() and cannot be deleted,
      // causing them to re-appear in the chip list on the next wizard open.
      // The obstacle text is already stored in the goal's `outcome` field.
      const primaryUserObs = form.selectedObstacles.find(
        (o) => o.kind === "user" && o.backendId !== undefined,
      );
      const obstacleTemplateId = primaryUserObs?.backendId;

      const created = (await actor.createGoal({
        wish: assembledWish,
        wishDescription: assembledHabit,
        outcome: assembledObstacles,
        obstacleTemplateId,
        ifThenPlan: form.ifThenPlan.trim(),
        iconName: form.iconName || undefined,
        themeColor: form.themeColor || undefined,
        isLockIn: form.isLockIn,
        startTime:
          form.isLockIn && form.lockInStartTime
            ? form.lockInStartTime
            : undefined,
        endTime:
          form.isLockIn && form.lockInEndTime ? form.lockInEndTime : undefined,
      })) as unknown as
        | { __kind__: "ok"; ok: { id: bigint } }
        | { __kind__: "err"; err: string };
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
      toast.error("Failed to create habit. Please try again.", {
        description: error.message,
      });
    },
  });

  const handleClose = useCallback(() => {
    setStep(1);
    setForm(EMPTY);
    setErrors({});
    onClose();
  }, [onClose]);

  const validate = (s: number): boolean => {
    const e: StepError = {};
    if (s === 1) {
      if (!form.goalAction.trim())
        e.goalAction = "Tell us what you want to achieve.";
      if (!form.goalReason.trim()) e.goalReason = "What's your deeper reason?";
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
    if (s === 2 && form.selectedObstacles.length === 0) {
      e.obstacles = "Select at least one obstacle you might face.";
    }
    if (s === 3 && !form.ifThenPlan.trim()) {
      e.ifThenPlan = "Write your backup plan.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const navigate = (dir: "fwd" | "bwd") => {
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => (dir === "fwd" ? s + 1 : s - 1));
      setAnimating(false);
    }, 180);
  };

  const goNext = () => {
    if (step === 4) {
      createGoalMutation.mutate();
      return;
    }
    if (!validate(step)) return;
    if (step === 1 && overlapError) return;
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

  const addCustomChip = () => {
    const label = form.customInput.trim();
    if (!label) return;
    const normalised = label.toLowerCase();
    const alreadyExists =
      form.customChips.some((c) => c.label.toLowerCase() === normalised) ||
      OBSTACLE_TEMPLATES.some((t) => t.label.toLowerCase() === normalised);
    if (alreadyExists) {
      setErrors((e) => ({
        ...e,
        customInput: "That obstacle is already listed.",
      }));
      return;
    }
    const chip: SelectedObstacle = {
      id: `custom_${Date.now()}`,
      label,
      kind: "custom",
    };
    setForm((f) => ({
      ...f,
      customInput: "",
      customChips: [...f.customChips, chip],
      selectedObstacles: [...f.selectedObstacles, chip],
    }));
    setErrors((e) => ({ ...e, obstacles: undefined, customInput: undefined }));
  };

  if (!open) return null;

  const slideClass = animating
    ? animDir === "fwd"
      ? "opacity-0 translate-x-8"
      : "opacity-0 -translate-x-8"
    : "opacity-100 translate-x-0";

  const presetIds = new Set(OBSTACLE_TEMPLATES.map((t) => t.id));

  // Strings that must never appear as obstacle options regardless of backend state
  const BLOCKED_OBSTACLE_LABELS = new Set([
    "my brain",
    "drugs",
    "drug",
    "brain",
  ]);

  const uniqueUserObstacles = userObstacles
    .filter(
      (o) =>
        !presetIds.has(String(o.id)) &&
        !OBSTACLE_TEMPLATES.some(
          (t) => t.label.toLowerCase() === o.title.toLowerCase(),
        ) &&
        !BLOCKED_OBSTACLE_LABELS.has(o.title.toLowerCase().trim()),
    )
    .map((o) => ({
      id: `user_${String(o.id)}`,
      label: o.title,
      kind: "user" as const,
      backendId: o.id,
    }));

  const allObstacleChips: SelectedObstacle[] = [
    ...OBSTACLE_TEMPLATES.map((o) => ({
      id: o.id,
      label: o.label,
      kind: "builtin" as const,
    })),
    ...uniqueUserObstacles,
    ...form.customChips,
  ];

  const isSelected = (id: string) =>
    form.selectedObstacles.some((o) => o.id === id);

  const stepTitles = [
    "Plant your wish",
    "Name your obstacle",
    "Write your plan",
    "Your commitment",
  ];

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
          if (e.key === "Escape") handleClose();
        }}
        style={{
          transform: mounted ? "translateY(0)" : "translateY(100%)",
          transition: "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        className="fixed inset-0 z-[300] flex flex-col bg-card overflow-hidden w-full max-w-none h-full max-h-none m-0 p-0 border-0 rounded-none"
      >
        {/* ── Top Bar ── */}
        <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <div>
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase mb-1">
              WOOP Habit Builder
            </p>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight">
              {stepTitles[step - 1]}
            </h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            data-ocid="woop_wizard.close_button"
            aria-label="Close goal builder"
            className="text-muted-foreground hover:text-foreground shrink-0 w-11 h-11"
          >
            <X size={22} />
          </Button>
        </div>

        {/* ── Step Indicator ── */}
        <div
          className="shrink-0 px-6 pt-5 pb-4"
          aria-label={`Step ${step} of 4`}
        >
          <div className="relative flex items-center max-w-2xl mx-auto">
            {/* Background track */}
            <div
              className="absolute left-5 right-5 h-[2px] top-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "oklch(var(--color-accent-missed) / 0.18)" }}
              aria-hidden="true"
            />
            {/* Progress track */}
            <div
              className="absolute left-5 h-[2px] top-1/2 -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
              style={{
                background: "oklch(var(--color-accent-success))",
                right: `calc(${(4 - step + 1) * 25 - 6}% + 20px)`,
                boxShadow:
                  "0 0 8px 1px oklch(var(--color-accent-success) / 0.45)",
              }}
              aria-hidden="true"
            />
            {STEPS.map((s) => {
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
        <div className="flex-1 overflow-y-auto">
          <div
            className={`max-w-2xl mx-auto px-6 sm:px-10 py-8 transition-all duration-180 ${slideClass}`}
          >
            {/* STEP 1 — Wish + Keystone Habit */}
            {step === 1 && (
              <div className="space-y-10">
                <p className="text-lg text-muted-foreground border-l-4 border-primary/30 pl-4 italic leading-relaxed">
                  Your keystone habit is the daily action. Your goal is the
                  destination. Focus on the action.
                </p>

                <div className="space-y-4">
                  <p className="text-sm font-mono tracking-widest text-muted-foreground uppercase">
                    Macro Goal
                  </p>
                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 space-y-4 shadow-neumorphic-inset">
                    <div className="flex flex-wrap items-center gap-3 text-xl">
                      <span className="text-muted-foreground shrink-0">
                        I want to
                      </span>
                      <input
                        data-ocid="woop_wizard.goal_action_input"
                        value={form.goalAction}
                        onChange={(e) => {
                          const val = e.target.value.slice(0, 140);
                          setForm((f) => ({ ...f, goalAction: val }));
                          setErrors((er) => ({ ...er, goalAction: undefined }));
                        }}
                        onFocus={() => setFocusedField("goalAction")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="run a marathon"
                        maxLength={140}
                        className="input-neumorphic flex-1 min-w-32 text-foreground text-xl font-medium"
                        aria-label="What do you want to achieve"
                      />
                      <span className="text-muted-foreground shrink-0">
                        so that I can
                      </span>
                      <input
                        data-ocid="woop_wizard.goal_reason_input"
                        value={form.goalReason}
                        onChange={(e) => {
                          const val = e.target.value.slice(0, 140);
                          setForm((f) => ({ ...f, goalReason: val }));
                          setErrors((er) => ({ ...er, goalReason: undefined }));
                        }}
                        onFocus={() => setFocusedField("goalReason")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="feel unstoppable"
                        maxLength={140}
                        className="input-neumorphic flex-1 min-w-32 text-foreground text-xl font-medium"
                        aria-label="Your deeper reason"
                      />
                    </div>
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground/60 font-mono">
                      <span
                        className={`transition-opacity duration-200 ${focusedField === "goalAction" ? "opacity-100" : "opacity-0"}`}
                      >
                        {form.goalAction.length}/140
                      </span>
                      <span
                        className={`transition-opacity duration-200 ${focusedField === "goalReason" ? "opacity-100" : "opacity-0"}`}
                      >
                        {form.goalReason.length}/140
                      </span>
                    </div>
                    {(errors.goalAction || errors.goalReason) && (
                      <p
                        className="text-base text-destructive"
                        data-ocid="woop_wizard.goal.field_error"
                      >
                        {errors.goalAction || errors.goalReason}
                      </p>
                    )}
                    {assembledWish && (
                      <p className="text-base text-accent-success font-medium leading-relaxed">
                        {assembledWish}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                    <Zap size={13} className="text-accent-success" />
                    Keystone Habit — shown on your dashboard
                  </p>
                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 space-y-4 shadow-neumorphic-inset">
                    <div className="flex flex-wrap items-center gap-3 text-xl">
                      <span className="text-muted-foreground shrink-0">
                        Every day, I will
                      </span>
                      <input
                        data-ocid="woop_wizard.habit_action_input"
                        value={form.habitAction}
                        onChange={(e) => {
                          const val = e.target.value.slice(0, 140);
                          setForm((f) => ({ ...f, habitAction: val }));
                          setErrors((er) => ({
                            ...er,
                            habitAction: undefined,
                          }));
                        }}
                        onFocus={() => setFocusedField("habitAction")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="run"
                        maxLength={140}
                        className="input-neumorphic flex-1 min-w-24 text-foreground text-xl font-medium"
                        aria-label="Daily habit action"
                      />
                      <span className="text-muted-foreground shrink-0">
                        for
                      </span>
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
                        placeholder="15"
                        inputMode="numeric"
                        style={{
                          opacity: form.isLockIn ? 0.5 : 1,
                          cursor: form.isLockIn ? "not-allowed" : "auto",
                        }}
                        className="input-neumorphic w-20 text-foreground text-xl font-medium text-center"
                        aria-label="Minutes per day"
                      />
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
                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 shadow-neumorphic-inset space-y-4">
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
                                    {Array.from(
                                      { length: maxLockInMinutesAtMaxHour + 1 },
                                      (_, m) => (
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
                                              form.lockInDurationMinutes === m
                                                ? 700
                                                : 400,
                                          }}
                                        >
                                          {String(m).padStart(2, "0")}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>
                              </div>
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

            {/* STEP 2 — Obstacles */}
            {step === 2 && (
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
                    const isCustom = obs.kind === "custom";
                    return (
                      <div
                        key={obs.id}
                        className="relative inline-flex items-center"
                      >
                        <button
                          type="button"
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
                        {isCustom && (
                          <button
                            type="button"
                            aria-label={`Remove ${obs.label}`}
                            data-ocid={`woop_wizard.remove_custom_obstacle.${idx + 1}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm((f) => ({
                                ...f,
                                customChips: f.customChips.filter(
                                  (c) => c.id !== obs.id,
                                ),
                                selectedObstacles: f.selectedObstacles.filter(
                                  (o) => o.id !== obs.id,
                                ),
                              }));
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

                <div className="space-y-3">
                  <p className="text-base text-muted-foreground font-medium">
                    Add a custom obstacle
                  </p>
                  <div className="flex gap-3">
                    <Input
                      data-ocid="woop_wizard.custom_obstacle_input"
                      value={form.customInput}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, customInput: e.target.value }));
                        setErrors((er) => ({ ...er, customInput: undefined }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomChip();
                        }
                      }}
                      placeholder="My specific blocker…"
                      className="input-neumorphic flex-1 text-lg bg-transparent border-0"
                    />
                    <Button
                      type="button"
                      size="default"
                      data-ocid="woop_wizard.add_custom_obstacle_button"
                      onClick={addCustomChip}
                      disabled={!form.customInput.trim()}
                      className="button-primary-neon gap-1.5 shrink-0 text-base"
                    >
                      <Plus size={15} /> Add
                    </Button>
                  </div>
                </div>

                {errors.customInput && (
                  <p
                    className="text-base text-destructive"
                    data-ocid="woop_wizard.custom_obstacle.field_error"
                  >
                    {errors.customInput}
                  </p>
                )}
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

            {/* STEP 3 — If-Then Plan */}
            {step === 3 && (
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
                          const val = e.target.value.slice(0, 140);
                          setForm((f) => ({ ...f, ifThenPlan: val }));
                          setErrors((er) => ({ ...er, ifThenPlan: undefined }));
                        }}
                        onFocus={() => setFocusedField("ifThenPlan")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="do a 15-min home workout instead"
                        maxLength={140}
                        rows={4}
                        className="w-full bg-transparent border-0 p-0 resize-none text-foreground text-lg focus:ring-0 focus:outline-none placeholder:text-muted-foreground/60 shadow-none"
                        aria-label="Your If-Then plan"
                      />
                    </div>
                    <div className="flex justify-end">
                      <span
                        className={`text-xs text-muted-foreground/60 font-mono transition-opacity duration-200 ${focusedField === "ifThenPlan" ? "opacity-100" : "opacity-0"}`}
                      >
                        {form.ifThenPlan.length}/140
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

            {/* STEP 4 — Review + Icon + Color */}
            {step === 4 && (
              <div className="space-y-8">
                <p className="text-lg text-muted-foreground border-l-4 border-primary/30 pl-4 italic leading-relaxed">
                  Review your commitment and personalize your goal. This is the
                  contract with yourself — make it real.
                </p>

                {/* Summaries */}
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 shadow-neumorphic-inset space-y-1.5">
                    <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
                      Macro Goal
                    </p>
                    <p className="text-lg text-foreground font-medium leading-relaxed">
                      {assembledWish}
                    </p>
                  </div>

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

                {/* Goal Icon Selector */}
                <div className="space-y-4">
                  <p className="text-sm font-mono tracking-widest text-muted-foreground uppercase">
                    Choose an Icon
                  </p>
                  <div
                    className="grid grid-cols-7 gap-3"
                    data-ocid="woop_wizard.icon_selector"
                  >
                    {GOAL_ICONS.map((icon) => {
                      const isIconSelected = form.iconName === icon.id;
                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, iconName: icon.id }))
                          }
                          aria-label={`Select ${icon.label} icon`}
                          aria-pressed={isIconSelected}
                          data-ocid={`woop_wizard.icon.${icon.id}`}
                          className="relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 p-2.5"
                          style={
                            isIconSelected
                              ? {
                                  backgroundColor:
                                    "oklch(var(--color-accent-success) / 0.15)",
                                  border:
                                    "2.5px solid oklch(var(--color-accent-success))",
                                  color: "oklch(var(--color-accent-success))",
                                  boxShadow:
                                    "0 0 16px 3px oklch(var(--color-accent-success) / 0.35)",
                                }
                              : {
                                  backgroundColor: "oklch(var(--card))",
                                  border: "1.5px solid oklch(var(--border))",
                                  color: "oklch(var(--muted-foreground))",
                                  boxShadow:
                                    "3px 3px 6px rgba(0,0,0,0.4), -2px -2px 5px rgba(255,255,255,0.03)",
                                }
                          }
                        >
                          <span className="w-6 h-6 block">{icon.svg}</span>
                        </button>
                      );
                    })}
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

        {/* ── Fixed Footer ── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-t border-border bg-card">
          <Button
            type="button"
            variant="outline"
            size="lg"
            data-ocid="woop_wizard.back_button"
            onClick={
              step === 4
                ? () => {
                    setErrors({});
                    setStep(3);
                  }
                : goBack
            }
            disabled={step === 1}
            className="gap-2 text-base min-w-[100px]"
          >
            <ChevronLeft size={16} />
            {step === 4 ? "Edit" : "Back"}
          </Button>

          <span className="text-sm font-mono text-muted-foreground">
            {step} / 4
          </span>

          <Button
            type="button"
            size="lg"
            data-ocid={
              step === 4
                ? "woop_wizard.commit_button"
                : "woop_wizard.next_button"
            }
            onClick={goNext}
            disabled={
              createGoalMutation.isPending ||
              (step === 4 && !actor) ||
              (step === 1 && !!overlapError)
            }
            className="gap-2 button-primary-neon text-base min-w-[130px]"
          >
            {step === 4 ? (
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
      </dialog>
    </>
  );
}
