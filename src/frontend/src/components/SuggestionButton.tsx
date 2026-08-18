import { type SuggestionField, getSuggestions } from "@/lib/suggestions";
import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export interface SuggestionButtonProps {
  category: string;
  field: SuggestionField;
  onSelect: (value: string) => void;
  disabled?: boolean;
  /**
   * Kept for API stability. Previously controlled absolute vertical
   * positioning of the chevron inside the paired input. The chevron is
   * now a normal flex sibling sitting beside the input, so vertical
   * alignment is owned entirely by the parent row's `items-start` (for
   * multi-line textareas) or `items-center` (for single-line inputs).
   * This prop no longer affects layout.
   */
  alignTop?: boolean;
}

// ─── Single-open coordination store ──────────────────────────────────────────
//
// App-wide registry that ensures only ONE SuggestionButton dropdown is open
// at a time, regardless of which page, form region, or wizard step the other
// instance lives in. Implemented as a module-level external store consumed via
// `useSyncExternalStore` so it requires NO provider wrapping and NO changes to
// any of the 10 call sites — every SuggestionButton instance simply reads the
// shared `openId` and writes its own `triggerId` (or `null`) when it opens or
// closes.
//
// Invariants:
//  - `openId` is either `null` (nothing open) or a single triggerId string.
//  - When an instance opens, it sets `openId = triggerId`. Any other instance
//    whose local open state was `true` re-renders with `open = openId ===
//    triggerId` → `false`, so its inline list unmounts.
//  - When an instance closes (outside click, Escape, or selection), it sets
//    `openId = null`.
//  - Outside-click close is re-implemented manually (Radix no longer provides
//    it): a document `pointerdown` listener checks whether the click landed
//    outside both the chevron button and the inline listbox; if so, it calls
//    `setOpenId(null)`. Escape-to-close is handled by a `keydown` listener on
//    the listbox and the chevron button.

type Listener = () => void;

let openId: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string | null {
  return openId;
}

/**
 * Sets the currently-open suggestion dropdown by triggerId. Pass `null` (or
 * the same triggerId) to close. Setting a different triggerId closes any
 * other currently-open instance.
 */
function setOpenId(next: string | null): void {
  if (next === openId) return;
  openId = next;
  emit();
}

/**
 * SuggestionButton — a clean, separate white chevron that sits BESIDE the
 * paired input/textarea as a normal flex sibling (not an absolute overlay).
 * Clicking the chevron toggles an INLINE listbox that renders in-flow within
 * the parent `relative flex ... gap-2` row, anchored under the input — NOT
 * a portalled pop-over.
 *
 * Positioning contract:
 *  - The trigger is a normal flex item: `h-7 w-7` rounded-md transparent
 *    button containing a white ChevronDown icon. It is NOT absolutely
 *    positioned and does NOT overlay the input.
 *  - Consumers wrap the input + SuggestionButton in a
 *    `relative flex ... gap-2` row. The input takes the available width
 *    (`flex-1` or `w-full`) and the chevron sits beside it as a sibling,
 *    separated by the row's `gap-2`. Long text never tucks under the
 *    chevron because they do not overlap.
 *  - Vertical alignment of the chevron relative to the input is owned by
 *    the parent row's `items-*` utility:
 *      • `items-center` for single-line inputs (chevron vertically centered)
 *      • `items-start` for multi-line textareas (chevron aligns with the
 *        first text line)
 *    The `alignTop` prop is retained for API stability but no longer
 *    affects layout.
 *  - The inline listbox is absolutely positioned within the parent row,
 *    pinned to the row's left edge and top edge (just below the input's
 *    height), spanning the input's width. It overlays any content below
 *    the row rather than pushing it down, matching the previous pop-over
 *    feel while staying in the row's stacking context (no portal).
 *
 * Behavior:
 *  - Click on the chevron toggles the inline listbox of category-aware
 *    suggestions.
 *  - Selecting a suggestion calls onSelect(value) and closes the listbox.
 *  - The listbox closes on outside click, Escape, or selection.
 *  - Only ONE suggestion dropdown may be open at a time across the whole
 *    app: opening this instance closes any other open SuggestionButton
 *    dropdown via the module-level single-open store.
 *  - Keyboard accessible: the chevron is a focusable button; Enter/Space
 *    activates; suggestions are navigable with Arrow Up/Down; Enter
 *    selects; Escape closes and returns focus to the chevron.
 *  - When `disabled` is true the chevron renders dimmed, non-interactive,
 *    and the listbox cannot open (preserves the habitMinutes-when-isLockIn
 *    state).
 *
 * No Radix Popover. No portal. Outside-click and Escape are handled
 * manually via document listeners.
 */
