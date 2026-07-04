import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBackend } from "../hooks/useBackend";

// ─── Archetype definitions ────────────────────────────────────────────────────

export const ARCHETYPE_NAMES = [
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

export type ArchetypeName = (typeof ARCHETYPE_NAMES)[number];

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
  error?: string;
}

function ArchetypeSelector({ value, onChange, error }: ArchetypeSelectorProps) {
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
              data-ocid={`onboarding.archetype.${name.toLowerCase()}_button`}
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
      {error && (
        <p
          className="text-xs text-center"
          data-ocid="onboarding.archetype.field_error"
          style={{ color: "oklch(var(--destructive))" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUsernameFormat(value: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value);
}

function getUsernameFormatError(value: string): string {
  if (value.length < 3) return "At least 3 characters required.";
  if (value.length > 20) return "Max 20 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(value))
    return "Letters, numbers, and underscores only.";
  return "";
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "unknown";

interface OnboardingPageProps {
  onComplete: () => void;
}

// ─── Availability indicator ───────────────────────────────────────────────────

function AvailabilityIndicator({ status }: { status: AvailabilityStatus }) {
  if (status === "idle") return null;

  if (status === "checking") {
    return (
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
        data-ocid="onboarding.username_checking"
        aria-label="Checking availability…"
      >
        <span
          className="w-4 h-4 rounded-full border-2 animate-spin"
          style={{
            borderColor: "oklch(var(--muted-foreground) / 0.3)",
            borderTopColor: "oklch(var(--muted-foreground))",
          }}
        />
      </span>
    );
  }

  if (status === "available") {
    return (
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
        data-ocid="onboarding.username_available"
        aria-label="Username is available"
        style={{
          animation: "bounceIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            background: "oklch(var(--color-accent-success) / 0.15)",
            color: "oklch(var(--color-accent-success))",
            boxShadow: "0 0 10px 2px oklch(var(--color-accent-success) / 0.35)",
            border: "1.5px solid oklch(var(--color-accent-success) / 0.6)",
            animation: "glowPulse 2s ease-in-out infinite",
          }}
        >
          ✓
        </span>
      </span>
    );
  }

  if (status === "taken") {
    return (
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
        data-ocid="onboarding.username_taken"
        aria-label="Username is taken"
        style={{ animation: "shakeLateral 0.4s ease both" }}
      >
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            background: "oklch(var(--color-accent-social) / 0.15)",
            color: "oklch(var(--color-accent-social))",
            boxShadow: "0 0 8px 1px oklch(var(--color-accent-social) / 0.3)",
            border: "1.5px solid oklch(var(--color-accent-social) / 0.5)",
          }}
        >
          ✕
        </span>
      </span>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [archetype, setArchetype] = useState<ArchetypeName | "">("");
  const [archetypeError, setArchetypeError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityStatus>("idle");

  const { actor } = useBackend();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Real-time availability check ─────────────────────────────────────────

  const checkAvailability = useCallback(
    async (value: string) => {
      if (!isValidUsernameFormat(value)) {
        setAvailability("idle");
        return;
      }
      setAvailability("checking");
      try {
        if (actor && "isUsernameAvailable" in actor) {
          const available = await (
            actor as { isUsernameAvailable: (u: string) => Promise<boolean> }
          ).isUsernameAvailable(value);
          setAvailability(available ? "available" : "taken");
        } else {
          setAvailability("unknown");
        }
      } catch {
        setAvailability("unknown");
      }
    },
    [actor],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username || username.length < 3) {
      setAvailability("idle");
      return;
    }

    if (!isValidUsernameFormat(username)) {
      setAvailability("idle");
      return;
    }

    debounceRef.current = setTimeout(() => {
      void checkAvailability(username);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, checkAvailability]);

  // ─── Step navigation ────────────────────────────────────────────────────────

  function goToStep2() {
    const uErr = username.trim()
      ? getUsernameFormatError(username.trim())
      : "Username is required.";
    setUsernameError(uErr);
    if (uErr) return;
    if (availability === "taken") return;
    setStep(2);
    setApiError("");
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!archetype) {
      setArchetypeError("Please select an archetype to continue.");
      return;
    }
    setArchetypeError("");

    setIsSubmitting(true);
    setApiError("");
    try {
      if (!actor) throw new Error("Backend not available.");

      await (
        actor as { register: (u: string, a: string) => Promise<unknown> }
      ).register(username.trim(), archetype);

      await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      await queryClient.refetchQueries({ queryKey: ["userProfile"] });
      onComplete();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      if (
        msg.toLowerCase().includes("taken") ||
        msg.toLowerCase().includes("username")
      ) {
        setAvailability("taken");
        setUsernameError("That username is already taken.");
        setStep(1);
      } else if (
        msg.toLowerCase().includes("archetype") ||
        msg.toLowerCase().includes("avatar")
      ) {
        setArchetypeError(msg);
      } else {
        setApiError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmitStep1 =
    isValidUsernameFormat(username) &&
    (availability === "available" || availability === "unknown");

  const canSubmit =
    isValidUsernameFormat(username) &&
    (availability === "available" || availability === "unknown") &&
    !!archetype &&
    !isSubmitting;

  // Determine input border style based on availability
  const usernameInputStyle: React.CSSProperties =
    availability === "available"
      ? {
          outline: "2px solid oklch(var(--color-accent-success) / 0.5)",
          outlineOffset: "2px",
        }
      : availability === "taken"
        ? {
            outline: "2px solid oklch(var(--color-accent-social) / 0.5)",
            outlineOffset: "2px",
          }
        : {};

  return (
    <>
      {/* Keyframe animations injected via a style tag */}
      <style>{`
        @keyframes bounceIn {
          0%   { transform: translateY(-50%) scale(0); opacity: 0; }
          60%  { transform: translateY(-50%) scale(1.2); opacity: 1; }
          100% { transform: translateY(-50%) scale(1); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 8px 1px oklch(var(--color-accent-success) / 0.3); }
          50%       { box-shadow: 0 0 14px 3px oklch(var(--color-accent-success) / 0.55); }
        }
        @keyframes shakeLateral {
          0%   { transform: translateY(-50%) translateX(0); }
          20%  { transform: translateY(-50%) translateX(-4px); }
          40%  { transform: translateY(-50%) translateX(4px); }
          60%  { transform: translateY(-50%) translateX(-3px); }
          80%  { transform: translateY(-50%) translateX(3px); }
          100% { transform: translateY(-50%) translateX(0); }
        }
      `}</style>

      <div
        className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12"
        data-ocid="onboarding.page"
      >
        {/* Logout button — top right */}
        <div className="fixed top-4 right-4 z-10">
          <button
            type="button"
            onClick={() => logout()}
            data-ocid="onboarding.logout_button"
            aria-label="Sign out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body transition-smooth text-muted-foreground hover:text-foreground"
            style={{
              background: "oklch(var(--card))",
              boxShadow:
                "3px 3px 7px rgba(0,0,0,0.4), -2px -2px 5px rgba(255,255,255,0.04)",
            }}
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        </div>

        {/* App brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
            Cumulative
          </h1>
          <p className="mt-1 text-sm text-muted-foreground tracking-widest uppercase">
            Behavioral accountability
          </p>
        </div>

        {/* Onboarding card */}
        <div
          className="onboarding-card w-full max-w-lg"
          data-ocid="onboarding.card"
        >
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-smooth ${
                step >= 1
                  ? "bg-accent-success text-white"
                  : "bg-muted text-muted-foreground"
              }`}
              data-ocid="onboarding.step.1"
            >
              1
            </div>
            <div
              className="w-10 h-0.5 rounded"
              style={{
                background:
                  step >= 2
                    ? "oklch(var(--color-accent-success))"
                    : "oklch(var(--muted))",
              }}
            />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-smooth ${
                step >= 2
                  ? "bg-accent-success text-white"
                  : "bg-muted text-muted-foreground"
              }`}
              data-ocid="onboarding.step.2"
            >
              2
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {step === 1 ? "Identity Setup" : "Choose Your Archetype"}
            </p>
            <h2 className="text-xl font-display font-semibold text-foreground leading-snug">
              {step === 1
                ? "Welcome. Choose your handle."
                : "Which force shapes you?"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {step === 1
                ? "Your username is permanent and must be unique."
                : "Select the archetype that resonates with your nature. This defines your visual identity."}
            </p>
          </div>

          {step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                goToStep2();
              }}
              noValidate
              className="space-y-7"
            >
              {/* ── Username (REQUIRED) ──────────────────────────────────── */}
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="flex items-center text-sm font-medium text-foreground"
                >
                  Username
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase ml-2"
                    style={{
                      color: "oklch(var(--color-accent-success))",
                      background: "oklch(var(--color-accent-success) / 0.12)",
                      border:
                        "1px solid oklch(var(--color-accent-success) / 0.35)",
                      boxShadow:
                        "0 0 6px 1px oklch(var(--color-accent-success) / 0.18)",
                    }}
                  >
                    Required
                  </span>
                </label>

                {/* Mad-lib prompt */}
                <p className="text-xs text-muted-foreground">
                  My handle on Cumulative is{" "}
                  <span className="madlib-field font-semibold">
                    {username || "___"}
                  </span>
                </p>

                <div className="relative">
                  <input
                    id="username"
                    data-ocid="onboarding.username.input"
                    type="text"
                    className="input-neumorphic w-full text-base pr-10"
                    placeholder="e.g. sarah_runs"
                    value={username}
                    maxLength={20}
                    autoComplete="username"
                    spellCheck={false}
                    style={usernameInputStyle}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\s/g, "");
                      setUsername(val);
                      setUsernameError("");
                      setApiError("");
                    }}
                    onBlur={() => {
                      if (username.trim()) {
                        setUsernameError(
                          getUsernameFormatError(username.trim()),
                        );
                      }
                    }}
                  />
                  <AvailabilityIndicator status={availability} />
                </div>

                {/* Availability text feedback */}
                {availability === "available" && !usernameError && (
                  <p
                    className="text-xs font-medium"
                    data-ocid="onboarding.username_available.text"
                    style={{ color: "oklch(var(--color-accent-success))" }}
                  >
                    ✓ Username is available
                  </p>
                )}
                {availability === "taken" && (
                  <p
                    className="text-xs font-medium"
                    data-ocid="onboarding.username_taken.text"
                    style={{ color: "oklch(var(--color-accent-social))" }}
                  >
                    Username taken — try another
                  </p>
                )}
                {usernameError && (
                  <p
                    className="text-xs mt-0.5"
                    data-ocid="onboarding.username.field_error"
                    style={{ color: "oklch(var(--destructive))" }}
                  >
                    {usernameError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  3–20 characters · letters, numbers, and underscores only
                </p>
              </div>

              {/* ── API error ─────────────────────────────────────────────── */}
              {apiError && (
                <p
                  className="text-sm text-center py-2 px-3 rounded-lg bg-muted"
                  data-ocid="onboarding.error_state"
                  style={{ color: "oklch(var(--destructive))" }}
                >
                  {apiError}
                </p>
              )}

              {/* ── Next step ───────────────────────────────────────────────── */}
              <button
                data-ocid="onboarding.next_button"
                type="submit"
                disabled={!canSubmitStep1}
                className="w-full py-3 rounded-lg font-display font-semibold text-base tracking-wide transition-smooth button-primary-neon disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-7">
              {/* ── Archetype selector (REQUIRED) ────────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Archetype
                  </span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase"
                    style={{
                      color: "oklch(var(--color-accent-success))",
                      background: "oklch(var(--color-accent-success) / 0.12)",
                      border:
                        "1px solid oklch(var(--color-accent-success) / 0.35)",
                      boxShadow:
                        "0 0 6px 1px oklch(var(--color-accent-success) / 0.18)",
                    }}
                  >
                    Required
                  </span>
                </div>
                <ArchetypeSelector
                  value={archetype}
                  onChange={(val) => {
                    setArchetype(val);
                    setArchetypeError("");
                    setApiError("");
                  }}
                  error={archetypeError}
                />
              </div>

              {/* ── API error ─────────────────────────────────────────────── */}
              {apiError && (
                <p
                  className="text-sm text-center py-2 px-3 rounded-lg bg-muted"
                  data-ocid="onboarding.error_state"
                  style={{ color: "oklch(var(--destructive))" }}
                >
                  {apiError}
                </p>
              )}

              {/* ── Submit ────────────────────────────────────────────────── */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  data-ocid="onboarding.back_button"
                  className="flex-1 py-3 rounded-lg font-display font-semibold text-base tracking-wide transition-smooth button-secondary-neon"
                >
                  ← Back
                </button>
                <button
                  data-ocid="onboarding.submit_button"
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-[2] py-3 rounded-lg font-display font-semibold text-base tracking-wide transition-smooth button-primary-neon disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span
                      className="flex items-center justify-center gap-2"
                      data-ocid="onboarding.loading_state"
                    >
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Setting up…
                    </span>
                  ) : (
                    "Begin →"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
              typeof window !== "undefined" ? window.location.hostname : "",
            )}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors duration-200"
          >
            Built with love using caffeine.ai
          </a>
        </p>
      </div>
    </>
  );
}
