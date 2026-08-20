import { Trash2 } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Shared card frame for goal/habit list items (used by GoalsPage and
 * MyGoalsPage). Provides the neumorphic card shell, the accent border-left,
 * the entrance animation, and the action column (delete button + optional
 * extra actions). The card content is passed as `children` so each page keeps
 * its own distinct rendering (habit-level vs macro-goal data).
 */
interface GoalCardShellProps {
  /** Border-left accent color (theme color or Lock-In amber). */
  accent: string;
  /** Zero-based index used for the staggered entrance delay. */
  index: number;
  /** data-ocid for the card itself. */
  dataOcid: string;
  /** Fired when the delete button is clicked. */
  onDelete: () => void;
  /** Accessible label for the delete button. */
  deleteLabel: string;
  /** data-ocid for the delete button. */
  deleteDataOcid: string;
  /** Card body — the page-specific title/subtitle/badges content. */
  children: ReactNode;
  /** Optional extra actions rendered after the delete button. */
  actions?: ReactNode;
  /** Extra classes appended to the card (e.g. expanded-state styling). */
  className?: string;
}

export function GoalCardShell({
  accent,
  index,
  dataOcid,
  onDelete,
  deleteLabel,
  deleteDataOcid,
  children,
  actions,
  className,
}: GoalCardShellProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className={`rounded-2xl p-4 card-neumorphic ${className ?? ""}`}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: accent,
      }}
      data-ocid={dataOcid}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        <div className="shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            aria-label={deleteLabel}
            data-ocid={deleteDataOcid}
            onClick={onDelete}
            className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground transition-smooth hover:text-foreground"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "oklch(var(--destructive) / 0.15)";
              e.currentTarget.style.color = "oklch(var(--destructive))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "oklch(var(--muted) / 0.4)";
              e.currentTarget.style.color = "oklch(var(--muted-foreground))";
            }}
          >
            <Trash2 size={14} />
          </button>
          {actions}
        </div>
      </div>
    </motion.article>
  );
}