export default function SuggestionButton({
  category,
  field,
  onSelect,
  disabled = false,
  alignTop: _alignTop = false,
}: SuggestionButtonProps) {
  const triggerId = useId();
  const listId = `${triggerId}-listbox`;
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // App-wide single-open registry. `sharedOpenId` is the triggerId of the
  // currently-open dropdown, or null. This instance is open iff it owns the
  // registry: `sharedOpenId === triggerId`.
  const sharedOpenId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  const open = sharedOpenId === triggerId;

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const suggestions = getSuggestions(category, field);
  const hasSuggestions = suggestions.length > 0;
  const isDisabled = disabled || !hasSuggestions;

  const selectIndex = useCallback(
    (index: number) => {
      const value = suggestions[index];
      if (value === undefined) return;
      onSelect(value);
      setOpenId(null);
    },
    [suggestions, onSelect],
  );

  const close = useCallback(() => {
    setOpenId(null);
    setActiveIndex(-1);
  }, []);

  const openList = useCallback(() => {
    setOpenId(triggerId);
    // Focus the first item after the list mounts.
    requestAnimationFrame(() => {
      setActiveIndex(0);
      itemRefs.current[0]?.focus();
    });
  }, [triggerId]);

  const toggle = useCallback(() => {
    if (isDisabled) return;
    if (open) {
      close();
    } else {
      openList();
    }
  }, [isDisabled, open, close, openList]);

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (isDisabled) return;
    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      if (!open) openList();
      else {
        // Move focus into the first item.
        requestAnimationFrame(() => {
          itemRefs.current[0]?.focus();
        });
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  };

  const handleListItemKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => {
    const last = suggestions.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = index < last ? index + 1 : 0;
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = index > 0 ? index - 1 : last;
      setActiveIndex(prev);
      itemRefs.current[prev]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectIndex(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
      // Return focus to the chevron trigger.
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  };

  // Manual outside-click handling. Radix no longer provides this, so a
  // document `pointerdown` listener closes the list when the click lands
  // outside both the chevron trigger and the inline listbox. Only attached
  // while this instance is open.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target === null) return;
      if (triggerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpenId(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  // Reset activeIndex when the list closes (e.g. another instance opened).
  useEffect(() => {
    if (!open && activeIndex !== -1) {
      setActiveIndex(-1);
    }
  }, [open, activeIndex]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        id={triggerId}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Show suggestions for ${field}`}
        data-ocid={`suggestion.button.${field}`}
        onClick={toggle}
        onKeyDown={handleTriggerKeyDown}
        // Normal flex item: sits beside the input as a sibling, separated
        // by the parent row's `gap-2`. NOT absolutely positioned — long
        // text in the input never tucks under the chevron. Vertical
        // alignment is owned by the parent row's `items-*` utility.
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent p-0 text-foreground/70 outline-none transition-smooth hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-[oklch(var(--color-accent-success))] focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronDown
          className={`h-4 w-4 text-white/80 drop-shadow-sm transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        // Inline listbox — renders in-flow within the parent
        // `relative flex ... gap-2` row. Absolutely positioned so it
        // overlays content below the row instead of pushing it, anchored
        // to the row's left edge and just below the input's height. The
        // parent row is `relative`, so this `absolute` child is contained
        // by it. No portal — stays in the row's stacking context.
        //
        // `top-full` pins the list to the bottom edge of the relative
        // parent (the row), which sits just under the input. `left-0`
        // aligns with the input's left edge. Width matches the input's
        // available width via `w-[calc(100%-1.75rem)]` (row width minus
        // the chevron's 1.75rem footprint and the gap), so the list is
        // visually anchored under the input and never extends under the
        // chevron column.
        <div
          ref={listRef}
          id={listId}
          // biome-ignore lint/a11y/useSemanticElements: custom inline listbox, not a native form select
          role="listbox"
          tabIndex={-1}
          aria-label={`Suggestions for ${field}`}
          data-ocid={`suggestion.dropdown.${field}`}
          className="absolute left-0 top-full z-[400] mt-1 max-w-[min(100vw,20rem)] w-[calc(100%-1.75rem)] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-neumorphic-emboss"
        >
          {suggestions.map((value, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={value}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                // biome-ignore lint/a11y/useSemanticElements: custom inline listbox option, not a native form option
                role="option"
                tabIndex={-1}
                aria-selected={isActive}
                data-ocid={`suggestion.item.${field}.${index}`}
                onClick={() => selectIndex(index)}
                onKeyDown={(e) => handleListItemKeyDown(e, index)}
                className={`cursor-pointer select-none rounded-md px-3 py-2 text-sm transition-smooth outline-none focus-visible:bg-accent-success/15 focus-visible:text-foreground ${
                  isActive
                    ? "bg-accent-success/15 text-foreground"
                    : "text-popover-foreground"
                }`}
              >
                {value}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
