import { useBlocker, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Lock, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUpdateBio, useUserProfile } from "../hooks/useUserProfile";

// ─── Archetype definitions (mirrored from OnboardingPage) ─────────────────────

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

const ARCHETYPE_DESCRIPTIONS: Record<ArchetypeName, string> = {
  Oak: "Grounded and resilient. You grow steadily, rooted in purpose.",
  River: "Fluid and adaptable. You flow around obstacles with ease.",
  Wolf: "Loyal and driven. You thrive in packs and pursue goals fiercely.",
  Owl: "Wise and observant. You see patterns others miss.",
  Mountain: "Steadfast and unshakable. You endure where others falter.",
  Fire: "Passionate and transformative. You ignite change in yourself and others.",
  Bamboo: "Flexible yet strong. You bend without breaking.",
  Honeycomb: "Collaborative and structured. You build systems that sustain.",
  Wind: "Free and influential. You move others without being seen.",
  Tide: "Rhythmic and persistent. You return, again and again, until the shore shifts.",
};

// ─── ArchetypeSelector component ─────────────────────────────────────────────

interface ArchetypeSelectorProps {
  value: ArchetypeName | "";
  onChange: (value: ArchetypeName) => void;
}

function ArchetypeSelector({ value, onChange }: ArchetypeSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {ARCHETYPE_NAMES.map((name) => {
          const Icon = ARCHETYPE_ICONS[name];
          const isSelected = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              data-ocid={`edit_profile.archetype.${name.toLowerCase()}_button`}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-smooth border ${
                isSelected
                  ? "border-accent-success bg-accent-success/10"
                  : "border-transparent hover:border-white/10"
              }`}
              style={{
                background: isSelected
                  ? "oklch(var(--color-accent-success) / 0.08)"
                  : "oklch(var(--card))",
                boxShadow: isSelected
                  ? "inset 2px 2px 6px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(255,255,255,0.04), 0 0 12px 2px oklch(var(--color-accent-success) / 0.2)"
                  : "3px 3px 8px rgba(0,0,0,0.4), -2px -2px 6px rgba(255,255,255,0.04)",
              }}
            >
              <Icon
                className={`w-8 h-8 ${isSelected ? "text-accent-success" : "text-muted-foreground"}`}
              />
              <span
                className={`text-xs font-semibold ${isSelected ? "text-accent-success" : "text-muted-foreground"}`}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-sm text-muted-foreground text-center px-2">
          {ARCHETYPE_DESCRIPTIONS[value as ArchetypeName]}
        </p>
      )}
    </div>
  );
}

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
  const [archetype, setArchetype] = useState<ArchetypeName | "">("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const initializedRef = useRef(false);
  const [initialValues, setInitialValues] = useState({
    displayName: "",
    bio: "",
    email: "",
    archetype: "" as ArchetypeName | "",
  });

  const isDirty =
    displayName !== initialValues.displayName ||
    bio !== initialValues.bio ||
    email !== initialValues.email ||
    archetype !== initialValues.archetype;

  useEffect(() => {
    if (justSaved && !isDirty) {
      navigate({ to: "/profile" });
    }
  }, [justSaved, isDirty, navigate]);

  useEffect(() => {
    if (profile && !initializedRef.current) {
      initializedRef.current = true;
      const initial = {
        displayName: profile.displayName || "",
        bio: profile.bio || "",
        email: profile.email || "",
        archetype: (profile.avatarArchetype as ArchetypeName) || "",
      };
      setDisplayName(initial.displayName);
      setBio(initial.bio);
      setEmail(initial.email);
      setArchetype(initial.archetype);
      setInitialValues(initial);
    }
  }, [profile]);

  const blocker = useBlocker({
    condition: isDirty && !justSaved,
  });

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailError =
    email && !emailRegex.test(email)
      ? "Please enter a valid email address"
      : "";

  const handleBack = useCallback(() => {
    navigate({ to: "/profile" });
  }, [navigate]);

  const handleSaveSuccess = useCallback(() => {
    const saved = { displayName, bio, email, archetype };
    setInitialValues(saved);
  }, [displayName, bio, email, archetype]);

  const handleSave = useCallback(async () => {
    if (!isDirty || emailError) return;
    try {
      await mutateAsync({
        displayName: displayName,
        bio: bio,
        email: email,
        avatarArchetype: archetype || null,
      });
      handleSaveSuccess();
      toast.success("Profile updated.");
      setJustSaved(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile.",
      );
    }
  }, [
    isDirty,
    emailError,
    mutateAsync,
    displayName,
    bio,
    email,
    archetype,
    handleSaveSuccess,
  ]);

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
            <div className="relative">
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
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
                  onClick={() => setDisplayName("")}
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

        {/* ARCHETYPE section */}
        <div className="space-y-4" style={insetCard}>
          <h2 className={sectionLabel}>Archetype</h2>
          <p className="text-sm text-muted-foreground -mt-1 mb-2">
            Your visual identity. Choose the archetype that represents you.
          </p>
          <ArchetypeSelector
            value={archetype}
            onChange={(val) => setArchetype(val)}
          />
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
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
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
                onClick={() => setBio("")}
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
              onChange={(e) => setEmail(e.target.value)}
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
                onClick={() => setEmail("")}
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

      {/* Discard dialog */}
      {blocker.status === "blocked" && (
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
                onClick={() => {
                  blocker.reset();
                }}
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
                onClick={() => {
                  blocker.proceed();
                }}
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
