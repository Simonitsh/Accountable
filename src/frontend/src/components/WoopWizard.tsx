import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ObstacleTemplate as BackendObstacleTemplate } from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";
import { useUserProfile } from "../hooks/useUserProfile";
import { OBSTACLE_TEMPLATES } from "../types";
import TierLimitModal from "./TierLimitModal";

interface WoopWizardProps {
  open: boolean;
  onClose: () => void;
  onGoalCreated?: () => void;
}

// Discriminated union so we always know whether the selected obstacle
// has a valid backend bigint ID (user-created) or is frontend-only (built-in).
type SelectedObstacle =
  | { kind: "builtin"; id: string; label: string }
  | { kind: "user"; id: bigint; label: string }
  | null;

interface FormData {
  wish: string;
  wishDescription: string;
  outcome: string;
  /** Tracks the currently selected obstacle — null means nothing selected yet. */
  selectedObstacle: SelectedObstacle;
  newObstacleTitle: string;
  newObstacleDescription: string;
  ifThenPlan: string;
}

type FormErrors = Partial<
  Record<
    "wish" | "wishDescription" | "outcome" | "selectedObstacle" | "ifThenPlan",
    string
  >
>;

const STEPS = [
  { id: 1, label: "Wish" },
  { id: 2, label: "Outcome" },
  { id: 3, label: "Obstacle" },
  { id: 4, label: "Plan" },
];

const BEHAVIORAL_TIPS: Record<number, { title: string; tip: string }> = {
  1: {
    title: "Your Wish",
    tip: "A specific, challenging but achievable wish is the foundation of behavior change. Be bold — what do you truly want?",
  },
  2: {
    title: "Best Outcome",
    tip: "Vividly imagining your best outcome energizes motivation. Close your eyes and picture what success feels like.",
  },
  3: {
    title: "Inner Obstacle",
    tip: "Unlike wishful thinking, WOOP asks you to identify what *inside you* might get in the way — not external barriers.",
  },
  4: {
    title: "If-Then Plan",
    tip: "Implementation intentions turn goals into habits. When you encounter your obstacle, this plan is your autopilot.",
  },
};

const EMPTY_FORM: FormData = {
  wish: "",
  wishDescription: "",
  outcome: "",
  selectedObstacle: null,
  newObstacleTitle: "",
  newObstacleDescription: "",
  ifThenPlan: "",
};

