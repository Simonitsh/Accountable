import { ChevronDown, Flame } from "lucide-react";
import { motion } from "motion/react";
import type { PartnerOverviewView } from "../hooks/usePartnerHabits";
import { Avatar } from "./Avatar";

interface PartnerOverviewCardProps {
  overview: PartnerOverviewView;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

/**
 * Neumorphic overview card for a single accepted partner.
 *
 * Shows the partner's avatar, displayName/username, active habit count, and a
 * current-streak indicator. A chevron affordance signals that the card is
 * expandable. When expanded, the children (PartnerHabitDetail) are revealed
 * inline with a smooth height animation — expanding one card pushes the
 * others down per the inline-expansion pattern.
 */
export function PartnerOverviewCard({
  overview,
  index,
  isExpanded,
  onToggle,
  children,
}: PartnerOverviewCardProps) {
  const { profile, activeHabitCount, currentStreak } = overview;
  const displayName =
    profile.displayName && profile.displayName.trim().length > 0
      ? profile.displayName.trim()
      : profile.username || "Partner";
  const username =
    profile.username && profile.username.trim().length > 0
      ? `@${profile.username.trim()}`
      : null;

  const hasStreak = currentStreak > 0;
  const habitLabel =
    activeHabitCount === 1
      ? "1 active habit"
      : `${activeHabitCount} active habits`;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.06, 0.3) }}
      className="card-neumorphic bg-card rounded-xl overflow-hidden"
      data-ocid={`partners.overview.card.${index + 1}`}
    >
      {/* Tap target — toggles expansion */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`partner-habits-${overview.key}`}
        aria-label={
          isExpanded
            ? `Collapse habits for ${displayName}`
            : `Expand habits for ${displayName}`
        }
        data-ocid={`partners.overview.toggle.${index + 1}`}
        className="w-full flex items-center gap-3 p-4 text-left transition-smooth hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      >
        {/* Avatar */}
        <span
          className="shrink-0"
          data-ocid={`partners.overview.avatar.${index + 1}`}
        >
          <Avatar
            username={profile.username || displayName}
            avatarShape={profile.avatarShape ?? null}
            avatarColor={profile.avatarColor ?? null}
            colorMode={profile.avatarColorMode ?? "Fill"}
            size="md"
            alt={`${displayName}'s avatar`}
          />
        </span>

        {/* Identity + summary */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="font-display font-semibold text-foreground truncate leading-tight">
            {displayName}
          </span>
          {username && username !== displayName && (
            <span className="text-xs text-muted-foreground truncate font-mono">
              {username}
            </span>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Active habit count chip */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{
                background: "rgba(107,114,128,0.15)",
                border: "1px solid rgba(107,114,128,0.3)",
                color: "oklch(var(--muted-foreground))",
              }}
            >
              {habitLabel}
            </span>

            {/* Current streak indicator — coral social accent */}
            {hasStreak && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  background: "oklch(var(--color-accent-social) / 0.14)",
                  border: "1px solid oklch(var(--color-accent-social) / 0.45)",
                  color: "oklch(var(--color-accent-social))",
                }}
                aria-label={`Current streak: ${currentStreak} day${currentStreak === 1 ? "" : "s"}`}
                data-ocid={`partners.overview.streak.${index + 1}`}
              >
                <Flame size={11} aria-hidden="true" />
                {currentStreak}d
              </span>
            )}
          </div>
        </div>

        {/* Chevron affordance */}
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
          style={{
            background: isExpanded
              ? "oklch(var(--color-accent-social) / 0.12)"
              : "transparent",
            color: isExpanded
              ? "oklch(var(--color-accent-social))"
              : "oklch(var(--muted-foreground))",
          }}
          aria-hidden="true"
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      {/* Expanded detail — inline reveal */}
      <motion.div
        id={`partner-habits-${overview.key}`}
        initial={false}
        animate={
          isExpanded
            ? { height: "auto", opacity: 1 }
            : { height: 0, opacity: 0 }
        }
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        style={{ overflow: "hidden" }}
        aria-hidden={!isExpanded}
        data-ocid={`partners.overview.detail.${index + 1}`}
      >
        {isExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border/40">
            {children}
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}
