import { cn } from "@/lib/utils";
import { Target, TrendingUp, Users, Zap } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface FeatureItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  colorClass: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: Target,
    label: "WOOP Goal Framework",
    colorClass: "text-[oklch(var(--color-accent-success))]",
  },
  {
    icon: Zap,
    label: "Daily Check-Ins",
    colorClass: "text-[oklch(var(--color-accent-skip))]",
  },
  {
    icon: Users,
    label: "Accountability Partners",
    colorClass: "text-[oklch(var(--color-accent-social))]",
  },
  {
    icon: TrendingUp,
    label: "Progress Analytics",
    colorClass: "text-muted-foreground",
  },
];

export function LoginPage() {
  const { login, isLoggingIn } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background">
      {/* Logo mark */}
      <div className="flex flex-col items-center mb-12">
        <div
          className={cn(
            "flex items-center justify-center w-20 h-20 rounded-3xl mb-5",
            "bg-card transition-smooth",
          )}
          style={{
            boxShadow:
              "-5px -5px 14px rgba(65,65,75,0.5), 8px 8px 22px rgba(0,0,0,0.88)",
            borderTop: "1px solid rgba(255,255,255,0.13)",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <Target
            size={36}
            className="text-[oklch(var(--color-accent-success))]"
          />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
          Cumulative
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-xs">
          Build better keystone habits with behavioral science and accountable
          partners
        </p>
      </div>

      {/* Feature list */}
      <div className="w-full max-w-xs space-y-3 mb-10">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card"
              style={{
                boxShadow:
                  "-4px -4px 10px rgba(65,65,75,0.45), 6px 6px 16px rgba(0,0,0,0.82)",
                borderTop: "1px solid rgba(255,255,255,0.12)",
                borderLeft: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Icon
                size={18}
                className={cn("flex-shrink-0", feature.colorClass)}
              />
              <span className="text-sm font-body text-foreground/80">
                {feature.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Login button */}
      <div className="w-full max-w-xs space-y-3">
        <button
          type="button"
          onClick={login}
          disabled={isLoggingIn}
          data-ocid="login.primary_button"
          className={cn(
            "w-full py-4 px-6 rounded-2xl font-display font-semibold text-base transition-smooth",
            "bg-card",
            "text-[oklch(var(--color-accent-success))]",
            "active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100",
          )}
          style={{
            boxShadow:
              "-4px -4px 10px rgba(65,65,75,0.45), 6px 6px 18px rgba(0,0,0,0.85)",
            borderTop: "1px solid rgba(255,255,255,0.13)",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {isLoggingIn ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              Connecting...
            </span>
          ) : (
            "Sign in with Internet Identity"
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground leading-relaxed px-2">
          Secure, private login — no email or password required. Your data
          belongs only to you.
        </p>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-smooth"
          >
            Built with love using caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
