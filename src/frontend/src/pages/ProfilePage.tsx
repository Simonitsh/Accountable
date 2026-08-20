import { useNavigate } from "@tanstack/react-router";
import { Check, Copy, Fingerprint, Mail, Pencil } from "lucide-react";
import { useState } from "react";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";

import { Skeleton } from "@/components/ui/skeleton";

// ─── Page ─────────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const { principalText } = useAuth();
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  // One-click copy of the signed-in user's Principal. Mirrors the exact
  // handleCopy pattern from MyIdTab.tsx: navigator.clipboard.writeText with a
  // hidden-textarea fallback, and a 2s "Copied!" confirmation state. The FULL
  // principal string is always copied even though the displayed value is
  // truncated for layout.
  const handleCopyPrincipal = async () => {
    if (!principalText) return;
    try {
      await navigator.clipboard.writeText(principalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without the async clipboard API
      const ta = document.createElement("textarea");
      ta.value = principalText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

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
            <span data-ocid="profile.avatar">
              <Avatar
                username={profile?.username ?? ""}
                avatarShape={profile?.avatarShape ?? null}
                avatarColor={profile?.avatarColor ?? null}
                colorMode={profile?.avatarColorMode ?? "Fill"}
                size="xl"
                alt="Your avatar"
              />
            </span>

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

            {/* Account ID (Principal) — discreet but easy to find.
                Sits with the other identity fields, after Email and before Bio.
                Labelled "Your ID" for non-technical users; "Principal" appears
                as a small subtitle. The displayed value is truncated with
                ellipsis for layout, but the copy button always copies the
                FULL principal string. */}
            <div className="flex flex-col gap-2" data-ocid="profile.account_id">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Fingerprint className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                      Your ID
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 normal-case tracking-normal">
                      Principal
                    </span>
                  </div>
                </div>

                {principalText ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-sm text-foreground font-mono truncate max-w-[180px] sm:max-w-[240px]"
                      title={principalText}
                      data-ocid="profile.account_id_text"
                    >
                      {principalText}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPrincipal}
                      aria-label="Copy your account ID"
                      className={`flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg transition-smooth border ${
                        copied
                          ? "bg-accent-social/20 text-foreground border-accent-social/40 shadow-neumorphic-inset"
                          : "bg-secondary text-secondary-foreground border-transparent hover:border-accent-social/40"
                      }`}
                      style={{
                        boxShadow: copied
                          ? undefined
                          : "-2px -2px 5px rgba(80, 80, 85, 0.35), 3px 3px 7px rgba(0, 0, 0, 0.7)",
                      }}
                      data-ocid="profile.copy_account_id_button"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    Not signed in
                  </span>
                )}
              </div>

              {/* One-line non-technical hint explaining what the ID is for */}
              <p className="text-xs text-muted-foreground/80 leading-relaxed pl-6">
                This ID identifies your account. Copy it to share with an admin
                so they can grant you access.
              </p>
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
