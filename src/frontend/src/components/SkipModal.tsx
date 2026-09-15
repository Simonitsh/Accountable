import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { HabitPublic } from "../types";
import type { ObstacleTemplate } from "../types";
import { OBSTACLE_TEMPLATES, useResolveObstacleLabel } from "../types";

// Ocean Blue — skip accent
const SKIP_COLOR = "#0369A1";

interface SkipModalProps {
  goal: HabitPublic;
  open: boolean;
  onClose: () => void;
  onConfirm: (obstacleTemplateId?: bigint, note?: string) => void;
  isLoading?: boolean;
}

export function SkipModal({
  goal,
  open,
  onClose,
  onConfirm,
  isLoading = false,
}: SkipModalProps) {
  // Store the numeric INDEX (0-based) so BigInt(index) is always safe
  const [selectedObstacleIndex, setSelectedObstacleIndex] = useState<number>(0);
  // Optional free-text note — purely personal context attached to this one
  // check-in, in the user's own words. Never a custom obstacle category.
  const [note, setNote] = useState("");

  const _selectedObstacle: ObstacleTemplate | undefined =
    OBSTACLE_TEMPLATES[selectedObstacleIndex];

  const resolveObstacleLabel = useResolveObstacleLabel();

  async function handleConfirm() {
    // Resolve the selected built-in obstacle label to a real, reusable obstacle
    // template id (find-or-create) instead of passing the array index 0-5.
    const selected = OBSTACLE_TEMPLATES[selectedObstacleIndex];
    let templateId: bigint | undefined;
    if (selected) {
      try {
        templateId = await resolveObstacleLabel(selected.label);
      } catch {
        templateId = undefined;
      }
    }
    const trimmedNote = note.trim();
    onConfirm(templateId, trimmedNote === "" ? undefined : trimmedNote);
    setNote("");
    onClose();
  }

  function handleClose() {
    setNote("");
    onClose();
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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card border border-border"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            data-ocid="skip_modal.dialog"
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
                  <AlertCircle
                    className="w-4 h-4"
                    style={{ color: SKIP_COLOR }}
                  />
                  <span
                    className="text-xs font-mono uppercase tracking-widest"
                    style={{ color: SKIP_COLOR }}
                  >
                    Justifiable Skip
                  </span>
                </div>
                <h2 className="font-display text-lg text-foreground leading-tight">
                  {goal.wishDescription || goal.wish}
                </h2>
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
                {OBSTACLE_TEMPLATES.map((obstacle, idx) => {
                  const isSelected = idx === selectedObstacleIndex;
                  return (
                    <button
                      type="button"
                      key={obstacle.id}
                      onClick={() => setSelectedObstacleIndex(idx)}
                      className={[
                        "rounded-xl p-3 text-left transition-smooth border",
                        isSelected
                          ? "border-transparent"
                          : "bg-muted/40 border-border text-muted-foreground hover:bg-muted",
                      ].join(" ")}
                      style={
                        isSelected
                          ? {
                              backgroundColor: "rgba(3,105,161,0.12)",
                              borderColor: "rgba(3,105,161,0.4)",
                              boxShadow:
                                "inset 2px 2px 5px rgba(0,0,0,0.3), inset -1px -1px 3px rgba(255,255,255,0.05)",
                            }
                          : undefined
                      }
                      data-ocid={`skip_modal.obstacle.${obstacle.id}`}
                    >
                      <p
                        className="text-sm font-display font-medium leading-tight text-foreground"
                        style={isSelected ? { color: SKIP_COLOR } : undefined}
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

              {/* Optional note — personal context, never a custom obstacle */}
              <div className="mb-4">
                <label
                  htmlFor="skip-modal-note"
                  className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wider font-mono"
                >
                  Add a note (optional)
                </label>
                <textarea
                  id="skip-modal-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={280}
                  placeholder="In your own words — what happened?"
                  className="input-neumorphic w-full resize-none placeholder-subtle"
                  data-ocid="skip_modal.note_input"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={isLoading}
                  data-ocid="skip_modal.cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 font-display transition-smooth"
                  disabled={isLoading}
                  onClick={handleConfirm}
                  style={{
                    backgroundColor: "rgba(3,105,161,0.15)",
                    color: SKIP_COLOR,
                    borderColor: "rgba(3,105,161,0.35)",
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
