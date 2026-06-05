/**
 * DayPickerRow — Neumorphic 7-day toggle for scheduling habits.
 * Renders M T W T F S S as circular buttons.
 * Minimum 1 day must always remain selected.
 */

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_ABBRS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export interface DayPickerRowProps {
  selectedDays: string[];
  onChange: (days: string[]) => void;
}

export function DayPickerRow({ selectedDays, onChange }: DayPickerRowProps) {
  function toggle(abbr: string) {
    const isSelected = selectedDays.includes(abbr);
    // Block deselection of the last remaining day
    if (isSelected && selectedDays.length === 1) return;
    const next = isSelected
      ? selectedDays.filter((d) => d !== abbr)
      : [...selectedDays, abbr];
    onChange(next);
  }

  return (
    <div className="flex items-center justify-between gap-1">
      {DAY_ABBRS.map((abbr, i) => {
        const selected = selectedDays.includes(abbr);
        return (
          <button
            key={abbr}
            type="button"
            aria-pressed={selected}
            aria-label={`${DAY_LABELS[i]} (${abbr})`}
            data-ocid={`day_picker.${abbr}`}
            onClick={() => toggle(abbr)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold font-mono transition-all duration-200 select-none"
            style={
              selected
                ? {
                    background: "rgba(16,185,129,0.15)",
                    border: "2px solid #10B981",
                    color: "#10B981",
                    boxShadow:
                      "0 0 10px rgba(16,185,129,0.3), inset 2px 2px 5px rgba(0,0,0,0.3)",
                  }
                : {
                    background: "oklch(var(--muted) / 0.4)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "oklch(var(--muted-foreground))",
                    boxShadow:
                      "3px 3px 7px rgba(0,0,0,0.45), -2px -2px 5px rgba(255,255,255,0.04)",
                  }
            }
          >
            {DAY_LABELS[i]}
          </button>
        );
      })}
    </div>
  );
}
