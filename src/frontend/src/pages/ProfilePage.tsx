import { useNavigate } from "@tanstack/react-router";
import { Mail, Pencil, User } from "lucide-react";
import { useUserProfile } from "../hooks/useUserProfile";

import { Skeleton } from "@/components/ui/skeleton";

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
