import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Plus, X, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ObstacleTemplate as BackendObstacleTemplate } from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";
import { useUserProfile } from "../hooks/useUserProfile";
import { OBSTACLE_TEMPLATES } from "../types/index";
import { GOAL_ICONS } from "../utils/goalIcons";
import TierLimitModal from "./TierLimitModal";

interface WoopWizardProps {
  open: boolean;
  onClose: () => void;
  onGoalCreated?: () => void;
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
  selectedObstacles: [],
  customInput: "",
  customChips: [],
  ifThenPlan: "",
  iconName: "target",
  themeColor: "#2563EB",
};

export default function WoopWizard({
  open,
  onClose,
  onGoalCreated,
}: WoopWizardProps) {
  const [step, setStep] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<"fwd" | "bwd">("fwd");
  const [mounted, setMounted] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [errors, setErrors] = useState<StepError>({});
  const [form, setForm] = useState<FormState>(EMPTY);

  const { actor, isFetching } = useBackend();
  const { data: userProfile } = useUserProfile();
  const queryClient = useQueryClient();

  // Slide-up entrance animation
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
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
  const assembledHabit =
    form.habitAction.trim() && form.habitMinutes.trim()
      ? `Every day, I will ${form.habitAction.trim()} for ${form.habitMinutes.trim()} minutes`
      : "";
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

      // Persist any non-user obstacles to the backend first (await each one so
      // we have a valid backendId before goal creation begins).
      let obstacleTemplateId: bigint | undefined;
      for (const obs of form.selectedObstacles) {
        if (obs.kind === "user" && obs.backendId !== undefined) {
          // Already persisted — use its ID for the goal link
          if (obstacleTemplateId === undefined)
            obstacleTemplateId = obs.backendId;
        } else {
          // builtin or custom — create it now and capture the returned ID
          try {
            const created = await actor.createObstacleTemplate({
              title: obs.label,
              description: "",
            });
            if (obstacleTemplateId === undefined)
              obstacleTemplateId = created.id;
          } catch {
            // Non-fatal — obstacle template creation failure shouldn't block goal creation
            console.error("Failed to persist obstacle template:", obs.label);
          }
        }
      }

      return await actor.createGoal({
        wish: assembledWish,
        wishDescription: assembledHabit,
        outcome: assembledObstacles,
        obstacleTemplateId,
        ifThenPlan: form.ifThenPlan.trim(),
        iconName: form.iconName || undefined,
        themeColor: form.themeColor || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["myGoals"],
        refetchType: "all",
      });
      await queryClient.refetchQueries({ queryKey: ["myGoals"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Commitment made! Your habit is on the dashboard.", {
        description: assembledHabit,
        duration: 5000,
      });
      onGoalCreated?.();
      handleClose();
    },
    onError: (error: Error) => {
      const msg = error.message?.toLowerCase() ?? "";
      if (
        msg.includes("limitreached") ||
        msg.includes("limit reached") ||
        msg.includes("goal limit")
      ) {
        setShowLimitModal(true);
      } else {
        toast.error("Failed to create goal. Please try again.", {
          description: error.message,
        });
      }
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
      if (!form.habitMinutes.trim()) e.habitMinutes = "How many minutes?";
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

  const uniqueUserObstacles = userObstacles
    .filter(
      (o) =>
        !presetIds.has(String(o.id)) &&
        !OBSTACLE_TEMPLATES.some(
          (t) => t.label.toLowerCase() === o.title.toLowerCase(),
        ),
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
              WOOP Goal Builder
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
                          setForm((f) => ({
                            ...f,
                            goalAction: e.target.value,
                          }));
                          setErrors((er) => ({ ...er, goalAction: undefined }));
                        }}
                        placeholder="run a marathon"
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
                          setForm((f) => ({
                            ...f,
                            goalReason: e.target.value,
                          }));
                          setErrors((er) => ({ ...er, goalReason: undefined }));
                        }}
                        placeholder="feel unstoppable"
                        className="input-neumorphic flex-1 min-w-32 text-foreground text-xl font-medium"
                        aria-label="Your deeper reason"
                      />
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
                          setForm((f) => ({
                            ...f,
                            habitAction: e.target.value,
                          }));
                          setErrors((er) => ({
                            ...er,
                            habitAction: undefined,
                          }));
                        }}
                        placeholder="run"
                        className="input-neumorphic flex-1 min-w-24 text-foreground text-xl font-medium"
                        aria-label="Daily habit action"
                      />
                      <span className="text-muted-foreground shrink-0">
                        for
                      </span>
                      <input
                        data-ocid="woop_wizard.habit_minutes_input"
                        value={form.habitMinutes}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            habitMinutes: e.target.value,
                          }));
                          setErrors((er) => ({
                            ...er,
                            habitMinutes: undefined,
                          }));
                        }}
                        placeholder="15"
                        inputMode="numeric"
                        className="input-neumorphic w-20 text-foreground text-xl font-medium text-center"
                        aria-label="Minutes per day"
                      />
                      <span className="text-muted-foreground shrink-0">
                        minutes
                      </span>
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
                    return (
                      <button
                        key={obs.id}
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
                  <p className="text-sm font-mono tracking-widest text-muted-foreground uppercase">
                    If this happens…
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-mono tracking-widest text-muted-foreground uppercase">
                    Then I will…
                  </p>
                  <div className="rounded-2xl border border-border/20 bg-muted/30 p-5 shadow-neumorphic-inset space-y-3">
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      IF "{primaryObstacle ? primaryObstacle : "[obstacle]"}",
                    </p>
                    <div className="flex items-start gap-3">
                      <span className="text-lg text-muted-foreground shrink-0 mt-2">
                        THEN I will
                      </span>
                      <Textarea
                        data-ocid="woop_wizard.if_then_plan_input"
                        value={form.ifThenPlan}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            ifThenPlan: e.target.value,
                          }));
                          setErrors((er) => ({ ...er, ifThenPlan: undefined }));
                        }}
                        placeholder="do a 15-min home workout instead"
                        rows={4}
                        className="flex-1 bg-transparent border-0 p-0 resize-none text-foreground text-lg focus:ring-0 focus:outline-none placeholder:text-muted-foreground/60 shadow-none"
                        aria-label="Your if-then backup plan"
                      />
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
                      Daily Habit — what you'll see on your dashboard
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
            disabled={createGoalMutation.isPending || (step === 4 && !actor)}
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

      <TierLimitModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        userProfile={userProfile ?? null}
      />
    </>
  );
}
