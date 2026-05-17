import { AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GoalPublic } from "../backend.d.ts";
import { OBSTACLE_TEMPLATES, type ObstacleTemplate } from "../types";

const OCEAN_BLUE = "#0369A1"; // Ocean Blue for Lock-In missed state
const NOTE_MAX = 140;

interface MissedWindowSheetProps {
  goal: GoalPublic;
  open: boolean;
  onClose: () => void;
  onConfirm: (obstacleTemplateId?: bigint, customNote?: string) => void;
  isLoading?: boolean;
  failureType?: "missed-start" | "missed-checkout";
}

export function MissedWindowSheet({
  goal,
  open,
  onClose,
  onConfirm,
  isLoading = false,
  failureType = "missed-start",
}: MissedWindowSheetProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [customNote, setCustomNote] = useState("");
  const [noteFocused, setNoteFocused] = useState(false);

  const _selectedObstacle: ObstacleTemplate | undefined =
    OBSTACLE_TEMPLATES[selectedIndex];

  function handleClose() {
    setSelectedIndex(0);
    setCustomNote("");
    onClose();
  }

  function handleConfirm() {
    const trimmedNote = customNote.trim();
    // Pass BigInt(selectedIndex) and the custom note — same pattern as SkipModal.
    onConfirm(BigInt(selectedIndex), trimmedNote || undefined);
    setSelectedIndex(0);
    setCustomNote("");
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
                    style={{ color: OCEAN_BLUE }}
                  />
                  <span
                    className="text-xs font-mono uppercase tracking-widest"
                    style={{ color: OCEAN_BLUE }}
                  >
                    {failureType === "missed-checkout"
                      ? "Missed Check-Out Window"
                      : "Missed Start Window"}
                  </span>
                </div>
                <h2 className="font-display text-lg text-foreground leading-tight">
                  {failureType === "missed-checkout"
                    ? "You missed the check-out window"
                    : "You missed the start window"}
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
                          : "border-[rgba(3,105,161,0.45)] text-foreground/80 hover:bg-[rgba(3,105,161,0.1)] hover:text-foreground",
                      ].join(" ")}
                      style={
                        isSelected
                          ? {
                              backgroundColor: "rgba(3,105,161,0.15)",
                              borderColor: "rgba(3,105,161,0.55)",
                              boxShadow:
                                "inset 2px 2px 6px rgba(0,0,0,0.35), inset 0 0 8px rgba(3,105,161,0.25), inset -1px -1px 3px rgba(255,255,255,0.05)",
                            }
                          : undefined
                      }
                      data-ocid={`missed_window_sheet.obstacle.${obstacle.id}`}
                    >
                      <p
                        className="text-sm font-display font-medium leading-tight"
                        style={isSelected ? { color: OCEAN_BLUE } : undefined}
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

              {/* Optional micro-journal note */}
              <div className="mb-4">
                <label
                  htmlFor="missed-custom-note"
                  className="block text-xs text-muted-foreground uppercase tracking-wider font-mono mb-2"
                >
                  What got in the way today?{" "}
                  <span className="normal-case">(Optional)</span>
                </label>
                <div className="relative">
                  <textarea
                    id="missed-custom-note"
                    data-ocid="missed_window_sheet.custom_note_textarea"
                    rows={2}
                    maxLength={NOTE_MAX}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    onFocus={() => setNoteFocused(true)}
                    onBlur={() => setNoteFocused(false)}
                    placeholder="Write a specific reason for today… (optional)"
                    className="w-full resize-none rounded-xl px-3 py-2.5 text-sm font-body text-foreground placeholder:text-muted-foreground/50 outline-none transition-smooth"
                    style={{
                      background: "oklch(var(--muted) / 0.35)",
                      border: noteFocused
                        ? "1px solid rgba(3,105,161,0.6)"
                        : "1px solid oklch(var(--border))",
                      boxShadow: noteFocused
                        ? "inset 2px 2px 6px rgba(0,0,0,0.35), inset -1px -1px 3px rgba(255,255,255,0.04), 0 0 8px rgba(3,105,161,0.15)"
                        : "inset 1px 1px 4px rgba(0,0,0,0.3)",
                    }}
                  />
                  {/* Character counter — visible only while focused or has content */}
                  {(noteFocused || customNote.length > 0) && (
                    <span
                      className="absolute bottom-2 right-3 text-xs font-mono pointer-events-none"
                      style={{
                        color:
                          customNote.length >= NOTE_MAX
                            ? "#ef4444"
                            : "oklch(var(--muted-foreground) / 0.6)",
                      }}
                    >
                      {customNote.length}/{NOTE_MAX}
                    </span>
                  )}
                </div>
              </div>

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
                    backgroundColor: "rgba(3,105,161,0.18)",
                    color: OCEAN_BLUE,
                    border: "1px solid rgba(3,105,161,0.6)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 12px rgba(3,105,161,0.2)",
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
