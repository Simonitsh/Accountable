import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { MacroGoalPublic, ReusableGoalPublic } from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";
import { CATEGORY_DETAILS, type GoalCategory } from "../types/index";
import { GOAL_ICONS } from "../utils/goalIcons";

/**
 * GoalWizard — a dedicated goal-creation wizard with the Bloom & Flow
 * animation system. Visually distinct from the WOOP habit wizard:
 *   - Fraunces serif display font (--font-goal-wizard)
 *   - Emerald→gold gradient accents (--goal-wizard-gradient)
 *   - Blooming category tiles (goal-wizard-bloom keyframe)
 *   - Flowing SVG progress path that draws itself between steps
 *     (goal-wizard-path-draw + goal-wizard-path-pulse)
 *   - Animated text reveals as fields fill (goal-wizard-text-reveal +
 *     goal-wizard-underline-grow)
 *   - Step content settles in like a petal unfolding
 *     (goal-wizard-step-settle)
 *
 * Captures: category, wish, outcome (wishDescription) — extensible for more
 * inputs later. On submit calls actor.createMacroGoal() with
 * CreateMacroGoalRequest (category, wish, wishDescription as outcome,
 * iconName). Goals use a fixed gold accent (same as the dashboard goal
 * header) and have no selectable color. The backend's CreateMacroGoalRequest
 * has an `outcome` field; this wizard maps the user's "outcome" input to that
 * field and leaves `wishDescription` as a short summary derived from the wish.
 */

const TOTAL_STEPS = 4;

const STEPS = [
  { id: 1, label: "Bloom" },
  { id: 2, label: "Wish" },
  { id: 3, label: "Outcome" },
  { id: 4, label: "Confirm" },
] as const;

interface GoalWizardProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new goal's id (as a string) after a successful create. */
  onGoalCreated?: (goalId?: string) => void;
  /** Existing reusable goals — used for optional dedup hints. */
  existingGoals?: ReusableGoalPublic[];
}

interface FormState {
  category: GoalCategory | "";
  wish: string;
  outcome: string;
  iconName: string;
}

type StepError = Partial<Record<"category" | "wish" | "outcome", string>>;

const EMPTY: FormState = {
  category: "",
  wish: "",
  outcome: "",
  iconName: "target",
};

/**
 * Suggests an existing goal whose wish shares enough words with the user's
 * in-progress wish to be a likely duplicate. Returns the matching goal's wish
 * text so the UI can show a gentle "you already have a similar goal" hint.
 * Purely a heuristic — never blocks submission.
 */
function findSimilarGoal(
  existing: ReusableGoalPublic[],
  wish: string,
): string | null {
  const trimmed = wish.trim().toLowerCase();
  if (trimmed.length < 8) return null;
  const words = new Set(
    trimmed.split(/\s+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
  );
  if (words.size < 2) return null;
  for (const g of existing) {
    const goalWords = new Set(
      g.wish
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
    );
    let overlap = 0;
    for (const w of words) if (goalWords.has(w)) overlap += 1;
    if (overlap >= 2) return g.wish;
  }
  return null;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "from",
  "have",
  "want",
  "will",
  "your",
  "their",
  "they",
  "them",
  "what",
  "when",
  "then",
  "than",
  "into",
  "some",
  "more",
  "most",
  "such",
  "very",
  "just",
  "also",
]);

