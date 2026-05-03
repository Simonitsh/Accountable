import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBackend } from "../hooks/useBackend";

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
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
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
          // Backend doesn't expose isUsernameAvailable; allow submit and
          // surface uniqueness error on register() failure instead.
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

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const uErr = username.trim()
      ? getUsernameFormatError(username.trim())
      : "Username is required.";
    setUsernameError(uErr);

    if (uErr) return;
    if (availability === "taken") return;

    setIsSubmitting(true);
    setApiError("");
    try {
      if (!actor) throw new Error("Backend not available.");

      // Register the unique username
      await (actor as { register: (u: string) => Promise<unknown> }).register(
        username.trim(),
      );

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
      } else {
        setApiError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    isValidUsernameFormat(username) &&
    (availability === "available" || availability === "unknown") &&
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
          className="onboarding-card w-full max-w-md"
          data-ocid="onboarding.card"
        >
          {/* Heading */}
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Identity Setup
            </p>
            <h2 className="text-xl font-display font-semibold text-foreground leading-snug">
              Welcome. Choose your handle.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your username is permanent and must be unique.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-7">
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
                      setUsernameError(getUsernameFormatError(username.trim()));
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

            {/* ── Submit ────────────────────────────────────────────────── */}
            <button
              data-ocid="onboarding.submit_button"
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 rounded-lg font-display font-semibold text-base tracking-wide transition-smooth button-primary-neon disabled:opacity-40 disabled:cursor-not-allowed"
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
          </form>
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
