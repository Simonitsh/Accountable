import { AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GoalPublic } from "../backend.d.ts";
import type { ObstacleTemplate } from "../types";
import { OBSTACLE_TEMPLATES } from "../types";

const MISSED_COLOR = "#6B7280"; // Muted grey for missed state

interface MissedWindowSheetProps {
  goal: GoalPublic;
  open: boolean;
  onClose: () => void;
  onConfirm: (obstacleTemplateId?: bigint) => void;
  isLoading?: boolean;
}

export function MissedWindowSheet({
  goal,
  open,
  onClose,
  onConfirm,
  isLoading = false,
}: MissedWindowSheetProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const selectedObstacle: ObstacleTemplate | undefined =
    OBSTACLE_TEMPLATES[selectedIndex];

  function handleClose() {
    setSelectedIndex(0);
    onClose();
  }

  function handleConfirm() {
    // Pass BigInt(selectedIndex) — same pattern as SkipModal — so the backend
    // receives a valid obstacleTemplateId for analytics on missed windows.
    onConfirm(BigInt(selectedIndex));
    setSelectedIndex(0);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="missed-backdrop"
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            data-ocid="missed_window_sheet.backdrop"
          />

          {/* Bottom Sheet */}
          <motion.div
            key="missed-sheet"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card border border-border"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            data-ocid="missed_window_sheet.dialog"
            style={{
              paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
              boxShadow:
                "-5px 0 20px rgba(0,0,0,0.7), 0 -5px 20px rgba(0,0,0,0.6)",
              borderTop: "1px solid rgba(255,255,255,0.13)",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              borderRight: "none",
              borderBottom: "none",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-3 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle
                    className="w-4 h-4"
                    style={{ color: MISSED_COLOR }}
                  />
                  <span
                    className="text-xs font-mono uppercase tracking-widest"
                    style={{ color: MISSED_COLOR }}
                  >
                    Missed Window
                  </span>
                </div>
                <h2 className="font-display text-lg text-foreground leading-tight">
                  You missed your time window
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {goal.wishDescription || goal.wish}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="ml-4 mt-0.5 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                aria-label="Close"
                data-ocid="missed_window_sheet.close_button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-2">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-mono">
                What got in the way?
              </p>

              {/* Obstacle grid */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {OBSTACLE_TEMPLATES.map((obstacle, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      type="button"
                      key={obstacle.id}
                      onClick={() => setSelectedIndex(idx)}
                      data-selected={idx === selectedIndex ? "true" : undefined}
                      className={[
                        "rounded-xl p-3 text-left transition-smooth border",
                        isSelected
                          ? "border-transparent"
                          : "bg-muted/40 border-border text-muted-foreground hover:bg-muted",
                      ].join(" ")}
                      style={
                        isSelected
                          ? {
                              backgroundColor: "rgba(107,114,128,0.12)",
                              borderColor: "rgba(107,114,128,0.4)",
                              boxShadow:
                                "inset 2px 2px 5px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.05)",
                            }
                          : undefined
                      }
                      data-ocid={`missed_window_sheet.obstacle.${obstacle.id}`}
                    >
                      <p
                        className="text-sm font-display font-medium leading-tight"
                        style={isSelected ? { color: MISSED_COLOR } : undefined}
                      >
                        {obstacle.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {obstacle.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedObstacle && (
                <p className="text-xs text-muted-foreground italic mb-4 px-1">
                  &quot;{selectedObstacle.description}&quot;
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl py-3 text-sm font-display font-medium border border-border text-muted-foreground bg-muted/40 transition-smooth hover:bg-muted"
                  onClick={handleClose}
                  disabled={isLoading}
                  data-ocid="missed_window_sheet.cancel_button"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl py-3 text-sm font-display font-medium transition-smooth"
                  disabled={isLoading}
                  onClick={handleConfirm}
                  style={{
                    backgroundColor: "rgba(107,114,128,0.15)",
                    color: MISSED_COLOR,
                    border: "1px solid rgba(107,114,128,0.35)",
                  }}
                  data-ocid="missed_window_sheet.confirm_button"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin inline-block" />
                  ) : (
                    "Log Missed"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
