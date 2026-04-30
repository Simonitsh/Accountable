import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Goal, ObstacleTemplate } from "../types";
import { OBSTACLE_TEMPLATES } from "../types";

interface SkipModalProps {
  goal: Goal;
  open: boolean;
  onClose: () => void;
  onConfirm: (obstacleId: string) => void;
  isLoading?: boolean;
}

export function SkipModal({
  goal,
  open,
  onClose,
  onConfirm,
  isLoading = false,
}: SkipModalProps) {
  const [selectedObstacleId, setSelectedObstacleId] = useState<string>(
    goal.obstacleTemplateId ?? OBSTACLE_TEMPLATES[0].id,
  );

  const selectedObstacle: ObstacleTemplate | undefined =
    OBSTACLE_TEMPLATES.find((o) => o.id === selectedObstacleId);

  function handleConfirm() {
    onConfirm(selectedObstacleId);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            data-ocid="skip_modal.backdrop"
          />

          {/* Bottom Sheet */}
          <motion.div
            key="sheet"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card border border-border shadow-neumorphic-emboss-dark"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            data-ocid="skip_modal.dialog"
            style={{
              paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
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
                  <AlertCircle className="w-4 h-4 text-accent-skip" />
                  <span
                    className="text-xs font-mono uppercase tracking-widest"
                    style={{ color: "oklch(var(--color-accent-skip))" }}
                  >
                    Justifiable Skip
                  </span>
                </div>
                <h2 className="font-display text-lg text-foreground leading-tight">
                  {goal.wish}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                  {goal.wishDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-4 mt-0.5 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                aria-label="Close"
                data-ocid="skip_modal.close_button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-2">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-mono">
                What got in the way?
              </p>

              {/* Obstacle grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {OBSTACLE_TEMPLATES.map((obstacle) => {
                  const isSelected = obstacle.id === selectedObstacleId;
                  return (
                    <button
                      type="button"
                      key={obstacle.id}
                      onClick={() => setSelectedObstacleId(obstacle.id)}
                      className={[
                        "rounded-xl p-3 text-left transition-smooth border",
                        isSelected
                          ? "border-transparent"
                          : "bg-muted/40 border-border text-muted-foreground hover:bg-muted",
                      ].join(" ")}
                      style={
                        isSelected
                          ? {
                              backgroundColor:
                                "oklch(var(--color-accent-skip) / 0.12)",
                              borderColor:
                                "oklch(var(--color-accent-skip) / 0.4)",
                              boxShadow:
                                "0 0 12px 1px oklch(var(--color-accent-skip) / 0.2)",
                            }
                          : undefined
                      }
                      data-ocid={`skip_modal.obstacle.${obstacle.id}`}
                    >
                      <p
                        className="text-sm font-display font-medium leading-tight"
                        style={
                          isSelected
                            ? { color: "oklch(var(--color-accent-skip))" }
                            : undefined
                        }
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

              {/* If-Then plan reminder */}
              {goal.ifThenPlan && (
                <div className="rounded-xl p-3 mb-4 bg-muted/30 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">
                    Your If-Then Plan
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {goal.ifThenPlan}
                  </p>
                </div>
              )}

              {/* Obstacle description summary */}
              {selectedObstacle && (
                <p className="text-xs text-muted-foreground italic mb-4 px-1">
                  "{selectedObstacle.description}"
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                  disabled={isLoading}
                  data-ocid="skip_modal.cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 font-display transition-smooth"
                  disabled={isLoading}
                  onClick={handleConfirm}
                  style={{
                    backgroundColor: "oklch(var(--color-accent-skip) / 0.15)",
                    color: "oklch(var(--color-accent-skip))",
                    borderColor: "oklch(var(--color-accent-skip) / 0.35)",
                    border: "1px solid",
                  }}
                  data-ocid="skip_modal.confirm_button"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                  ) : (
                    "Log Skip"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
