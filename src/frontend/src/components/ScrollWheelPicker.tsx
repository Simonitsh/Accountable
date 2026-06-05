import { useEffect, useRef } from "react";

interface ScrollWheelPickerProps {
  values: string[];
  selectedValue: string;
  onChange: (value: string) => void;
  accentColor?: string;
  disabled?: boolean;
  "data-ocid"?: string;
}

export function ScrollWheelPicker({
  values,
  selectedValue,
  onChange,
  accentColor = "#10B981",
  disabled = false,
  "data-ocid": dataOcid,
}: ScrollWheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemHeight = 40;
  const selectedIndex = values.indexOf(selectedValue);

  // Scroll to selected item on mount / selectedValue change (instant, no CSS-snap fight)
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0) {
      containerRef.current.scrollTop = selectedIndex * itemHeight;
    }
  }, [selectedIndex]);

  // After the user stops scrolling, snap smoothly to the nearest item.
  // We debounce so we only fire once per gesture.
  const handleScroll = () => {
    if (disabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollPos = containerRef.current.scrollTop;
      const index = Math.round(scrollPos / itemHeight);
      const clampedIndex = Math.max(0, Math.min(values.length - 1, index));
      const targetTop = clampedIndex * itemHeight;
      // Smooth-scroll to snap position after momentum settles
      containerRef.current.scrollTo({ top: targetTop, behavior: "smooth" });
      onChange(values[clampedIndex]);
    }, 150);
  };

  return (
    <div
      data-ocid={dataOcid}
      className={`relative w-full rounded-xl overflow-hidden transition-opacity duration-200 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      style={{
        background: "oklch(var(--card))",
        border: `1px solid ${accentColor}25`,
        boxShadow:
          "inset 2px 2px 6px rgba(0,0,0,0.45), inset -1px -1px 3px rgba(80,80,85,0.15)",
        height: itemHeight * 5,
      }}
    >
      {/* Highlight band for selected item */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-10"
        style={{
          top: itemHeight * 2,
          height: itemHeight,
          background: `${accentColor}10`,
          borderTop: `1px solid ${accentColor}20`,
          borderBottom: `1px solid ${accentColor}20`,
        }}
      />
      <div
        ref={containerRef}
        className="w-full overflow-y-auto scrollbar-hide"
        style={{
          height: itemHeight * 5,
          paddingTop: itemHeight * 2,
          paddingBottom: itemHeight * 2,
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={handleScroll}
      >
        {values.map((val) => {
          const isSelected = val === selectedValue;
          return (
            <div
              key={val}
              className="flex items-center justify-center font-mono text-base transition-colors duration-150"
              style={{
                height: itemHeight,
                scrollSnapAlign: "center",
                color: isSelected ? accentColor : "oklch(var(--foreground))",
                fontWeight: isSelected ? 700 : 400,
                fontSize: isSelected ? "1.1rem" : "1rem",
              }}
            >
              {val}
            </div>
          );
        })}
      </div>
    </div>
  );
}