export default function WoopWizard({
  open,
  onClose,
  onGoalCreated,
}: WoopWizardProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [animating, setAnimating] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showNewObstacle, setShowNewObstacle] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { actor, isFetching } = useBackend();
  const { data: userProfile } = useUserProfile();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // Fetch user-created obstacle templates from the backend.
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

  // Pre-fill the If-Then plan when advancing to step 4.
  const selectedLabel = form.selectedObstacle?.label ?? "";
  useEffect(() => {
    if (step !== 4) return;
    setForm((prev) => {
      if (prev.ifThenPlan) return prev;
      return {
        ...prev,
        ifThenPlan: selectedLabel
          ? `If ${selectedLabel.toLowerCase()}, then I will `
          : "",
      };
    });
  }, [step, selectedLabel]);

  const createObstacleMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      if (!actor || !("createObstacleTemplate" in actor))
        throw new Error("Actor not available");
      return await actor.createObstacleTemplate({
        title: data.title,
        description: data.description,
      });
    },
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["obstacleTemplates"] });
      setForm((f) => ({
        ...f,
        selectedObstacle: {
          kind: "user",
          id: newTemplate.id,
          label: newTemplate.title,
        },
        newObstacleTitle: "",
        newObstacleDescription: "",
      }));
      setShowNewObstacle(false);
    },
    onError: (err: Error) => {
      console.error("[WoopWizard] createObstacleMutation error:", err);
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: async () => {
      // actor must be present — it IS the authenticated actor
      if (!actor) throw new Error("Actor not ready — please wait and retry.");

      const { selectedObstacle } = form;

      // Only pass obstacleTemplateId when the user selected a backend-persisted
      // obstacle (kind === "user") that has a valid bigint ID.
      // The backend.ts wrapper converts undefined → [] and bigint → [bigint].
      const obstacleTemplateId: bigint | undefined =
        selectedObstacle?.kind === "user" ? selectedObstacle.id : undefined;

      const request = {
        wish: form.wish.trim(),
        wishDescription: form.wishDescription.trim(),
        outcome: form.outcome.trim(),
        obstacleTemplateId,
        ifThenPlan: form.ifThenPlan.trim(),
      };

      console.log("[WoopWizard] createGoal request:", request);
      return await actor.createGoal(request);
    },
    onSuccess: (result) => {
      console.log("[WoopWizard] createGoal success:", result);
      queryClient.invalidateQueries({ queryKey: ["myGoals"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Goal created! 🎯 Your WOOP habit is ready.", {
        description: `"${form.wish.trim()}" added to your dashboard.`,
        duration: 5000,
      });
      onGoalCreated?.();
      handleClose();
    },
    onError: (error: Error) => {
      console.error("[WoopWizard] createGoal error:", error);
      if (
        error.message?.includes("limitReached") ||
        error.message?.includes("limit")
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
    setForm(EMPTY_FORM);
    setErrors({});
    setShowNewObstacle(false);
    onClose();
  }, [onClose]);

  const validateStep = (s: number): boolean => {
    const newErrors: FormErrors = {};
    if (s === 1) {
      if (!form.wish.trim()) newErrors.wish = "Please name your wish.";
      if (!form.wishDescription.trim())
        newErrors.wishDescription = "Please describe your wish.";
    }
    if (s === 2 && !form.outcome.trim()) {
      newErrors.outcome = "Please describe your best outcome.";
    }
    if (s === 3 && !form.selectedObstacle && !showNewObstacle) {
      newErrors.selectedObstacle = "Please select or create an obstacle.";
    }
    if (s === 4 && !form.ifThenPlan.trim()) {
      newErrors.ifThenPlan = "Please write your if-then plan.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step === 4) {
      createGoalMutation.mutate();
      return;
    }
    setDirection("forward");
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 220);
  };

  const goBack = () => {
    if (step === 1) return;
    setDirection("backward");
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setAnimating(false);
    }, 220);
  };

  const handleSaveNewObstacle = () => {
    if (!form.newObstacleTitle.trim()) return;

    if (!actor || !("createObstacleTemplate" in actor)) {
      // No backend connection — store as local entry so user can proceed
      setForm((f) => ({
        ...f,
        selectedObstacle: {
          kind: "builtin",
          id: `local_${Date.now()}`,
          label: f.newObstacleTitle.trim(),
        },
        newObstacleTitle: "",
        newObstacleDescription: "",
      }));
      setShowNewObstacle(false);
      return;
    }
    createObstacleMutation.mutate({
      title: form.newObstacleTitle,
      description: form.newObstacleDescription,
    });
  };

  if (!open) return null;

  const tip = BEHAVIORAL_TIPS[step];
  const slideClass = animating
    ? direction === "forward"
      ? "opacity-0 translate-x-4"
      : "opacity-0 -translate-x-4"
    : "opacity-100 translate-x-0";

  // Determine selected obstacle key for comparison in the UI
  const selectedKey =
    form.selectedObstacle?.kind === "builtin"
      ? form.selectedObstacle.id
      : form.selectedObstacle?.kind === "user"
        ? String(form.selectedObstacle.id)
        : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Dialog */}
      <dialog
        aria-modal="true"
        aria-label="WOOP Goal Builder"
        data-ocid="woop_wizard.dialog"
        open
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg w-full mx-auto max-h-[90dvh] flex flex-col rounded-2xl bg-card border border-border shadow-neumorphic-emboss-dark overflow-hidden p-0 m-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div>
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              WOOP Goal Builder
            </p>
            <h2 className="text-lg font-display font-semibold text-foreground leading-tight mt-0.5">
              {tip.title}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            data-ocid="woop_wizard.close_button"
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Step progress — compact horizontal stepper */}
        <div
          className="flex items-center w-full px-5 py-2.5 shrink-0"
          aria-label={`Step ${step} of ${STEPS.length}`}
        >
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              {/* Step dot + label stacked */}
              <div className="flex flex-col items-center gap-0.5 shrink-0 w-10">
                <div
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold transition-all duration-200 border ${
                    step > s.id
                      ? "border-transparent text-primary-foreground"
                      : step === s.id
                        ? "border-primary text-primary-foreground"
                        : "bg-muted/60 border-border text-muted-foreground"
                  }`}
                  style={
                    step > s.id
                      ? {
                          backgroundColor: "oklch(var(--color-accent-success))",
                          boxShadow:
                            "0 0 8px oklch(var(--color-accent-success) / 0.4)",
                        }
                      : step === s.id
                        ? {
                            backgroundColor:
                              "oklch(var(--color-accent-success))",
                            borderColor: "oklch(var(--color-accent-success))",
                          }
                        : undefined
                  }
                  data-ocid={`woop_wizard.step_indicator.${s.id}`}
                >
                  {step > s.id ? <Check size={8} /> : s.id}
                </div>
                <span
                  className={`text-[8px] font-medium leading-none transition-colors duration-200 text-center ${
                    step === s.id
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-0.5 transition-all duration-300 ${
                    step > s.id ? "bg-primary/70" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div
          className={`flex-1 overflow-y-auto px-5 py-4 transition-all duration-200 ${slideClass}`}
        >
          {/* Behavioral tip */}
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed border-l-2 border-primary/40 pl-3 italic">
            {tip.tip}
          </p>

          {/* Step 1: Wish */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wish" className="text-foreground font-medium">
                  Goal Name
                </Label>
                <Input
                  id="wish"
                  data-ocid="woop_wizard.wish_input"
                  placeholder="e.g. Daily 30-minute deep work session"
                  value={form.wish}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, wish: e.target.value }))
                  }
                  className="bg-muted/60 border-border focus:border-primary"
                />
                {errors.wish && (
                  <p
                    className="text-xs text-destructive"
                    data-ocid="woop_wizard.wish.field_error"
                  >
                    {errors.wish}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Keep it short, specific, and motivating.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="wishDescription"
                  className="text-foreground font-medium"
                >
                  Describe Your Wish
                </Label>
                <Textarea
                  id="wishDescription"
                  data-ocid="woop_wizard.wish_description_input"
                  placeholder="What does this habit look like in practice? How often? When?"
                  value={form.wishDescription}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, wishDescription: e.target.value }))
                  }
                  rows={3}
                  className="bg-muted/60 border-border focus:border-primary resize-none"
                />
                {errors.wishDescription && (
                  <p
                    className="text-xs text-destructive"
                    data-ocid="woop_wizard.wish_description.field_error"
                  >
                    {errors.wishDescription}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Be as vivid and specific as possible to increase commitment.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Outcome */}
          {step === 2 && (
            <div className="space-y-1.5">
              <Label htmlFor="outcome" className="text-foreground font-medium">
                Best Outcome
              </Label>
              <Textarea
                id="outcome"
                data-ocid="woop_wizard.outcome_input"
                placeholder="What is the best possible outcome? How would you feel? What would change in your life?"
                value={form.outcome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, outcome: e.target.value }))
                }
                rows={5}
                className="bg-muted/60 border-border focus:border-primary resize-none"
              />
              {errors.outcome && (
                <p
                  className="text-xs text-destructive"
                  data-ocid="woop_wizard.outcome.field_error"
                >
                  {errors.outcome}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Picture the most positive outcome you can imagine. Write it as
                if it&apos;s already happened.
              </p>
            </div>
          )}

          {/* Step 3: Obstacle */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground mb-1">
                What might get in the way?
              </p>
              <div
                className="grid grid-cols-2 gap-2"
                data-ocid="woop_wizard.obstacle_list"
              >
                {/* Built-in obstacle templates */}
                {OBSTACLE_TEMPLATES.map((o) => (
                  <button
                    type="button"
                    key={o.id}
                    data-ocid={`woop_wizard.obstacle.${o.id}`}
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        selectedObstacle: {
                          kind: "builtin",
                          id: o.id,
                          label: o.label,
                        },
                      }));
                      setShowNewObstacle(false);
                      setErrors((e) => ({ ...e, selectedObstacle: undefined }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setForm((f) => ({
                          ...f,
                          selectedObstacle: {
                            kind: "builtin",
                            id: o.id,
                            label: o.label,
                          },
                        }));
                        setShowNewObstacle(false);
                        setErrors((errs) => ({
                          ...errs,
                          selectedObstacle: undefined,
                        }));
                      }
                    }}
                    className={`text-left p-3 rounded-xl border transition-smooth text-sm ${
                      selectedKey === o.id
                        ? "border-primary bg-primary/10 shadow-glow-success"
                        : "border-border bg-muted/40 hover:border-primary/50 hover:bg-muted/60"
                    }`}
                  >
                    <span className="block font-medium text-foreground leading-tight">
                      {o.label}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {o.description}
                    </span>
                  </button>
                ))}

                {/* User-created obstacle templates from the backend */}
                {userObstacles.map((o) => (
                  <button
                    type="button"
                    key={String(o.id)}
                    data-ocid={`woop_wizard.obstacle.user_${String(o.id)}`}
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        selectedObstacle: {
                          kind: "user",
                          id: o.id,
                          label: o.title,
                        },
                      }));
                      setShowNewObstacle(false);
                      setErrors((e) => ({ ...e, selectedObstacle: undefined }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setForm((f) => ({
                          ...f,
                          selectedObstacle: {
                            kind: "user",
                            id: o.id,
                            label: o.title,
                          },
                        }));
                        setShowNewObstacle(false);
                        setErrors((errs) => ({
                          ...errs,
                          selectedObstacle: undefined,
                        }));
                      }
                    }}
                    className={`text-left p-3 rounded-xl border transition-smooth text-sm ${
                      selectedKey === String(o.id)
                        ? "border-primary bg-primary/10 shadow-glow-success"
                        : "border-border bg-muted/40 hover:border-primary/50 hover:bg-muted/60"
                    }`}
                  >
                    <span className="block font-medium text-foreground leading-tight">
                      {o.title}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {o.description}
                    </span>
                  </button>
                ))}

                {/* Add new obstacle tile */}
                <button
                  type="button"
                  data-ocid="woop_wizard.add_obstacle_button"
                  onClick={() => {
                    setShowNewObstacle((v) => !v);
                    setForm((f) => ({ ...f, selectedObstacle: null }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowNewObstacle((v) => !v);
                      setForm((f) => ({ ...f, selectedObstacle: null }));
                    }
                  }}
                  className={`text-left p-3 rounded-xl border border-dashed transition-smooth text-sm ${
                    showNewObstacle
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-muted/20 hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <Plus size={13} /> Define your own
                  </span>
                  <span className="block text-xs text-muted-foreground/70 mt-0.5">
                    Name your personal obstacle
                  </span>
                </button>
              </div>

              {/* Inline new obstacle form */}
              {showNewObstacle && (
                <div className="rounded-xl border border-primary/30 bg-muted/40 p-3 space-y-2">
                  <Input
                    data-ocid="woop_wizard.new_obstacle_title_input"
                    placeholder="Obstacle name (e.g. Perfectionism)"
                    value={form.newObstacleTitle}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        newObstacleTitle: e.target.value,
                      }))
                    }
                    className="bg-background border-border text-sm"
                  />
                  <Textarea
                    data-ocid="woop_wizard.new_obstacle_description_input"
                    placeholder="Describe when this obstacle shows up..."
                    value={form.newObstacleDescription}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        newObstacleDescription: e.target.value,
                      }))
                    }
                    rows={2}
                    className="bg-background border-border text-sm resize-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    data-ocid="woop_wizard.save_obstacle_button"
                    onClick={handleSaveNewObstacle}
                    disabled={
                      !form.newObstacleTitle.trim() ||
                      createObstacleMutation.isPending
                    }
                    className="button-primary-neon w-full"
                  >
                    {createObstacleMutation.isPending
                      ? "Saving..."
                      : "Save Obstacle"}
                  </Button>
                </div>
              )}

              {errors.selectedObstacle && (
                <p
                  className="text-xs text-destructive"
                  data-ocid="woop_wizard.obstacle.field_error"
                >
                  {errors.selectedObstacle}
                </p>
              )}
            </div>
          )}

          {/* Step 4: Plan */}
          {step === 4 && (
            <div className="space-y-1.5">
              <Label
                htmlFor="ifThenPlan"
                className="text-foreground font-medium"
              >
                Your If-Then Plan
              </Label>
              <Textarea
                id="ifThenPlan"
                data-ocid="woop_wizard.if_then_plan_input"
                placeholder="If [obstacle], then I will..."
                value={form.ifThenPlan}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ifThenPlan: e.target.value }))
                }
                rows={5}
                className="bg-muted/60 border-border focus:border-primary resize-none font-mono text-sm"
              />
              {errors.ifThenPlan && (
                <p
                  className="text-xs text-destructive"
                  data-ocid="woop_wizard.if_then_plan.field_error"
                >
                  {errors.ifThenPlan}
                </p>
              )}
              {createGoalMutation.isError &&
                !createGoalMutation.error?.message?.includes("limit") && (
                  <p
                    className="text-xs text-destructive mt-1"
                    data-ocid="woop_wizard.create_goal.error_state"
                  >
                    Something went wrong. Please try again.
                  </p>
                )}
              {!actor && (
                <p
                  className="text-xs text-muted-foreground mt-1"
                  data-ocid="woop_wizard.actor_loading_state"
                >
                  Connecting to backend…
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                The more specific your plan, the more automatic your response
                becomes. Research shows this doubles follow-through.
              </p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0 bg-card">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-ocid="woop_wizard.back_button"
            onClick={goBack}
            disabled={step === 1}
            className="gap-1.5"
          >
            <ChevronLeft size={15} />
            Back
          </Button>

          <span className="text-xs font-mono text-muted-foreground">
            {step} / {STEPS.length}
          </span>

          <Button
            type="button"
            size="sm"
            data-ocid={
              step === 4
                ? "woop_wizard.create_goal_button"
                : "woop_wizard.next_button"
            }
            onClick={goNext}
            disabled={createGoalMutation.isPending || (step === 4 && !actor)}
            className="gap-1.5 button-primary-neon"
          >
            {step === 4 ? (
              createGoalMutation.isPending ? (
                <>
                  <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Check size={14} />
                  Create Goal
                </>
              )
            ) : (
              <>
                Next
                <ChevronRight size={15} />
              </>
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
