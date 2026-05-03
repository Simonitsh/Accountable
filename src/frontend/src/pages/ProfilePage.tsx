import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { UserProfilePublic } from "../backend.d.ts";
import { useAuth } from "../hooks/useAuth";
import { useBackend } from "../hooks/useBackend";
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

// ─── EditProfileSection ───────────────────────────────────────────────────────
interface EditProfileSectionProps {
  initialDisplayName: string;
}

function EditProfileSection({ initialDisplayName }: EditProfileSectionProps) {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saved, setSaved] = useState(false);

  // Keep field in sync if profile loads after mount
  useEffect(() => {
    setDisplayName(initialDisplayName);
  }, [initialDisplayName]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      // updateMyProfile expects string | null — pass null for empty strings
      const nameArg = displayName.trim().length > 0 ? displayName.trim() : null;
      return await actor.updateMyProfile(nameArg, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.refetchQueries({ queryKey: ["userProfile"] });
      setSaved(true);
      toast.success("Profile updated.");
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update profile.");
    },
  });

  const isDirty = displayName.trim() !== initialDisplayName;

  return (
    <div
      className="flex flex-col gap-4 p-5 rounded-2xl bg-card card-neumorphic border border-border/40"
      data-ocid="profile.edit_section"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Pencil
          className="w-4 h-4"
          style={{ color: "oklch(var(--color-accent-success))" }}
        />
        <p className="text-sm font-display font-semibold text-foreground">
          Edit Profile
        </p>
      </div>

      {/* Display name — optional */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label
            htmlFor="profile-display-name"
            className="text-xs text-muted-foreground uppercase tracking-wide font-medium"
          >
            Display Name
          </label>
          <span className="text-xs font-medium text-muted-foreground rounded border border-border/50 px-1.5 py-0.5">
            Optional
          </span>
        </div>
        <input
          id="profile-display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Sarah"
          className="w-full rounded-xl px-4 py-3 text-sm text-foreground bg-background border border-border/50 outline-none focus:border-primary/60 transition-smooth placeholder:text-muted-foreground/50"
          data-ocid="profile.display_name_input"
        />
        <p className="text-xs text-muted-foreground">
          This is how the dashboard will greet you.
        </p>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={() => updateMutation.mutate()}
        disabled={!isDirty || updateMutation.isPending}
        className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-display font-semibold text-sm transition-smooth disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: saved
            ? "oklch(var(--color-accent-success) / 0.16)"
            : "oklch(var(--color-accent-success) / 0.14)",
          color: "oklch(var(--color-accent-success))",
          boxShadow: isDirty
            ? "0 0 16px 2px oklch(var(--color-accent-success) / 0.18)"
            : "none",
        }}
        data-ocid="profile.save_button"
      >
        {updateMutation.isPending ? (
          <span className="animate-pulse">Saving…</span>
        ) : saved ? (
          <>
            <Check className="w-4 h-4" />
            Saved
          </>
        ) : (
          "Save changes"
        )}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// Map backend SubscriptionTier enum to local numeric tier for display/colours
function toNumericTier(tier: UserProfilePublic["tier"]): SubscriptionTier {
  if (tier === "tier3") return 3;
  if (tier === "tier2") return 2;
  return 1;
}

export function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const { principalText } = useAuth();

  if (isLoading) {
    return (
      <div
        className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto pb-24"
        data-ocid="profile.loading_state"
      >
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  const tier = profile ? toNumericTier(profile.tier) : (1 as SubscriptionTier);
  const tierColour = TIER_COLOURS[tier];
  const defaultLimit = TIER_GOAL_LIMITS[tier];
  const isOverridden = profile
    ? Number(profile.goalLimit) !== defaultLimit
    : false;

  const avatarInitial =
    profile?.displayName && profile.displayName.trim() !== ""
      ? profile.displayName.trim()[0].toUpperCase()
      : profile?.username && profile.username.trim() !== ""
        ? profile.username.trim()[0].toUpperCase()
        : null;
  const displayName =
    profile?.displayName && profile.displayName.trim() !== ""
      ? profile.displayName.trim()
      : "";

  return (
    <div
      className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto pb-24"
      data-ocid="profile.page"
    >
      {/* Identity card */}
      <div className="relative flex flex-col gap-4 p-5 rounded-2xl bg-card card-neumorphic border border-border/20 overflow-hidden">
        {/* Subtle glow blob */}
        <div
          className={`absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl bg-primary ${tierColour.glow}`}
        />

        {/* Avatar — initial or generic icon */}
        <div className="flex flex-col items-center gap-2 relative pt-2">
          <div
            className="flex items-center justify-center w-20 h-20 rounded-full select-none"
            style={{
              background: "oklch(0.22 0.01 260)",
              boxShadow:
                "inset 3px 3px 8px oklch(0.14 0.01 260), inset -3px -3px 8px oklch(0.30 0.01 260)",
            }}
            aria-label="Your avatar"
            data-ocid="profile.avatar"
          >
            {avatarInitial ? (
              <span
                className="font-display font-bold text-3xl"
                style={{ color: "oklch(var(--color-accent-success))" }}
              >
                {avatarInitial}
              </span>
            ) : (
              <User
                className="w-9 h-9"
                style={{ color: "oklch(var(--color-accent-success) / 0.7)" }}
              />
            )}
          </div>

          {/* Display name (primary) */}
          <div className="text-center">
            {displayName ? (
              <p
                className="font-display text-xl font-bold text-foreground"
                data-ocid="profile.display_name"
              >
                {displayName}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No display name set
              </p>
            )}
            {profile?.role === "admin" && (
              <Badge className="bg-primary/20 text-accent-success border-primary/30 text-xs mt-1">
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

        {/* Secondary details */}
        <div className="flex flex-col gap-3 border-t border-border/30 pt-3">
          {/* Username */}
          {profile?.username && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Username
              </p>
              <p className="text-sm text-foreground font-mono">
                @{profile.username}
              </p>
            </div>
          )}

          {/* Principal ID */}
          {principalText && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Principal ID
              </p>
              <CopyPrincipal principal={principalText} />
            </div>
          )}
        </div>
      </div>

      {/* Edit profile */}
      <EditProfileSection initialDisplayName={displayName} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Subscription"
          value={TIER_LABELS[tier]}
          sub={`Tier ${tier}`}
        />
        <StatCard
          label="Goal Limit"
          value={profile ? Number(profile.goalLimit) : defaultLimit}
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
            Up to{" "}
            <strong>
              {profile ? Number(profile.goalLimit) : defaultLimit}
            </strong>{" "}
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
              Advanced analytics &amp; consistency charts
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
