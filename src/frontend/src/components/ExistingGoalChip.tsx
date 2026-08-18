import { Check, Lock } from "lucide-react";
import type { HabitPublic, ReusableGoalPublic } from "../backend.d.ts";

/**
 * Minimal shape of an existing goal needed to render a reuse chip.
 * Accepts either:
 *   - a `HabitPublic` subset from the backend (which has `id`, `wish`,
 *     `state`, etc.) — used by parent pages that pass goals straight from
 *     their `useQuery(['myGoals'])` cache, OR
 *   - a `ReusableGoalPublic` from listMyReusableGoals() (which has `id`,
 *     `wish`, `wishDescription`, `state`, `category`) — the canonical source
 *     for the reuse chips.
 *
 * `wishDescription` is optional here only for backwards compatibility with
 * callers that still pass `Pick<HabitPublic, 'id' | 'wish' | 'state'>`. The
 * chip itself renders only `goal.wish` (the macro goal name); the habit
 * name (`wishDescription`) is NOT shown on the chip, but it remains on the
 * goal object so `WoopWizard.handleReuseGoal` can fill the habit form field
 * on selection.
 *
 * NOTE: The old `GoalPublic` type was removed from the generated
 * backend.d.ts (split into MacroGoalPublic + HabitPublic). This file now
 * uses HabitPublic, which carries the same `id`, `wish`, `state`, and
 * `wishDescription` fields the chip reads.
 */
export type ExistingGoalChipGoal = Pick<
  HabitPublic,
  "id" | "wish" | "state"
> & {
  wishDescription?: string;
};

/**
 * Accepts either a HabitPublic subset or a ReusableGoalPublic. Both shapes
 * carry `id`, `wish`, and `state`; ReusableGoalPublic additionally carries
 * `wishDescription` and `category`. The chip renders only `goal.wish` (the
 * macro goal name). `wishDescription` (the keystone habit name) is kept on
 * the goal object so `WoopWizard.handleReuseGoal` can use it to fill the
 * habit form field on selection, but it is intentionally not displayed on
 * the chip.
 */
export interface ExistingGoalChipProps {
  /** The existing goal to render as a tappable chip. */
  goal: ExistingGoalChipGoal | ReusableGoalPublic;
  /** Whether this chip is the currently-selected reused goal. */
  selected: boolean;
  /** Invoked when the user taps the chip. */
  onSelect: (goal: ExistingGoalChipProps["goal"]) => void;
  /** Stable 1-based index for deterministic test markers. */
  index: number;
}

/**
 * ExistingGoalChip — renders a single existing goal as a tappable neumorphic
 * chip showing ONLY the macro goal name (`goal.wish`). The keystone habit
 * name (`goal.wishDescription`) is intentionally NOT rendered on the chip;
 * it remains on the goal object so `WoopWizard.handleReuseGoal` can use it
 * to fill the habit form field on selection.
 *
 * Uses the dedicated `.chip-goal-reuse` styling language from index.css
 * (added by the design agent for this feature): a full-width wrapping
 * neumorphic chip with a 3px emerald left accent bar, hover lift, and a
 * `.filled` state for the selected chip.
 *
 * The chip is a real <button> for keyboard accessibility. When selected it
 * shows BOTH a checkmark AND a "Reusing" pill badge with a lock icon — a
 * clearer selected/reusing state than just a checkmark, so the user
 * immediately understands they are reusing a previously-made (immutable)
 * goal and that the goal text will be locked read-only. Long goal text
 * wraps naturally so the full wish is always visible (per the user
 * instruction "each chip shows the full goal text").
 */
export default function ExistingGoalChip({
  goal,
  selected,
  onSelect,
  index,
}: ExistingGoalChipProps) {
  return (
    <button
      type="button"
      data-ocid={`woop_wizard.existing_goal_chip.${index}`}
      aria-pressed={selected}
      aria-label={`Reuse goal: ${goal.wish}`}
      onClick={() => onSelect(goal)}
      className={`chip-goal-reuse text-left text-sm leading-snug px-3.5 py-2.5 max-w-full ${
        selected ? "filled" : ""
      }`}
    >
      <span className="flex items-start gap-2 min-w-0">
        {selected && (
          <Check size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className="break-words block">{goal.wish}</span>
          {selected && (
            <span
              className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest"
              style={{
                background: "oklch(var(--goal-reuse-accent) / 0.18)",
                color: "oklch(var(--goal-reuse-accent))",
                border: "1px solid oklch(var(--goal-reuse-accent) / 0.45)",
                boxShadow: "0 0 8px oklch(var(--goal-reuse-accent) / 0.25)",
              }}
              data-ocid={`woop_wizard.existing_goal_chip.${index}.reusing_badge`}
            >
              <Lock size={9} aria-hidden="true" />
              Reusing — locked
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
