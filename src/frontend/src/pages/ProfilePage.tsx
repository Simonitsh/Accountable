import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { useBackend } from "../hooks/useBackend";
import { useUserProfile } from "../hooks/useUserProfile";

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

// ─── EditProfileSection ───────────────────────────────────────────────────────
interface EditProfileSectionProps {
  initialDisplayName: string;
}

function EditProfileSection({ initialDisplayName }: EditProfileSectionProps) {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(initialDisplayName);
  }, [initialDisplayName]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
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
      <div className="flex items-center gap-2">
        <Pencil
          className="w-4 h-4"
          style={{ color: "oklch(var(--color-accent-success))" }}
        />
        <p className="text-sm font-display font-semibold text-foreground">
          Edit Profile
        </p>
      </div>

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
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 blur-2xl bg-primary" />

        {/* Avatar */}
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
        </div>

        {/* Secondary details */}
        <div className="flex flex-col gap-3 border-t border-border/30 pt-3">
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
    </div>
  );
}
