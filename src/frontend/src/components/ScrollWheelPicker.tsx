import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollWheelItem {
  value: number | string;
  label: string;
}

interface ScrollWheelPickerProps {
  items: ScrollWheelItem[];
  value: number | string;
  onChange: (value: number | string) => void;
  accentColor?: string;
  height?: number;
  visibleCount?: number;
  className?: string;
}

/** Convert a hex color + alpha to rgba() string */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(16,185,129,${alpha})`;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ScrollWheelPicker({
  items,
  value,
  onChange,
  accentColor = "#10B981",
  height = 44,
  visibleCount = 5,
  className = "",
}: ScrollWheelPickerProps): React.JSX.Element {
  const totalHeight = height * visibleCount;
  const centerIndex = Math.floor(visibleCount / 2);

  const selectedIndex = items.findIndex((item) => item.value === value);
  const clampedSelected = selectedIndex < 0 ? 0 : selectedIndex;

  // Offset: negative means scrolled down (higher indices visible)
  // offset 0 = index 0 at top; to center index i, offset = centerIndex*height - i*height
  const indexToOffset = useCallback(
    (idx: number) => centerIndex * height - idx * height,
    [centerIndex, height],
  );

  const [snapOffset, setSnapOffset] = useState(() =>
    indexToOffset(clampedSelected),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Live offset during drag (ref to avoid re-renders on every move event)
  const liveOffset = useRef(snapOffset);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const pendingOffset = useRef(snapOffset);

  // Sync when value prop changes externally
  useEffect(() => {
    const idx = items.findIndex((item) => item.value === value);
    if (idx >= 0) {
      const newOffset = indexToOffset(idx);
      liveOffset.current = newOffset;
      pendingOffset.current = newOffset;
      setSnapOffset(newOffset);
    }
  }, [value, items, indexToOffset]);

  const offsetToIndex = useCallback(
    (offset: number) => {
      const raw = (centerIndex * height - offset) / height;
      return Math.round(Math.max(0, Math.min(items.length - 1, raw)));
    },
    [centerIndex, height, items.length],
  );

  const commitIndex = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const finalOffset = indexToOffset(clamped);
      liveOffset.current = finalOffset;
      pendingOffset.current = finalOffset;
      setSnapOffset(finalOffset);
      if (items[clamped].value !== value) {
        onChange(items[clamped].value);
      }
    },
    [items, indexToOffset, onChange, value],
  );

  // ─── Touch handlers ────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartOffset.current = liveOffset.current;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const deltaY = e.touches[0].clientY - dragStartY.current;
    liveOffset.current = dragStartOffset.current + deltaY;
    pendingOffset.current = liveOffset.current;
    // Trigger re-render via rAF
    if (animationRef.current !== null)
      cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(() => {
      setSnapOffset(pendingOffset.current);
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const idx = offsetToIndex(liveOffset.current);
    commitIndex(idx);
  }, [offsetToIndex, commitIndex]);

  // ─── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartOffset.current = liveOffset.current;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartY.current;
      liveOffset.current = dragStartOffset.current + deltaY;
      pendingOffset.current = liveOffset.current;
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(() => {
        setSnapOffset(pendingOffset.current);
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const idx = offsetToIndex(liveOffset.current);
      commitIndex(idx);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, offsetToIndex, commitIndex]);

  // ─── Wheel event ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const currentIdx = offsetToIndex(liveOffset.current);
      const direction = e.deltaY > 0 ? 1 : -1;
      commitIndex(currentIdx + direction);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [offsetToIndex, commitIndex]);

  // ─── Keyboard ───────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = offsetToIndex(liveOffset.current);
        commitIndex(idx + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = offsetToIndex(liveOffset.current);
        commitIndex(idx - 1);
      }
    },
    [offsetToIndex, commitIndex],
  );

  // ─── Derived display offset ─────────────────────────────────────────────────
  // Clamp the live offset so items can't scroll past the list boundaries
  const minOffset = indexToOffset(items.length - 1);
  const maxOffset = indexToOffset(0);
  const displayOffset = Math.max(minOffset, Math.min(maxOffset, snapOffset));

  // ─── Accent colors ──────────────────────────────────────────────────────────
  const accentBand = hexToRgba(accentColor, 0.12);
  const accentBorder = hexToRgba(accentColor, 0.25);
  const accentFocus = hexToRgba(accentColor, 0.5);

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-xl ${className}`}
      style={{
        height: totalHeight,
        background: "oklch(var(--card))",
        boxShadow:
          "inset 2px 2px 8px rgba(0,0,0,0.55), inset -1px -1px 4px rgba(80,80,85,0.12)",
        cursor: isDragging ? "grabbing" : "grab",
        outline: isFocused ? `2px solid ${accentFocus}` : "none",
        outlineOffset: 2,
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      aria-label="Scroll wheel picker"
    >
      {/* Item list */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${displayOffset}px)`,
          transition: isDragging
            ? "none"
            : "transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          willChange: "transform",
        }}
      >
        {items.map((item, idx) => {
          const currentCenterIdx = offsetToIndex(displayOffset);
          const distance = Math.abs(idx - currentCenterIdx);
          const opacity = distance === 0 ? 1.0 : distance === 1 ? 0.55 : 0.25;
          const isSelected = distance === 0;

          return (
            <div
              key={item.value}
              style={{
                height: height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontFamily: "monospace",
                color: "white",
                fontWeight: isSelected ? 600 : 400,
                opacity,
                transition: isDragging
                  ? "none"
                  : "opacity 0.15s ease, font-weight 0.15s ease",
                pointerEvents: "none",
              }}
            >
              {item.label}
            </div>
          );
        })}
      </div>

      {/* Center highlight band */}
      <div
        style={{
          position: "absolute",
          top: centerIndex * height,
          left: 0,
          right: 0,
          height: height,
          background: accentBand,
          borderTop: `1px solid ${accentBorder}`,
          borderBottom: `1px solid ${accentBorder}`,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Top + bottom fade gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, oklch(var(--card)) 0%, transparent 28%, transparent 72%, oklch(var(--card)) 100%)",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />
    </div>
  );
}

export default ScrollWheelPicker;
