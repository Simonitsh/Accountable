import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { GoalPublic } from "../backend.d.ts";
import { getGoalIcon } from "../utils/goalIcons";

const SUCCESS_COLOR = "#10B981";
const SKIP_COLOR = "#0369A1";

interface UndoPopupProps {
  open: boolean;
  goal: GoalPublic | null;
  checkInType: "success" | "skip" | null;
  isLoading?: boolean;
  onUndo: () => void;
  onKeep: () => void;
}

export function UndoPopup({
  open,
  goal,
  checkInType,
  isLoading = false,
  onUndo,
  onKeep,
}: UndoPopupProps) {
  if (!goal || !checkInType) return null;

  const goalIcon = getGoalIcon(goal.iconName);
  const themeColor = goal.themeColor;
  const keystoneText = goal.wishDescription || goal.wish;
  const isSuccess = checkInType === "success";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="undo-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
            }}
            onClick={onKeep}
            aria-hidden="true"
          />

          {/* Card */}
          <motion.div
            key="undo-card"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-x-4 z-50 rounded-2xl p-5"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              backgroundColor: "oklch(var(--card))",
              boxShadow:
                "-6px -6px 14px rgba(80,80,85,0.35), 8px 8px 20px rgba(0,0,0,0.85)",
              maxWidth: "420px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
            // biome-ignore lint/a11y/useSemanticElements: motion.div cannot be a <dialog>
            role="dialog"
            aria-modal="true"
            aria-label="Undo check-in"
            data-ocid="undo_popup.dialog"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onKeep}
              aria-label="Keep check-in"
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full transition-smooth text-muted-foreground hover:text-foreground"
              style={{
                background: "oklch(var(--muted) / 0.6)",
              }}
              data-ocid="undo_popup.close_button"
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              {/* Icon orb */}
              <div
                className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: themeColor
                    ? `color-mix(in srgb, ${themeColor} 20%, oklch(var(--card)))`
                    : "oklch(var(--muted) / 0.5)",
                  boxShadow:
                    "inset 1px 1px 3px rgba(0,0,0,0.55), inset -1px -1px 2px rgba(80,80,85,0.2)",
                }}
              >
                <span
                  className="w-5 h-5 shrink-0"
                  style={{
                    color: themeColor ?? "oklch(var(--muted-foreground))",
                  }}
                >
                  {goalIcon.svg}
                </span>
              </div>

              {/* Habit name */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                  Undo check-in?
                </p>
                <h3 className="font-display font-semibold text-foreground leading-snug line-clamp-2 text-sm">
                  {keystoneText}
                </h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              {isSuccess
                ? "This habit was marked as completed. Undo to move it back to your active list."
                : "This habit was skipped. Undo to move it back to your active list."}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onKeep}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold font-display transition-smooth text-muted-foreground"
                style={{
                  background: "oklch(var(--muted) / 0.6)",
                  boxShadow:
                    "-2px -2px 5px rgba(60,60,65,0.3), 3px 3px 8px rgba(0,0,0,0.6)",
                }}
                data-ocid="undo_popup.cancel_button"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={onUndo}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold font-display transition-smooth text-foreground"
                style={{
                  background: isSuccess
                    ? `${SUCCESS_COLOR}22`
                    : `${SKIP_COLOR}22`,
                  border: `1.5px solid ${isSuccess ? SUCCESS_COLOR : SKIP_COLOR}50`,
                  boxShadow:
                    "-2px -2px 5px rgba(60,60,65,0.3), 3px 3px 8px rgba(0,0,0,0.6)",
                }}
                data-ocid="undo_popup.confirm_button"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                      style={{
                        borderColor: "rgba(255,255,255,0.25)",
                        borderTopColor: isSuccess ? SUCCESS_COLOR : SKIP_COLOR,
                      }}
                    />
                    Undoing…
                  </span>
                ) : (
                  "Undo"
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
