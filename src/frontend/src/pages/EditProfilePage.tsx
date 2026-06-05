import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useUpdateBio, useUserProfile } from "../hooks/useUserProfile";

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
  const { mutateAsync, isPending } = useUpdateBio();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [initialValues, setInitialValues] = useState({
    displayName: "",
    bio: "",
    email: "",
  });

  useEffect(() => {
    if (profile) {
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

  const isDirty =
    displayName !== initialValues.displayName ||
    bio !== initialValues.bio ||
    email !== initialValues.email;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailError =
    email && !emailRegex.test(email)
      ? "Please enter a valid email address"
      : "";

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      navigate({ to: "/profile" });
    }
  }, [isDirty, navigate]);

  const handleSave = useCallback(async () => {
    if (!isDirty || emailError) return;
    try {
      await mutateAsync({
        displayName: displayName || undefined,
        bio: bio || undefined,
        email: email || undefined,
      });
      toast.success("Profile updated.");
      navigate({ to: "/profile" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile.",
      );
    }
  }, [isDirty, emailError, mutateAsync, displayName, bio, email, navigate]);

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
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
              onFocus={() => setFocusedField("displayName")}
              onBlur={() => setFocusedField(null)}
              placeholder="Optional"
              className="w-full rounded-xl px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{
                background: "oklch(var(--muted) / 0.4)",
                boxShadow:
                  "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              data-ocid="edit_profile.display_name_input"
            />
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
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            onFocus={() => setFocusedField("bio")}
            onBlur={() => setFocusedField(null)}
            placeholder="What is your overarching goal in life?"
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-base text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            style={{
              background: "oklch(var(--muted) / 0.4)",
              boxShadow:
                "inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
            data-ocid="edit_profile.bio_textarea"
          />
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
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            placeholder="your@email.com"
            className="w-full rounded-xl px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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

      {/* Discard dialog */}
      {showDiscardDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          data-ocid="edit_profile.discard_dialog"
        >
          <div
            className="rounded-2xl p-6 mx-6 space-y-4"
            style={{
              background: "var(--card)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Discard changes?
            </h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Your unsaved changes will be lost.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 py-3 rounded-xl font-medium"
                style={{
                  background: "var(--muted)",
                  color: "var(--foreground)",
                }}
                data-ocid="edit_profile.keep_editing_button"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/profile" })}
                className="flex-1 py-3 rounded-xl font-medium"
                style={{ background: "#ef4444", color: "#fff" }}
                data-ocid="edit_profile.discard_button"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
