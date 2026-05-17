import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Globe, Loader2, Pencil, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useBackend } from "../hooks/useBackend";
import { useUpdateBio, useUserProfile } from "../hooks/useUserProfile";

// ─── EditProfileSheet ─────────────────────────────────────────────────────────
interface EditProfileSheetProps {
  open: boolean;
  onClose: () => void;
  initialDisplayName: string;
  initialBio: string;
}

function EditProfileSheet({
  open,
  onClose,
  initialDisplayName,
  initialBio,
}: EditProfileSheetProps) {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const updateBioMutation = useUpdateBio();

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bioText, setBioText] = useState(initialBio);
  const [bioFocused, setBioFocused] = useState(false);
  const [bioTyped, setBioTyped] = useState(false);

  // Sync when sheet opens with fresh values
  useEffect(() => {
    if (open) {
      setDisplayName(initialDisplayName);
      setBioText(initialBio);
      setBioTyped(false);
      setBioFocused(false);
    }
  }, [open, initialDisplayName, initialBio]);

  const displayNameMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("Actor not available");
      const nameArg = name.trim().length > 0 ? name.trim() : null;
      const result = await actor.updateMyProfile(nameArg, null, null);
      if ("err" in result) throw new Error(String(result.err));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.refetchQueries({ queryKey: ["userProfile"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update display name.");
    },
  });

  const BIO_MAX = 160;
  const bioCount = bioText.length;
  const bioOverLimit = bioCount > BIO_MAX;
  const showBioCounter = bioFocused || bioTyped;

  const isSaving = displayNameMutation.isPending || updateBioMutation.isPending;

  const displayNameChanged = displayName.trim() !== initialDisplayName.trim();
  const bioChanged = bioText.trim() !== initialBio.trim();
  const isDirty = displayNameChanged || bioChanged;

  const handleSave = async () => {
    if (bioOverLimit) return;
    try {
      if (displayNameChanged) {
        await displayNameMutation.mutateAsync(displayName);
      }
      if (bioChanged) {
        await updateBioMutation.mutateAsync(bioText);
      }
      toast.success("Profile updated.");
      onClose();
    } catch {
      // errors are handled per-mutation above
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-t border-border/40 px-0 pb-0"
        style={{
          background: "oklch(var(--card))",
          maxHeight: "90dvh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/30 flex-shrink-0">
          <SheetTitle className="font-display font-semibold text-base text-foreground">
            Edit Profile
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable body */}
        <div
          className="flex flex-col gap-5 px-5 py-5 overflow-y-auto"
          style={{ flex: 1 }}
        >
          {/* Display Name */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label
                htmlFor="edit-display-name"
                className="text-xs text-muted-foreground uppercase tracking-wide font-medium"
              >
                Display Name
              </label>
              <span className="text-xs font-medium text-muted-foreground rounded border border-border/50 px-1.5 py-0.5">
                Optional
              </span>
            </div>
            <input
              id="edit-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Sarah"
              className="w-full rounded-xl px-4 py-3 text-sm text-foreground bg-background border border-border/50 outline-none focus:border-primary/60 transition-smooth placeholder:text-muted-foreground/50"
              data-ocid="profile.edit_sheet.display_name_input"
            />
            <p className="text-xs text-muted-foreground">
              How the dashboard will greet you.
            </p>
          </div>

          {/* Macro Wish / Bio */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-bio"
              className="text-xs text-muted-foreground uppercase tracking-wide font-medium"
            >
              About Your Journey
            </label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your Macro Wish — the ultimate outcome that anchors all your
              habits.
            </p>
            <div className="flex flex-col gap-1">
              <textarea
                id="edit-bio"
                value={bioText}
                onChange={(e) => {
                  setBioText(e.target.value);
                  setBioTyped(true);
                }}
                onFocus={() => setBioFocused(true)}
                onBlur={() => setBioFocused(false)}
                rows={4}
                placeholder="What is the ultimate outcome you are working towards? (e.g., I want to rebuild my fitness to keep up with my kids...)"
                className="w-full rounded-xl px-4 py-3 text-sm text-foreground bg-background border border-border/50 outline-none focus:border-primary/60 transition-smooth placeholder:text-muted-foreground/50 resize-none leading-relaxed"
                data-ocid="profile.edit_sheet.bio_textarea"
              />
              <p
                className="text-xs text-right transition-opacity duration-200"
                style={{
                  color: bioOverLimit
                    ? "oklch(0.65 0.2 25)"
                    : "oklch(var(--muted-foreground))",
                  opacity: showBioCounter ? 1 : 0,
                  pointerEvents: "none",
                }}
                data-ocid="profile.edit_sheet.bio_counter"
              >
                {bioCount} / {BIO_MAX}
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Save button */}
        <div className="px-5 py-4 border-t border-border/30 flex-shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || bioOverLimit || isSaving}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-display font-semibold text-sm transition-smooth disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "oklch(var(--color-accent-success) / 0.14)",
              color: "oklch(var(--color-accent-success))",
            }}
            data-ocid="profile.edit_sheet.save_button"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check
                  className="w-4 h-4"
                  style={{ opacity: isDirty ? 1 : 0.4 }}
                />
                Save Profile
              </>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const [editOpen, setEditOpen] = useState(false);

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
            {/* Timezone */}
            {profile?.timezone && (
              <div
                className="flex items-center justify-between"
                data-ocid="profile.timezone"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Timezone
                  </span>
                </div>
                <span className="text-sm text-foreground font-mono">
                  {profile.timezone}
                </span>
              </div>
            )}

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
            onClick={() => setEditOpen(true)}
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

      {/* Edit sheet — mutually exclusive from the read-only view */}
      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialDisplayName={displayName}
        initialBio={profile?.bio ?? ""}
      />
    </>
  );
}
