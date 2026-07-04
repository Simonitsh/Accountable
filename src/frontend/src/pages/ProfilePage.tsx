import { useNavigate } from "@tanstack/react-router";
import { Mail, Pencil, User } from "lucide-react";
import { useUserProfile } from "../hooks/useUserProfile";

import { Skeleton } from "@/components/ui/skeleton";

// ─── Archetype definitions ────────────────────────────────────────────────────

const ARCHETYPE_NAMES = [
  "Oak",
  "River",
  "Wolf",
  "Owl",
  "Mountain",
  "Fire",
  "Bamboo",
  "Honeycomb",
  "Wind",
  "Tide",
] as const;

type ArchetypeName = (typeof ARCHETYPE_NAMES)[number];

// ─── Archetype SVG icons (inline React components) ──────────────────────────

function OakIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Oak archetype icon"
    >
      <title>Oak</title>
      <path d="M32 56V28" />
      <path d="M32 28C32 28 20 20 20 12C20 6 25 2 32 2C39 2 44 6 44 12C44 20 32 28 32 28Z" />
      <path d="M32 36C32 36 16 32 12 24" />
      <path d="M32 40C32 40 48 36 52 28" />
      <path d="M32 44C32 44 22 48 18 52" />
      <path d="M32 48C32 48 42 52 46 56" />
    </svg>
  );
}

function RiverIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="River archetype icon"
    >
      <title>River</title>
      <path d="M8 20C16 16 24 24 32 20C40 16 48 24 56 20" />
      <path d="M8 32C16 28 24 36 32 32C40 28 48 36 56 32" />
      <path d="M8 44C16 40 24 48 32 44C40 40 48 48 56 44" />
      <path d="M12 52C20 48 28 56 36 52" />
    </svg>
  );
}

function WolfIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Wolf archetype icon"
    >
      <title>Wolf</title>
      <path d="M20 48L12 56L16 40L8 32L20 28L24 12L32 20L40 12L44 28L56 32L48 40L52 56L44 48" />
      <circle cx="26" cy="30" r="2" fill="currentColor" stroke="none" />
      <circle cx="38" cy="30" r="2" fill="currentColor" stroke="none" />
      <path d="M28 38L32 42L36 38" />
    </svg>
  );
}

function OwlIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Owl archetype icon"
    >
      <title>Owl</title>
      <ellipse cx="32" cy="34" rx="18" ry="20" />
      <circle cx="24" cy="30" r="6" />
      <circle cx="40" cy="30" r="6" />
      <circle cx="24" cy="30" r="2" fill="currentColor" stroke="none" />
      <circle cx="40" cy="30" r="2" fill="currentColor" stroke="none" />
      <path d="M30 38L32 40L34 38" />
      <path d="M18 18L24 24" />
      <path d="M46 18L40 24" />
      <path d="M28 54C28 54 32 58 36 54" />
    </svg>
  );
}

function MountainIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Mountain archetype icon"
    >
      <title>Mountain</title>
      <path d="M8 52L24 20L32 36L40 16L56 52Z" />
      <path d="M24 20L28 28" />
      <path d="M40 16L44 24" />
      <path d="M18 36L22 40" />
      <path d="M46 32L50 36" />
    </svg>
  );
}

function FireIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Fire archetype icon"
    >
      <title>Fire</title>
      <path d="M32 8C32 8 20 20 20 32C20 42 26 50 32 54C38 50 44 42 44 32C44 20 32 8 32 8Z" />
      <path d="M32 24C32 24 26 30 26 36C26 42 30 46 32 48C34 46 38 42 38 36C38 30 32 24 32 24Z" />
      <path d="M16 40C16 40 12 44 14 48" />
      <path d="M48 40C48 40 52 44 50 48" />
    </svg>
  );
}

function BambooIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Bamboo archetype icon"
    >
      <title>Bamboo</title>
      <path d="M24 56V12" />
      <path d="M40 56V12" />
      <path d="M24 20H40" />
      <path d="M24 32H40" />
      <path d="M24 44H40" />
      <path d="M20 8C20 8 24 4 28 8" />
      <path d="M36 8C36 8 40 4 44 8" />
      <path d="M18 52C18 52 22 56 26 52" />
      <path d="M38 52C38 52 42 56 46 52" />
    </svg>
  );
}

function HoneycombIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Honeycomb archetype icon"
    >
      <title>Honeycomb</title>
      <path d="M32 8L44 16V32L32 40L20 32V16Z" />
      <path d="M32 40L44 48V56" />
      <path d="M32 40L20 48V56" />
      <path d="M44 32L56 40V48" />
      <path d="M20 32L8 40V48" />
      <path d="M44 16L56 24V32" />
      <path d="M20 16L8 24V32" />
    </svg>
  );
}

function WindIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Wind archetype icon"
    >
      <title>Wind</title>
      <path d="M8 24H48C52 24 56 20 56 16C56 12 52 8 48 8" />
      <path d="M8 36H40C44 36 48 40 48 44C48 48 44 52 40 52" />
      <path d="M8 48H32" />
      <path d="M12 12H24" />
    </svg>
  );
}

function TideIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Tide archetype icon"
    >
      <title>Tide</title>
      <path d="M8 28C16 20 24 20 32 28C40 36 48 36 56 28" />
      <path d="M8 40C16 32 24 32 32 40C40 48 48 48 56 40" />
      <path d="M8 52C16 44 24 44 32 52C40 60 48 60 56 52" />
      <path d="M32 8V16" />
      <path d="M28 12L32 8L36 12" />
    </svg>
  );
}

const ARCHETYPE_ICONS: Record<
  ArchetypeName,
  React.FC<{ className?: string }>
> = {
  Oak: OakIcon,
  River: RiverIcon,
  Wolf: WolfIcon,
  Owl: OwlIcon,
  Mountain: MountainIcon,
  Fire: FireIcon,
  Bamboo: BambooIcon,
  Honeycomb: HoneycombIcon,
  Wind: WindIcon,
  Tide: TideIcon,
};

// ─── ArchetypeAvatar component ────────────────────────────────────────────────

function ArchetypeAvatar({
  archetype,
  size = "lg",
}: { archetype: string; size?: "sm" | "md" | "lg" }) {
  const isValid = ARCHETYPE_NAMES.includes(archetype as ArchetypeName);
  const Icon = isValid ? ARCHETYPE_ICONS[archetype as ArchetypeName] : null;

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-9 h-9",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-full select-none ${sizeClasses[size]}`}
      style={{
        background: "oklch(0.22 0.01 260)",
        boxShadow:
          "inset 3px 3px 8px oklch(0.14 0.01 260), inset -3px -3px 8px oklch(0.30 0.01 260)",
      }}
      aria-label={`Your archetype: ${archetype || "none selected"}`}
      data-ocid="profile.avatar"
    >
      {Icon ? (
        <Icon className={`${iconSizes[size]} text-accent-success`} />
      ) : (
        <User
          className={`${iconSizes[size]}`}
          style={{ color: "oklch(var(--color-accent-success) / 0.7)" }}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div
        className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto pb-24"
        data-ocid="profile.loading_state"
      >
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  const displayName =
    profile?.displayName && profile.displayName.trim() !== ""
      ? profile.displayName.trim()
      : "";

  const hasBio = (profile?.bio ?? "").trim().length > 0;

  return (
    <>
      <div
        className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto pb-24"
        data-ocid="profile.page"
      >
        {/* ── Identity card ────────────────────────────────── */}
        <div
          className="relative flex flex-col gap-5 p-6 rounded-2xl bg-card card-neumorphic border border-white/[0.07] overflow-hidden"
          style={{
            boxShadow:
              "6px 6px 16px oklch(0.12 0.01 260), -4px -4px 12px oklch(0.28 0.01 260), inset 0 1px 0 oklch(1 0 0 / 0.06)",
          }}
        >
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 pt-1">
            <ArchetypeAvatar
              archetype={profile?.avatarArchetype ?? ""}
              size="lg"
            />

            <div className="text-center">
              {displayName ? (
                <p
                  className="font-display text-xl font-bold text-foreground leading-tight"
                  data-ocid="profile.display_name"
                >
                  {displayName}
                </p>
              ) : (
                <p className="text-base font-display font-semibold text-muted-foreground">
                  {profile?.username ?? ""}
                </p>
              )}
              {profile?.username && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  @{profile.username}
                </p>
              )}
              {profile?.avatarArchetype && (
                <p
                  className="text-xs font-mono tracking-widest uppercase mt-1"
                  style={{ color: "oklch(var(--color-accent-success))" }}
                  data-ocid="profile.archetype_label"
                >
                  {profile.avatarArchetype}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/30" />

          {/* Meta fields */}
          <div className="flex flex-col gap-4">
            {/* Email */}
            <div
              className="flex items-center justify-between"
              data-ocid="profile.email"
            >
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Email
                </span>
              </div>
              {profile?.email ? (
                <span className="text-sm text-foreground font-mono">
                  {profile.email}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  No email set
                </span>
              )}
            </div>

            {/* Bio / Macro Wish */}
            <div
              className="flex flex-col gap-2"
              data-ocid="profile.bio_section"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: "oklch(var(--color-accent-success))",
                  }}
                />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  About Your Journey
                </span>
              </div>

              {hasBio ? (
                <div
                  className="rounded-xl px-4 py-3 text-sm text-foreground leading-relaxed"
                  style={{
                    background: "oklch(var(--color-accent-success) / 0.06)",
                    borderLeft:
                      "3px solid oklch(var(--color-accent-success) / 0.45)",
                  }}
                  data-ocid="profile.bio_display"
                >
                  {profile?.bio}
                </div>
              ) : (
                <p
                  className="text-sm text-muted-foreground italic px-1"
                  data-ocid="profile.bio_empty_state"
                >
                  No Macro Wish set yet.
                </p>
              )}
            </div>
          </div>

          {/* Edit Profile button */}
          <button
            type="button"
            onClick={() => navigate({ to: "/profile/edit" })}
            className="flex items-center justify-center gap-2 w-full rounded-xl px-5 py-3 font-display font-semibold text-sm transition-smooth"
            style={{
              backgroundColor: "oklch(var(--color-accent-success) / 0.12)",
              color: "oklch(var(--color-accent-success))",
              border: "1px solid oklch(var(--color-accent-success) / 0.25)",
            }}
            data-ocid="profile.edit_profile_button"
          >
            <Pencil className="w-4 h-4" />
            Edit Profile
          </button>
        </div>
      </div>
    </>
  );
}