export default function GoalWizard({
  open,
  onClose,
  onGoalCreated,
  existingGoals = [],
}: GoalWizardProps) {
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [animDir, setAnimDir] = useState<"fwd" | "bwd">("fwd");
  const [animating, setAnimating] = useState(false);
  const [errors, setErrors] = useState<StepError>({});
  const [form, setForm] = useState<FormState>(EMPTY);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stepOneRef = useRef<HTMLButtonElement | null>(null);
  const wishInputRef = useRef<HTMLInputElement | null>(null);
  const outcomeInputRef = useRef<HTMLInputElement | null>(null);
  const confirmButtonRef = useRef<HTMLSpanElement | null>(null);

  const { actor } = useBackend();
  const queryClient = useQueryClient();

  // ── Mount / reset lifecycle ──────────────────────────────────────────────
  // Slide-up entrance + full reset every time the wizard opens so state
  // never leaks between sessions.
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    setForm(EMPTY);
    setStep(1);
    setErrors({});
    setShowExitConfirm(false);
    setAnimDir("fwd");
    setAnimating(false);
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

  // Scroll content back to top on step change
  useEffect(() => {
    void step;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [step]);

  // ── Focus management ─────────────────────────────────────────────────────
  // Move focus into each step's primary control when the step becomes active.
  // Runs after the slide animation settles so focus doesn't fight the motion.
  useEffect(() => {
    if (!open || !mounted) return;
    const t = setTimeout(() => {
      if (step === 1) {
        stepOneRef.current?.focus();
      } else if (step === 2) {
        wishInputRef.current?.focus();
      } else if (step === 3) {
        outcomeInputRef.current?.focus();
      } else if (step === 4) {
        confirmButtonRef.current?.focus();
      }
    }, 220);
    return () => clearTimeout(t);
  }, [step, open, mounted]);

  // ── Dedup hint ────────────────────────────────────────────────────────────
  const similarGoalWish = useMemo(
    () => findSimilarGoal(existingGoals, form.wish),
    [existingGoals, form.wish],
  );

  // ── Mutation ──────────────────────────────────────────────────────────────
  const createGoalMutation = useMutation({
    mutationFn: async (): Promise<MacroGoalPublic> => {
      if (!actor) throw new Error("Actor not ready — please wait and retry.");
      const created = await actor.createMacroGoal({
        category: form.category as GoalCategory,
        wish: form.wish.trim(),
        // The backend's wishDescription is a short summary; we use the
        // outcome text the user entered as the wishDescription so the goal
        // carries the user's desired outcome alongside the wish.
        wishDescription: form.outcome.trim(),
        outcome: form.outcome.trim(),
        iconName: form.iconName || undefined,
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
      toast.success("Goal created! Watch it bloom on your dashboard.", {
        description: form.wish.trim(),
        duration: 5000,
      });
      const goalIdStr = data?.id !== undefined ? String(data.id) : undefined;
      onGoalCreated?.(goalIdStr);
      handleClose();
    },
    onError: (error: Error) => {
      toast.error("Failed to create your goal. Please try again.", {
        description: error.message,
      });
    },
  });

  const handleClose = useCallback(() => {
    setStep(1);
    setForm(EMPTY);
    setErrors({});
    setShowExitConfirm(false);
    onClose();
  }, [onClose]);

  const isFormDirty = useCallback((): boolean => {
    if (step > 1) return true;
    return (
      form.category !== EMPTY.category ||
      form.wish !== EMPTY.wish ||
      form.outcome !== EMPTY.outcome ||
      form.iconName !== EMPTY.iconName
    );
  }, [step, form]);

  const requestClose = useCallback(() => {
    if (isFormDirty()) {
      setShowExitConfirm(true);
    } else {
      handleClose();
    }
  }, [isFormDirty, handleClose]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (s: number): boolean => {
    const e: StepError = {};
    if (s === 1 && !form.category) {
      e.category = "Choose a domain for your goal to bloom.";
    }
    if (s === 2 && !form.wish.trim()) {
      e.wish = "Name the goal you want to grow.";
    }
    if (s === 3 && !form.outcome.trim()) {
      e.outcome = "Describe the outcome you are reaching for.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = (dir: "fwd" | "bwd") => {
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => (dir === "fwd" ? s + 1 : s - 1));
      setAnimating(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, 200);
  };

  const goNext = () => {
    if (step === TOTAL_STEPS) {
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

  // ── Keyboard navigation ────────────────────────────────────────────────────
  // ArrowRight / Enter advance, ArrowLeft goes back, Escape requests close.
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Don't hijack typing inside inputs/textareas (Enter should submit fields
    // normally; ArrowRight moves the caret). Only handle when focus is on a
    // non-text control or the wizard shell itself.
    const target = e.target as HTMLElement;
    const isTextControl =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;
    if (isTextControl) {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
      return;
    }
    if (e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goBack();
    } else if (e.key === "Escape") {
      e.preventDefault();
      requestClose();
    }
  };

  if (!open) return null;

  const slideClass = animating
    ? animDir === "fwd"
      ? "opacity-0 translate-x-6"
      : "opacity-0 -translate-x-6"
    : "opacity-100 translate-x-0";

  const selectedCategory = CATEGORY_DETAILS.find((c) => c.id === form.category);

  return (
    <>
      {/* Full-screen takeover — slides up from the bottom. Distinct from
          WoopWizard: warmer --goal-wizard-surface background, Fraunces font
          via .goal-wizard-root, emerald→gold gradient accents. */}
      <dialog
        open
        aria-modal="true"
        aria-label="Goal creation wizard"
        data-ocid="goal_wizard.dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") requestClose();
        }}
        style={{
          transform: mounted ? "translateY(0)" : "translateY(100%)",
          transition: "transform 420ms cubic-bezier(0.32, 0.72, 0, 1)",
          background: "oklch(var(--goal-wizard-surface))",
        }}
        className="goal-wizard-root fixed inset-0 z-[300] flex flex-col overflow-hidden w-full max-w-none h-full max-h-none m-0 p-0 border-0 rounded-none"
      >
        {/* ── Header: title + circle-based step indicator ────────────────── */}
        <div
          className="shrink-0 px-6 pt-2 pb-3"
          aria-label={`Step ${step} of ${TOTAL_STEPS}`}
        >
          <div className="flex items-center justify-between max-w-2xl mx-auto mb-3">
            <div className="flex items-center gap-2">
              <Sparkles
                size={18}
                style={{ color: "oklch(var(--goal-wizard-gold))" }}
                aria-hidden="true"
              />
              <h2
                className="text-xl font-semibold tracking-tight"
                style={{
                  fontFamily: "var(--font-goal-wizard)",
                  color: "oklch(var(--foreground))",
                }}
              >
                Bloom a New Goal
              </h2>
            </div>
            <span
              className="text-xs font-mono tracking-widest uppercase"
              style={{ color: "oklch(var(--muted-foreground))" }}
            >
              {step} / {TOTAL_STEPS}
            </span>
          </div>

          {/* Circle-based step indicator — mirrors the habit wizard's
              (WoopWizard) structure exactly but themed GOLD instead of green.
              A background track spans the circles, a gold progress track grows
              toward the current step, and each step renders a numbered circle
              that fills gold when complete, rings gold when active, and stays
              muted when upcoming. */}
          <div
            className="relative flex items-center max-w-2xl mx-auto"
            data-ocid="goal_wizard.step_indicator"
          >
            {/* Background track — starts at the leftmost edge of the first
                circle and ends at the rightmost edge of the last circle.
                Each circle is 40px (w-10) centered in its flex-1 column
                (25% of width), so the first circle's left edge is at
                calc(12.5% - 20px) and the last circle's right edge is at
                calc(87.5% + 20px). */}
            <div
              className="absolute h-[2px] top-10 rounded-full"
              style={{
                left: "calc(12.5% - 20px)",
                right: "calc(12.5% - 20px)",
                background: "oklch(var(--color-accent-missed) / 0.18)",
              }}
              aria-hidden="true"
            />
            {/* Progress track — same start as the background track, grows from
                the first circle's left edge toward the current step. */}
            <div
              className="absolute h-[2px] top-10 rounded-full transition-all duration-500 ease-out"
              style={{
                left: "calc(12.5% - 20px)",
                right: `calc(${(TOTAL_STEPS - step) * (100 / TOTAL_STEPS)}% + 20px)`,
                background: "oklch(var(--goal-wizard-gold))",
                boxShadow: "0 0 8px 1px oklch(var(--goal-wizard-gold) / 0.45)",
              }}
              aria-hidden="true"
            />
            {STEPS.map((s) => {
              const isActive = step === s.id;
              const isComplete = step > s.id;
              return (
                <div
                  key={s.id}
                  data-ocid={`goal_wizard.step_indicator.${s.id}`}
                  className="relative z-10 flex-1 flex flex-col items-center gap-2"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-bold text-sm"
                    style={
                      isComplete
                        ? {
                            backgroundColor: "oklch(var(--goal-wizard-gold))",
                            color: "oklch(0.12 0 0)",
                            boxShadow:
                              "0 0 16px 3px oklch(var(--goal-wizard-gold) / 0.55)",
                          }
                        : isActive
                          ? {
                              backgroundColor:
                                "oklch(var(--goal-wizard-gold) / 0.15)",
                              border:
                                "2.5px solid oklch(var(--goal-wizard-gold))",
                              color: "oklch(var(--goal-wizard-gold))",
                              boxShadow:
                                "0 0 20px 4px oklch(var(--goal-wizard-gold) / 0.3)",
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
                        ? { color: "oklch(var(--goal-wizard-gold) / 0.7)" }
                        : isActive
                          ? {
                              color: "oklch(var(--goal-wizard-gold))",
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

        {/* ── Scrollable step content ─────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          onKeyDown={handleKeyDown}
        >
          <div
            className={`max-w-2xl mx-auto px-6 sm:px-10 pt-6 pb-10 transition-all duration-200 ${slideClass}`}
          >
            {/* STEP 1 — Category selection with blooming tiles ───────────── */}
            {step === 1 && (
              <motion.div
                className="space-y-8"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.48,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                <p
                  className="text-lg leading-relaxed pl-4 italic"
                  style={{
                    fontFamily: "var(--font-goal-wizard)",
                    color: "oklch(var(--muted-foreground))",
                    borderLeft:
                      "3px solid oklch(var(--goal-wizard-gold) / 0.5)",
                  }}
                >
                  Every goal begins as a seed. Choose the domain where yours
                  will take root.
                </p>

                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  data-ocid="goal_wizard.category_select"
                >
                  {CATEGORY_DETAILS.map((cat, idx) => {
                    const isSelected = form.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        ref={idx === 0 ? stepOneRef : undefined}
                        type="button"
                        data-ocid={`goal_wizard.category.${cat.id.toLowerCase()}`}
                        onClick={() => {
                          setForm((f) => ({ ...f, category: cat.id }));
                          setErrors((er) => ({
                            ...er,
                            category: undefined,
                          }));
                        }}
                        aria-pressed={isSelected}
                        className={`relative w-full text-left rounded-2xl p-5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isSelected ? "animate-goal-wizard-bloom" : ""}`}
                        style={{
                          background: isSelected
                            ? "oklch(var(--goal-wizard-surface))"
                            : "oklch(var(--muted) / 0.5)",
                          border: isSelected
                            ? "1px solid oklch(var(--goal-wizard-gold) / 0.5)"
                            : "1px solid oklch(var(--border))",
                          boxShadow: isSelected
                            ? "0 0 0 3px oklch(var(--goal-wizard-gold) / 0.5), 0 0 12px 1px oklch(var(--goal-wizard-gold) / 0.18), -4px -4px 10px rgba(80,80,85,0.4), 6px 6px 14px rgba(0,0,0,0.7)"
                            : "-4px -4px 10px rgba(80,80,85,0.35), 6px 6px 14px rgba(0,0,0,0.7)",
                          // focus ring offset color matches the surface
                          ["--tw-ring-offset-color" as string]:
                            "oklch(var(--goal-wizard-surface))",
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <span
                            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300"
                            style={{
                              background: isSelected
                                ? "oklch(var(--goal-wizard-emerald) / 0.18)"
                                : "oklch(var(--background) / 0.5)",
                              border: isSelected
                                ? "1.5px solid oklch(var(--goal-wizard-emerald) / 0.6)"
                                : "1px solid oklch(var(--border))",
                              color: isSelected
                                ? "oklch(var(--goal-wizard-emerald))"
                                : "oklch(var(--muted-foreground))",
                            }}
                            aria-hidden="true"
                          >
                            <cat.icon size={22} strokeWidth={1.5} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <h3
                              className="text-xl font-semibold mb-1"
                              style={{
                                fontFamily: "var(--font-goal-wizard)",
                                color: isSelected
                                  ? "oklch(var(--goal-wizard-emerald))"
                                  : "oklch(var(--foreground))",
                              }}
                            >
                              {cat.title}
                            </h3>
                            <p
                              className="text-sm leading-relaxed"
                              style={{
                                color: "oklch(var(--muted-foreground))",
                              }}
                            >
                              {cat.description}
                            </p>
                          </div>
                          {isSelected && (
                            <span
                              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor:
                                  "oklch(var(--goal-wizard-emerald))",
                                boxShadow:
                                  "0 0 8px oklch(var(--goal-wizard-emerald) / 0.5)",
                              }}
                            >
                              <Check
                                size={14}
                                color="#000"
                                strokeWidth={3}
                                aria-hidden="true"
                              />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {errors.category && (
                  <p
                    className="text-base text-destructive"
                    data-ocid="goal_wizard.category.field_error"
                  >
                    {errors.category}
                  </p>
                )}
              </motion.div>
            )}

            {/* STEP 2 — Wish input with animated text reveal ─────────────── */}
            {step === 2 && (
              <motion.div
                className="space-y-8"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
              >
                <p
                  className="text-lg leading-relaxed pl-4 italic"
                  style={{
                    fontFamily: "var(--font-goal-wizard)",
                    color: "oklch(var(--muted-foreground))",
                    borderLeft:
                      "3px solid oklch(var(--goal-wizard-gold) / 0.5)",
                  }}
                >
                  Name the destination. What do you want to grow into?
                </p>

                <div className="space-y-3">
                  <label
                    htmlFor="goal-wizard-wish"
                    className="block text-xs font-mono tracking-widest uppercase"
                    style={{
                      color: "oklch(var(--muted-foreground))",
                    }}
                  >
                    Your Wish
                  </label>
                  <div className="relative">
                    <input
                      ref={wishInputRef}
                      id="goal-wizard-wish"
                      data-ocid="goal_wizard.wish_input"
                      value={form.wish}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 80);
                        setForm((f) => ({ ...f, wish: val }));
                        setErrors((er) => ({ ...er, wish: undefined }));
                      }}
                      onFocus={() => setFocusedField("wish")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="I want to run a 5K without stopping"
                      maxLength={80}
                      className="input-neumorphic-gold w-full text-lg"
                      style={{
                        fontFamily: "var(--font-goal-wizard)",
                      }}
                      aria-label="Your wish"
                      aria-invalid={!!errors.wish}
                      autoComplete="off"
                      name="goal-wizard-wish"
                      autoCorrect="off"
                      spellCheck={false}
                      autoCapitalize="off"
                    />
                    {/* Animated underline — grows from the left as the field
                        fills. Uses goal-wizard-underline-grow (scaleX 0→1)
                        with the emerald→gold gradient. Only animates when
                        there is text so an empty field doesn't show a
                        dangling bar. */}
                    <div
                      className="absolute left-0 right-0 bottom-0 h-[2px] origin-left rounded-full transition-opacity duration-200"
                      style={{
                        background:
                          "linear-gradient(90deg, oklch(var(--goal-wizard-emerald)) 0%, oklch(var(--goal-wizard-gold)) 100%)",
                        transform: form.wish ? "scaleX(1)" : "scaleX(0)",
                        opacity: form.wish ? 1 : 0,
                        transition:
                          "transform 540ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
                      }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs font-mono transition-opacity duration-200 ${focusedField === "wish" ? "opacity-100" : "opacity-0"}`}
                      style={{ color: "oklch(var(--muted-foreground))" }}
                    >
                      {form.wish.length}/80
                    </span>
                  </div>
                </div>

                {/* Live text reveal — the assembled wish wipes in left-to-
                    right via a clip-path inset as the user types. Uses the
                    goal-wizard-text-reveal keyframe timing (540ms) so the
                    reveal feels synchronized with the underline growth. */}
                {form.wish.trim() && (
                  <div
                    className="rounded-2xl p-5"
                    style={{
                      background: "oklch(var(--goal-wizard-emerald) / 0.08)",
                      border:
                        "1px solid oklch(var(--goal-wizard-emerald) / 0.3)",
                      boxShadow:
                        "0 0 14px oklch(var(--goal-wizard-emerald) / 0.12)",
                    }}
                    data-ocid="goal_wizard.wish_preview"
                  >
                    <p
                      key={form.wish}
                      className="text-xl font-medium leading-relaxed animate-goal-wizard-text-reveal"
                      style={{
                        fontFamily: "var(--font-goal-wizard)",
                        color: "oklch(var(--goal-wizard-emerald))",
                      }}
                    >
                      {form.wish}
                    </p>
                  </div>
                )}

                {/* Dedup hint — gentle, non-blocking. Shows when the in-
                    progress wish overlaps an existing goal's words. */}
                {similarGoalWish && (
                  <p
                    className="text-sm leading-relaxed"
                    style={{
                      color: "oklch(var(--goal-wizard-gold))",
                    }}
                    data-ocid="goal_wizard.similar_goal_hint"
                  >
                    You already have a similar goal: “{similarGoalWish}”.
                    Consider building on it instead.
                  </p>
                )}

                {errors.wish && (
                  <p
                    className="text-base text-destructive"
                    data-ocid="goal_wizard.wish.field_error"
                  >
                    {errors.wish}
                  </p>
                )}
              </motion.div>
            )}

            {/* STEP 3 — Outcome input with the same text-reveal treatment ── */}
            {step === 3 && (
              <motion.div
                className="space-y-8"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
              >
                <p
                  className="text-lg leading-relaxed pl-4 italic"
                  style={{
                    fontFamily: "var(--font-goal-wizard)",
                    color: "oklch(var(--muted-foreground))",
                    borderLeft:
                      "3px solid oklch(var(--goal-wizard-gold) / 0.5)",
                  }}
                >
                  What will reaching this goal let you feel or do? Name the
                  outcome you are reaching for.
                </p>

                <div className="space-y-3">
                  <label
                    htmlFor="goal-wizard-outcome"
                    className="block text-xs font-mono tracking-widest uppercase"
                    style={{
                      color: "oklch(var(--muted-foreground))",
                    }}
                  >
                    The Outcome
                  </label>
                  <div className="relative">
                    <input
                      ref={outcomeInputRef}
                      id="goal-wizard-outcome"
                      data-ocid="goal_wizard.outcome_input"
                      value={form.outcome}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 120);
                        setForm((f) => ({ ...f, outcome: val }));
                        setErrors((er) => ({ ...er, outcome: undefined }));
                      }}
                      onFocus={() => setFocusedField("outcome")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="feel energized, strong, and proud of my progress"
                      maxLength={120}
                      className="input-neumorphic-gold w-full text-lg"
                      style={{
                        fontFamily: "var(--font-goal-wizard)",
                      }}
                      aria-label="The outcome you want"
                      aria-invalid={!!errors.outcome}
                      autoComplete="off"
                      name="goal-wizard-outcome"
                      autoCorrect="off"
                      spellCheck={false}
                      autoCapitalize="off"
                    />
                    <div
                      className="absolute left-0 right-0 bottom-0 h-[2px] origin-left rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, oklch(var(--goal-wizard-emerald)) 0%, oklch(var(--goal-wizard-gold)) 100%)",
                        transform: form.outcome ? "scaleX(1)" : "scaleX(0)",
                        opacity: form.outcome ? 1 : 0,
                        transition:
                          "transform 540ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
                      }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs font-mono transition-opacity duration-200 ${focusedField === "outcome" ? "opacity-100" : "opacity-0"}`}
                      style={{ color: "oklch(var(--muted-foreground))" }}
                    >
                      {form.outcome.length}/120
                    </span>
                  </div>
                </div>

                {form.outcome.trim() && (
                  <div
                    className="rounded-2xl p-5"
                    style={{
                      background: "oklch(var(--goal-wizard-gold) / 0.08)",
                      border: "1px solid oklch(var(--goal-wizard-gold) / 0.3)",
                      boxShadow:
                        "0 0 14px oklch(var(--goal-wizard-gold) / 0.12)",
                    }}
                    data-ocid="goal_wizard.outcome_preview"
                  >
                    <p
                      key={form.outcome}
                      className="text-xl font-medium leading-relaxed animate-goal-wizard-text-reveal"
                      style={{
                        fontFamily: "var(--font-goal-wizard)",
                        color: "oklch(var(--goal-wizard-gold))",
                      }}
                    >
                      …so that I can {form.outcome}
                    </p>
                  </div>
                )}

                {errors.outcome && (
                  <p
                    className="text-base text-destructive"
                    data-ocid="goal_wizard.outcome.field_error"
                  >
                    {errors.outcome}
                  </p>
                )}
              </motion.div>
            )}

            {/* STEP 4 — Review + icon + color + confirm ──────────────────── */}
            {step === 4 && (
              <motion.div
                className="space-y-8"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
              >
                <p
                  className="text-lg leading-relaxed pl-4 italic"
                  style={{
                    fontFamily: "var(--font-goal-wizard)",
                    color: "oklch(var(--muted-foreground))",
                    borderLeft:
                      "3px solid oklch(var(--goal-wizard-gold) / 0.5)",
                  }}
                >
                  Review your goal and personalize it. This is the seed you will
                  tend.
                </p>

                {/* Summary card */}
                <div
                  className="rounded-2xl p-6 space-y-4"
                  style={{
                    background: "oklch(var(--card))",
                    border: "1px solid oklch(var(--border))",
                    boxShadow:
                      "inset 3px 3px 6px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(80,80,85,0.25)",
                  }}
                  data-ocid="goal_wizard.review_summary"
                >
                  {selectedCategory && (
                    <div className="flex items-center gap-3">
                      <span
                        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background:
                            "oklch(var(--goal-wizard-emerald) / 0.15)",
                          border:
                            "1px solid oklch(var(--goal-wizard-emerald) / 0.4)",
                          color: "oklch(var(--goal-wizard-emerald))",
                        }}
                        aria-hidden="true"
                      >
                        <selectedCategory.icon size={20} strokeWidth={1.5} />
                      </span>
                      <span
                        className="text-xs font-mono tracking-widest uppercase"
                        style={{
                          color: "oklch(var(--muted-foreground))",
                        }}
                      >
                        {selectedCategory.title}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <p
                      className="text-xs font-mono tracking-widest uppercase"
                      style={{
                        color: "oklch(var(--muted-foreground))",
                      }}
                    >
                      Wish
                    </p>
                    <p
                      className="text-lg font-medium leading-relaxed"
                      style={{
                        fontFamily: "var(--font-goal-wizard)",
                        color: "oklch(var(--foreground))",
                      }}
                    >
                      {form.wish}
                    </p>
                  </div>
                  <div
                    className="h-px"
                    style={{
                      background: "oklch(var(--goal-wizard-gold) / 0.2)",
                    }}
                  />
                  <div className="space-y-1.5">
                    <p
                      className="text-xs font-mono tracking-widest uppercase"
                      style={{
                        color: "oklch(var(--muted-foreground))",
                      }}
                    >
                      Outcome
                    </p>
                    <p
                      className="text-lg font-medium leading-relaxed"
                      style={{
                        fontFamily: "var(--font-goal-wizard)",
                        color: "oklch(var(--goal-wizard-gold))",
                      }}
                    >
                      …so that I can {form.outcome}
                    </p>
                  </div>
                </div>

                {/* Icon picker */}
                <div className="space-y-3">
                  <p
                    className="text-xs font-mono tracking-widest uppercase"
                    style={{
                      color: "oklch(var(--muted-foreground))",
                    }}
                  >
                    Choose an Icon
                  </p>
                  <div
                    className="grid grid-cols-7 gap-3"
                    data-ocid="goal_wizard.icon_selector"
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
                          data-ocid={`goal_wizard.icon.${icon.id}`}
                          className="relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={
                            isIconSelected
                              ? {
                                  backgroundColor:
                                    "oklch(var(--goal-wizard-emerald) / 0.15)",
                                  border:
                                    "2.5px solid oklch(var(--goal-wizard-emerald))",
                                  color: "oklch(var(--goal-wizard-emerald))",
                                  boxShadow:
                                    "0 0 16px 3px oklch(var(--goal-wizard-emerald) / 0.35)",
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

                {createGoalMutation.isError && (
                  <p
                    className="text-base text-destructive"
                    data-ocid="goal_wizard.submit.error_state"
                  >
                    Something went wrong. Please try again.
                  </p>
                )}
                {!actor && (
                  <p
                    className="text-base"
                    style={{
                      color: "oklch(var(--muted-foreground))",
                    }}
                    data-ocid="goal_wizard.actor_loading_state"
                  >
                    Connecting to backend…
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Bottom nav bar ──────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-stretch gap-3 px-6 py-4 border-t"
          style={{
            borderColor: "oklch(var(--border))",
            background: "oklch(var(--goal-wizard-surface))",
          }}
        >
          {/* Close button — far left */}
          <div className="flex items-center shrink-0">
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={requestClose}
              data-ocid="goal_wizard.close_button"
              aria-label="Close goal wizard"
              className="w-10 h-10 p-0"
            >
              <X size={18} />
            </Button>
          </div>

          {/* 3-column equal-spacing group: Back (left), indicator (center), Next (right) */}
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 flex items-center justify-start">
              <Button
                type="button"
                variant="outline"
                size="lg"
                data-ocid="goal_wizard.back_button"
                onClick={goBack}
                disabled={step === 1}
                className="gap-2 text-base min-w-[100px]"
              >
                <ChevronLeft size={16} />
                Back
              </Button>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <span
                className="text-sm font-mono whitespace-nowrap"
                style={{
                  color: "oklch(var(--muted-foreground))",
                }}
              >
                {step} / {TOTAL_STEPS}
              </span>
            </div>

            <div className="flex-1 flex items-center justify-end">
              {/* The shadcn Button is a plain function component (not
                  forwardRef), so it cannot accept a ref prop. We wrap it in
                  a span that carries the ref for step-4 focus management.
                  Focusing the wrapper span moves focus onto the button's
                  container, which is reachable by keyboard and visually
                  equivalent for the focus-management flow. */}
              <span
                ref={step === TOTAL_STEPS ? confirmButtonRef : undefined}
                className="inline-flex"
              >
                <Button
                  type="button"
                  size="lg"
                  data-ocid={
                    step === TOTAL_STEPS
                      ? "goal_wizard.submit_button"
                      : "goal_wizard.next_button"
                  }
                  onClick={goNext}
                  disabled={
                    createGoalMutation.isPending ||
                    (step === TOTAL_STEPS && !actor)
                  }
                  className="gap-2 text-base min-w-[130px]"
                  style={{
                    background:
                      "linear-gradient(90deg, oklch(var(--goal-wizard-emerald)) 0%, oklch(var(--goal-wizard-gold)) 100%)",
                    color: "#000",
                  }}
                >
                  {step === TOTAL_STEPS ? (
                    createGoalMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                        Blooming…
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Bloom Goal
                      </>
                    )
                  ) : (
                    "Next →"
                  )}
                </Button>
              </span>
            </div>
          </div>
        </div>

        {/* ── Exit confirmation overlay ──────────────────────────────────── */}
        <AnimatePresence>
          {showExitConfirm && (
            <motion.div
              className="absolute inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm"
              data-ocid="goal_wizard.exit_confirm_modal"
              aria-label="Discard changes confirmation"
              aria-modal="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowExitConfirm(false);
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  e.target === e.currentTarget
                ) {
                  e.preventDefault();
                  setShowExitConfirm(false);
                }
              }}
            >
              <div
                className="mx-6 max-w-sm w-full rounded-2xl border p-6"
                style={{
                  background: "oklch(var(--card))",
                  borderColor: "oklch(var(--border))",
                  boxShadow:
                    "-5px -5px 14px rgba(70,70,80,0.5), 8px 8px 22px rgba(0,0,0,0.9)",
                }}
              >
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
                    <h2
                      className="text-lg font-semibold"
                      style={{
                        fontFamily: "var(--font-goal-wizard)",
                        color: "oklch(var(--foreground))",
                      }}
                    >
                      Discard this goal?
                    </h2>
                    <p
                      className="text-sm mt-1 leading-relaxed"
                      style={{
                        color: "oklch(var(--muted-foreground))",
                      }}
                    >
                      Your seed hasn't bloomed yet. Closing now will lose your
                      progress.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    data-ocid="goal_wizard.exit_confirm.keep_editing_button"
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 gap-2 text-base"
                  >
                    Keep editing
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    data-ocid="goal_wizard.exit_confirm.discard_button"
                    onClick={handleClose}
                    className="flex-1 gap-2 text-base"
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </dialog>
    </>
  );
}
