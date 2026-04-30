import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Copy, User } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { TIER_GOAL_LIMITS, TIER_LABELS } from "../types";
import type { SubscriptionTier } from "../types";

// ─── Tier colour map ──────────────────────────────────────────────────────────
const TIER_COLOURS: Record<SubscriptionTier, { badge: string; glow: string }> =
  {
    1: { badge: "bg-muted text-muted-foreground border-border/60", glow: "" },
    2: {
      badge: "bg-secondary/20 text-accent-skip border-secondary/30",
      glow: "shadow-glow-skip",
    },
    3: {
      badge: "bg-primary/20 text-accent-success border-primary/30",
      glow: "shadow-glow-success",
    },
  };

// ─── CopyPrincipal ────────────────────────────────────────────────────────────
function CopyPrincipal({ principal }: { principal: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(principal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncated =
    principal.length > 24
      ? `${principal.slice(0, 10)}…${principal.slice(-8)}`
      : principal;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border/50 transition-smooth hover:border-primary/40 group"
      aria-label="Copy principal to clipboard"
      data-ocid="profile.copy_principal_button"
    >
      <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-smooth truncate max-w-[200px]">
        {truncated}
      </span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-accent-success flex-shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-smooth" />
      )}
    </button>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-card card-neumorphic border border-border/40">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </p>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const { principalText } = useAuth();

  if (isLoading) {
    return (
      <div
        className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto pb-24"
        data-ocid="profile.loading_state"
      >
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  const tier = (profile?.tier ?? 1) as SubscriptionTier;
  const tierColour = TIER_COLOURS[tier];
  const defaultLimit = TIER_GOAL_LIMITS[tier];
  const isOverridden = profile?.goalLimit !== defaultLimit;

  return (
    <div
      className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto pb-24"
      data-ocid="profile.page"
    >
      {/* Identity card */}
      <div className="relative flex flex-col gap-3 p-5 rounded-2xl bg-card card-neumorphic border border-border/40 overflow-hidden">
        {/* Subtle glow blob */}
        <div
          className={`absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl bg-primary ${tierColour.glow}`}
        />
        <div className="flex items-center gap-4 relative">
          {/* Avatar */}
          <div
            className={`w-14 h-14 rounded-full bg-muted flex items-center justify-center ${tierColour.glow} border-2 border-border/40`}
          >
            <User className="w-7 h-7 text-muted-foreground" />
          </div>

          {/* Name + tier */}
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg font-bold text-foreground truncate">
              {profile?.username ?? "Unknown"}
            </p>
            {profile?.role === "admin" && (
              <Badge className="bg-primary/20 text-accent-success border-primary/30 text-xs mt-0.5">
                Admin
              </Badge>
            )}
          </div>

          {/* Tier badge */}
          <Badge
            className={`text-xs font-semibold ${tierColour.badge}`}
            data-ocid="profile.tier_badge"
          >
            {TIER_LABELS[tier]}
          </Badge>
        </div>

        {/* Principal */}
        {principalText && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Principal ID
            </p>
            <CopyPrincipal principal={principalText} />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Subscription"
          value={TIER_LABELS[tier]}
          sub={`Tier ${tier}`}
        />
        <StatCard
          label="Goal Limit"
          value={profile?.goalLimit ?? defaultLimit}
          sub={isOverridden ? "Admin override active" : `Tier ${tier} default`}
        />
      </div>

      {/* Tier perks */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border/30 flex flex-col gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          What you get
        </p>
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2 text-sm text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-success flex-shrink-0" />
            Up to <strong>{profile?.goalLimit ?? defaultLimit}</strong>{" "}
            concurrent goals
          </li>
          <li className="flex items-center gap-2 text-sm text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-success flex-shrink-0" />
            WOOP goal builder with obstacle planning
          </li>
          <li className="flex items-center gap-2 text-sm text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-success flex-shrink-0" />
            Accountability partner feed
          </li>
          {tier >= 2 && (
            <li className="flex items-center gap-2 text-sm text-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-skip flex-shrink-0" />
              Advanced analytics &amp; streak charts
            </li>
          )}
          {tier >= 3 && (
            <li className="flex items-center gap-2 text-sm text-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-success flex-shrink-0" />
              Priority support &amp; early features
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
