import { CheckCircle, Lock, X } from "lucide-react";
import React, { useState } from "react";

interface HabitTypeChooserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (isLockIn: boolean) => void;
}

export default function HabitTypeChooser({
  open,
  onClose,
  onSelect,
}: HabitTypeChooserProps) {
  const [hoveredCard, setHoveredCard] = useState<null | "regular" | "lockin">(
    null,
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative mx-4 w-full max-w-sm rounded-2xl border border-white/5 p-6"
        style={{
          background: "#141414",
          boxShadow:
            "8px 8px 16px rgba(0,0,0,0.5), -4px -4px 8px rgba(255,255,255,0.03)",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-zinc-300"
          style={{
            background: "#1e1e1e",
            boxShadow:
              "inset 2px 2px 4px rgba(0,0,0,0.4), inset -2px -2px 4px rgba(255,255,255,0.03)",
          }}
          aria-label="Close"
          data-ocid="habit_type_chooser.close_button"
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div className="mb-2 text-center">
          <h2 className="text-xl font-semibold text-white">
            What kind of habit?
          </h2>
        </div>
        <p className="mb-6 text-center text-sm text-zinc-400">
          Choose your habit type — this cannot be changed later.
        </p>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {/* Regular Habit */}
          <button
            type="button"
            data-ocid="habit_type_chooser.regular_habit"
            className="flex w-full cursor-pointer items-center gap-4 rounded-xl p-4 text-left transition-all"
            style={{
              background: "#1e1e1e",
              boxShadow:
                "inset 2px 2px 5px rgba(0,0,0,0.4), inset -2px -2px 5px rgba(255,255,255,0.03)",
              border:
                hoveredCard === "regular"
                  ? "1px solid rgba(16,185,129,0.5)"
                  : "1px solid rgba(255,255,255,0.05)",
              outline: "none",
            }}
            onClick={() => onSelect(false)}
            onMouseEnter={() => setHoveredCard("regular")}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                background: "rgba(16,185,129,0.1)",
                boxShadow:
                  hoveredCard === "regular"
                    ? "0 0 10px rgba(16,185,129,0.25)"
                    : "none",
                transition: "box-shadow 0.2s",
              }}
            >
              <CheckCircle size={20} color="#10B981" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">Regular Habit</p>
              <p className="text-sm text-zinc-400">
                Track daily habits with flexible swipe gestures
              </p>
            </div>
          </button>

          {/* Lock-In Habit */}
          <button
            type="button"
            data-ocid="habit_type_chooser.lockin_habit"
            className="flex w-full cursor-pointer items-center gap-4 rounded-xl p-4 text-left transition-all"
            style={{
              background: "#1e1e1e",
              boxShadow:
                "inset 2px 2px 5px rgba(0,0,0,0.4), inset -2px -2px 5px rgba(255,255,255,0.03)",
              border:
                hoveredCard === "lockin"
                  ? "1px solid rgba(245,158,11,0.5)"
                  : "1px solid rgba(255,255,255,0.05)",
              outline: "none",
            }}
            onClick={() => onSelect(true)}
            onMouseEnter={() => setHoveredCard("lockin")}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{
                background: "rgba(245,158,11,0.1)",
                boxShadow:
                  hoveredCard === "lockin"
                    ? "0 0 10px rgba(245,158,11,0.25)"
                    : "none",
                transition: "box-shadow 0.2s",
              }}
            >
              <Lock size={20} color="#F59E0B" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">Lock-In Habit</p>
              <p className="text-sm text-zinc-400">
                Strict time blocks with check-in and check-out
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
