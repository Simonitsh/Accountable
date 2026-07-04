import { cn } from "@/lib/utils";
import {
  ARCHETYPE_NAMES,
  ArchetypeIcon,
  type ArchetypeName,
} from "./ArchetypeIcon";

interface ArchetypeSelectorProps {
  value: ArchetypeName | null;
  onChange: (value: ArchetypeName) => void;
  label?: string;
}

export function ArchetypeSelector({
  value,
  onChange,
  label = "Choose Your Archetype",
}: ArchetypeSelectorProps) {
  return (
    <div className="space-y-3" data-ocid="archetype.selector">
      <div className="flex items-center gap-2">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase"
          style={{
            color: "oklch(var(--color-accent-success))",
            background: "oklch(var(--color-accent-success) / 0.12)",
            border: "1px solid oklch(var(--color-accent-success) / 0.35)",
          }}
        >
          Required
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ARCHETYPE_NAMES.map((name, index) => {
          const isSelected = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              data-ocid={`archetype.item.${index + 1}`}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl p-3 transition-smooth",
                "text-center select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "shadow-neumorphic-inset text-accent-success"
                  : "shadow-neumorphic-emboss text-muted-foreground hover:text-foreground",
              )}
              style={{
                background: "oklch(var(--card))",
                borderTop: isSelected
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "1px solid rgba(255,255,255,0.12)",
                borderLeft: isSelected
                  ? "1px solid rgba(255,255,255,0.04)"
                  : "1px solid rgba(255,255,255,0.07)",
              }}
              aria-pressed={isSelected}
              aria-label={`Select ${name} archetype`}
            >
              <ArchetypeIcon
                name={name}
                size={28}
                className={cn(
                  "transition-smooth",
                  isSelected ? "text-accent-success" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-xs font-semibold tracking-wide transition-smooth",
                  isSelected ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>

      {value && (
        <p
          className="text-xs font-medium text-center"
          data-ocid="archetype.selected_text"
          style={{ color: "oklch(var(--color-accent-success))" }}
        >
          Selected: {value}
        </p>
      )}
    </div>
  );
}
