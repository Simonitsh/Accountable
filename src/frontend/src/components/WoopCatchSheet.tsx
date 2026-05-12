import { Flame, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { GoalPublic } from "../backend.d.ts";

// Emerald Green — success accent
const SUCCESS_COLOR = "#10B981";

interface WoopCatchSheetProps {
  goal: GoalPublic;
  open: boolean;
  onClose: () => void;
  /** User tapped "I did my If-Then Plan" → log as success with executedIfThen:true */
  onExecutedPlan: () => void;
  /** User tapped "I still need to skip" → open the obstacle/note sheet */
  onProceedToSkip: () => void;
  isLoading?: boolean;
}

export function WoopCatchSheet({
  goal,
  open,
  onClose,
  onExecutedPlan,
  onProceedToSkip,
  isLoading = false,
}: WoopCatchSheetProps) {
  const planText = goal.ifThenPlan?.trim();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — blurred but card stays visible */}
          <motion.div
            key="woop-catch-backdrop"
            className="fixed inset-0 z-40"
            style={{
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(2px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            data-ocid="woop_catch.backdrop"
          />

          {/* Bottom sheet */}
          <motion.div
            key="woop-catch-sheet"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 340 }}
            data-ocid="woop_catch.dialog"
            style={{
              background: "oklch(var(--card))",
              paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
              boxShadow:
                "0 -8px 32px rgba(0,0,0,0.7), 0 -2px 8px rgba(0,0,0,0.5)",
              borderTop: "1px solid rgba(255,255,255,0.13)",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              borderRight: "none",
              borderBottom: "none",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "oklch(var(--muted-foreground) / 0.3)" }}
              />
            </div>

            {/* Close button */}
            <div className="flex justify-end px-4 pt-1">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                data-ocid="woop_catch.close_button"
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Header */}
            <div className="px-6 pt-1 pb-5">
              {/* Flash icon + label */}
              <div className="flex items-center gap-2 mb-3">
                <Flame
                  className="w-4 h-4"
                  style={{ color: SUCCESS_COLOR }}
                  aria-hidden="true"
                />
                <span
                  className="text-xs font-mono uppercase tracking-widest"
                  style={{ color: SUCCESS_COLOR }}
                >
                  WOOP Catch
                </span>
              </div>

              <h2
                className="font-display text-xl font-bold leading-snug mb-1"
                style={{ color: "oklch(var(--foreground))" }}
              >
                Wait! Your backup plan is:
              </h2>

              {/* If-Then plan callout */}
              {planText ? (
                <div
                  className="mt-3 mb-5 rounded-2xl p-4"
                  style={{
                    background: "rgba(16,185,129,0.07)",
                    border: "1px solid rgba(16,185,129,0.22)",
                    boxShadow:
                      "inset 2px 2px 5px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.04)",
                  }}
                  data-ocid="woop_catch.plan_text"
                >
                  <p
                    className="text-base font-body leading-relaxed"
                    style={{ color: "oklch(var(--foreground) / 0.9)" }}
                  >
                    {planText}
                  </p>
                </div>
              ) : (
                <div
                  className="mt-3 mb-5 rounded-2xl p-4"
                  style={{
                    background: "oklch(var(--muted) / 0.4)",
                    border: "1px solid oklch(var(--border))",
                  }}
                >
                  <p className="text-sm text-muted-foreground italic">
                    No If-Then plan was set for this habit.
                  </p>
                </div>
              )}

              {/* Action A — primary: executed plan */}
              <button
                type="button"
                disabled={isLoading}
                onClick={onExecutedPlan}
                data-ocid="woop_catch.executed_plan_button"
                className="w-full py-3.5 rounded-2xl font-display font-semibold text-base tracking-wide transition-smooth mb-3 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: "rgba(16,185,129,0.15)",
                  border: "1.5px solid rgba(16,185,129,0.5)",
                  color: SUCCESS_COLOR,
                  boxShadow:
                    "-3px -3px 8px rgba(60,60,65,0.35), 4px 4px 10px rgba(0,0,0,0.6)",
                }}
              >
                {isLoading ? (
                  <span
                    className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{
                      borderColor: "rgba(16,185,129,0.3)",
                      borderTopColor: SUCCESS_COLOR,
                    }}
                  />
                ) : (
                  <>
                    <Flame className="w-4 h-4" />I did my If-Then Plan
                  </>
                )}
              </button>

              {/* Action B — ghost: still need to skip */}
              <button
                type="button"
                disabled={isLoading}
                onClick={onProceedToSkip}
                data-ocid="woop_catch.proceed_skip_button"
                className="w-full py-3 rounded-2xl font-display font-medium text-sm tracking-wide transition-smooth text-muted-foreground hover:text-foreground disabled:opacity-40"
                style={{
                  background: "transparent",
                  border: "1px solid oklch(var(--border))",
                }}
              >
                I still need to skip
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
