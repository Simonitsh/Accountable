import { useBlocker, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Lock, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "../components/Avatar";
import type { AvatarShapeId } from "../components/AvatarShapes";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { useUpdateBio, useUserProfile } from "../hooks/useUserProfile";
import type { AvatarColorMode } from "../types";

const sectionLabel =
  "block text-xs font-mono tracking-widest text-muted-foreground uppercase mb-2";

const insetCard: React.CSSProperties = {
  background: "oklch(var(--card))",
  boxShadow:
    "inset 2px 2px 6px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(255,255,255,0.04)",
  borderRadius: "1rem",
  padding: "1.25rem",
};

export function EditProfilePage() {
  const navigate = useNavigate();
  const { data: profile } = useUserProfile();
  const { mutateAsync: mutateBio, isPending: bioPending } = useUpdateBio();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  // justSaved: set to true in the save onSuccess path, then a deferred
  // useEffect navigates back to /profile once a render commits with
  // justSaved=true AND isDirty=false. useState (NOT useRef) is required here
  // because useBlocker's condition is a render-captured closure — it does NOT
  // re-read the condition synchronously at navigation time. Setting a ref
  // before navigate() does not refresh the condition value the blocker uses to
  // evaluate the in-flight navigation. By deferring navigate() to a useEffect
  // that fires after a render commits with justSaved=true && isDirty=false,
  // the blocker's condition closure is refreshed on a committed render where
  // condition = isDirty && !justSaved = false && !true = false, so the
  // deferred navigate() is evaluated against a NON-blocking condition.
  const [justSaved, setJustSaved] = useState(false);
  // Use a ref to seed initialValues only once — prevents re-seed when profile
  // refetches after a successful save, which would incorrectly reset the dirty state.
  const initializedRef = useRef(false);

  const [initialValues, setInitialValues] = useState({
    displayName: "",
    bio: "",
    email: "",
  });

  const isDirty =
    displayName !== initialValues.displayName ||
    bio !== initialValues.bio ||
    email !== initialValues.email;

  useEffect(() => {
    if (profile && !initializedRef.current) {
      initializedRef.current = true;
      const initial = {
        displayName: profile.displayName || "",
        bio: profile.bio || "",
        email: profile.email || "",
      };
      setDisplayName(initial.displayName);
      setBio(initial.bio);
      setEmail(initial.email);
      setInitialValues(initial);
    }
  }, [profile]);

  // Block TanStack Router navigation when there are unsaved changes.
  // condition is a render-captured closure re-evaluated on every render. After
  // a save, setJustSaved(true) schedules a re-render where justSaved=true, and
  // setInitialValues(saved) makes isDirty=false on the same/next render. The
  // deferred navigation useEffect below waits for a committed render where
  // justSaved=true && isDirty=false before calling navigate(), so the blocker
  // sees condition=false on that committed render and does not intercept.
  // onChange handlers reset justSaved=false so genuine later edits still
  // trigger the discard prompt.
  const blocker = useBlocker({
    condition: isDirty && !justSaved,
  });

  // Secondary safety net: warn on browser back / tab close when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Deferred post-save navigation. Fires AFTER a render commits with
  // justSaved=true AND isDirty=false (setInitialValues(saved) in
  // handleSaveSuccess makes isDirty=false on the next render). By the time
  // this effect runs, useBlocker's condition closure has been refreshed on a
  // committed render where condition = isDirty && !justSaved = false, so the
  // deferred navigate() is evaluated against a NON-blocking condition and the
  // discard prompt cannot fire. This mirrors the EditAvatarPage pattern.
  useEffect(() => {
    if (justSaved && !isDirty) {
      navigate({ to: "/profile" });
    }
  }, [justSaved, isDirty, navigate]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailError =
    email && !emailRegex.test(email)
      ? "Please enter a valid email address"
      : "";

  const handleBack = useCallback(() => {
    navigate({ to: "/profile" });
  }, [navigate]);

  // After a successful save, reset initialValues so dirty state clears
  const handleSaveSuccess = useCallback(() => {
    const saved = {
      displayName,
      bio,
      email,
    };
    setInitialValues(saved);
  }, [displayName, bio, email]);

  const handleSave = useCallback(async () => {
    if (!isDirty || emailError) return;
    if (!profile) return;
    try {
      await mutateBio({
        displayName: displayName,
        bio: bio,
        email: email,
      });
      // Reset initialValues so isDirty clears (form state is no longer "dirty").
      // This is a React state update — isDirty becomes false on the NEXT render.
      handleSaveSuccess();
      toast.success("Profile updated.");
      // Mark saved and let the deferred navigation useEffect fire once a
      // render commits with justSaved=true && isDirty=false. Do NOT call
      // navigate() synchronously here — useBlocker's condition is a
      // render-captured closure, so a synchronous navigate() would be
      // evaluated against the stale condition from the last committed render
      // (isDirty=true, justSaved=false) and the discard prompt would fire.
      setJustSaved(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile.",
      );
    }
  }, [
    isDirty,
    emailError,
    mutateBio,
    profile,
    displayName,
    bio,
    email,
    handleSaveSuccess,
  ]);

  const isPending = bioPending;

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-ocid="edit_profile.page"
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center px-4 py-3 border-b border-border"
        style={{
          background: "oklch(var(--card))",
          boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          className="p-2 rounded-xl mr-2 text-foreground"
          style={{
            boxShadow:
              "3px 3px 8px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)",
          }}
          aria-label="Go back"
          data-ocid="edit_profile.back_button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center pr-9">
          Edit Profile
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">
        {/* AVATAR entry — thumbnail + link to dedicated avatar editor */}
        <div className="space-y-3" style={insetCard}>
          <h2 className={sectionLabel}>Avatar</h2>
          <div className="flex items-center gap-4">
            <Avatar
              username={profile?.username ?? ""}
              avatarShape={
                (profile?.avatarShape as AvatarShapeId | null) ?? null
              }
              avatarColor={profile?.avatarColor ?? null}
              colorMode={
                (profile?.avatarColorMode as AvatarColorMode | undefined) ??
                "Fill"
              }
              size="lg"
              alt="Current avatar"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                {profile?.avatarShape && profile?.avatarColor
                  ? "Custom avatar set."
                  : "No avatar selected — your username initial is shown."}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shape, color, and color mode live on their own page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/profile/avatar" })}
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{
                background: "#10B981",
                boxShadow:
                  "3px 3px 8px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)",
              }}
              data-ocid="edit_profile.avatar.edit_link"
            >
              Edit Avatar
            </button>
          </div>
        </div>

        {/* IDENTITY section */}
        <div className="space-y-4" style={insetCard}>
          <h2 className={sectionLabel}>Identity</h2>

          {/* Display Name */}
          <div className="space-y-2">
            <label
              htmlFor="displayName"
              className="text-sm font-medium text-foreground"
            >
              Display Name
            </label>
            <div className="relative">
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setJustSaved(false);
                  setDisplayName(e.target.value.slice(0, 40));
                }}
                onFocus={() => setFocusedField("displayName")}
                onBlur={() => setFocusedField(null)}
                placeholder="Optional"
                className="w-full rounded-xl px-4 py-3 pr-10 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                style={{
                  background: "oklch(var(--muted) / 0.4)",
                  boxShadow:
                    "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                data-ocid="edit_profile.display_name_input"
              />
              {displayName && (
                <button
                  type="button"
                  onClick={() => {
                    setJustSaved(false);
                    setDisplayName("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors duration-200"
                  aria-label="Clear display name"
                  data-ocid="edit_profile.clear_display_name_button"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p
              className={`text-right text-xs text-muted-foreground/60 font-mono transition-opacity duration-200 ${focusedField === "displayName" ? "opacity-100" : "opacity-0"}`}
            >
              {displayName.length}/40
            </p>
          </div>

          {/* Username — read only */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              Username
            </span>
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 opacity-60"
              style={{
                background: "oklch(var(--muted) / 0.3)",
                boxShadow:
                  "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-sm text-foreground">
                @{profile?.username}
              </span>
              <Lock size={14} className="ml-auto text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Cannot be changed</p>
          </div>
        </div>

        {/* ABOUT section */}
        <div className="space-y-4" style={insetCard}>
          <h2 className={sectionLabel}>About</h2>
          <label htmlFor="bio" className="text-sm font-medium text-foreground">
            Macro Wish{" "}
            <span className="text-muted-foreground font-normal">
              — About Your Journey
            </span>
          </label>
          <div className="relative">
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => {
                setJustSaved(false);
                setBio(e.target.value.slice(0, 160));
              }}
              onFocus={() => setFocusedField("bio")}
              onBlur={() => setFocusedField(null)}
              placeholder="What is your overarching goal in life?"
              rows={4}
              className="w-full rounded-xl px-4 py-3 pr-10 text-base text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{
                background: "oklch(var(--muted) / 0.4)",
                boxShadow:
                  "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              data-ocid="edit_profile.bio_textarea"
            />
            {bio && (
              <button
                type="button"
                onClick={() => {
                  setJustSaved(false);
                  setBio("");
                }}
                className="absolute top-3 right-3 text-muted-foreground/50 hover:text-foreground transition-colors duration-200"
                aria-label="Clear bio"
                data-ocid="edit_profile.clear_bio_button"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p
            className={`text-right text-xs text-muted-foreground/60 font-mono transition-opacity duration-200 ${focusedField === "bio" ? "opacity-100" : "opacity-0"}`}
          >
            {bio.length}/160
          </p>
        </div>

        {/* CONTACT section */}
        <div className="space-y-4" style={insetCard}>
          <h2 className={sectionLabel}>Contact</h2>
          <label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
          >
            Email Address
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setJustSaved(false);
                setEmail(e.target.value);
              }}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              placeholder="your@email.com"
              className="w-full rounded-xl px-4 py-3 pr-10 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{
                background: "oklch(var(--muted) / 0.4)",
                boxShadow:
                  "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                border: emailError
                  ? "1px solid #ef4444"
                  : "1px solid rgba(255,255,255,0.07)",
              }}
              data-ocid="edit_profile.email_input"
            />
            {email && (
              <button
                type="button"
                onClick={() => {
                  setJustSaved(false);
                  setEmail("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors duration-200"
                aria-label="Clear email"
                data-ocid="edit_profile.clear_email_button"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {emailError && (
            <p className="text-xs text-destructive">{emailError}</p>
          )}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || !!emailError || isPending}
          data-ocid="edit_profile.save_button"
          className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          style={{
            background: "#10B981",
            boxShadow:
              "3px 3px 8px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)",
          }}
        >
          {isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>

      {/* Discard dialog — covers Identity/About/Contact changes only */}
      <UnsavedChangesDialog blocker={blocker} ocidPrefix="edit_profile" />
    </div>
  );
}
