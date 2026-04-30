import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Menu, User } from "lucide-react";
import { TIER_LABELS } from "../types";
import type { UserProfile } from "../types";

interface HeaderProps {
  profile?: UserProfile | null;
  onMenuClick: () => void;
}

function TierBadge({ tier }: { tier: UserProfile["tier"] }) {
  const label = TIER_LABELS[tier];
  const colorMap = {
    1: "text-muted-foreground border-muted-foreground/40",
    2: "text-[oklch(var(--color-accent-skip))] border-[oklch(var(--color-accent-skip)/0.4)]",
    3: "text-[oklch(var(--color-accent-success))] border-[oklch(var(--color-accent-success)/0.4)]",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border",
        colorMap[tier],
      )}
    >
      {label}
    </span>
  );
}

export function Header({ profile, onMenuClick }: HeaderProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 border-b border-border shadow-neumorphic-emboss-dark"
      style={{
        background: "oklch(var(--card))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <button
        type="button"
        onClick={onMenuClick}
        data-ocid="header.menu_button"
        aria-label="Open navigation menu"
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-smooth",
          "text-muted-foreground hover:text-foreground hover:bg-muted/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 flex items-center justify-center gap-2">
        <h1 className="font-display text-lg font-bold text-foreground tracking-tight">
          Cumulative
        </h1>
        {profile && <TierBadge tier={profile.tier} />}
      </div>

      <Link
        to="/profile"
        data-ocid="header.profile_link"
        aria-label="Go to profile"
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full transition-smooth",
          "bg-muted/30 shadow-neumorphic-emboss-dark",
          "text-muted-foreground hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <User size={18} />
      </Link>
    </header>
  );
}
