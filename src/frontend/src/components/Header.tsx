import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Menu, User } from "lucide-react";
import { useDashboardHeader } from "../hooks/useDashboardHeader";
import { useTheme } from "../hooks/useTheme";

interface HeaderProps {
  onMenuClick: () => void;
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ─── Compact Progress Ring for the header ────────────────────────────────────
function HeaderProgressRing({
  completed,
  total,
  isComplete,
}: {
  completed: number;
  total: number;
  isComplete: boolean;
}) {
  const size = 44;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? completed / total : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      data-ocid="dashboard.progress_ring"
      aria-label={`${completed} of ${total} habits done today`}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(var(--muted))"
          strokeWidth={strokeWidth}
          opacity={0.45}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(var(--color-accent-success))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)",
            filter: isComplete
              ? "drop-shadow(0 0 6px oklch(var(--color-accent-success) / 0.75))"
              : "drop-shadow(0 0 3px oklch(var(--color-accent-success) / 0.4))",
          }}
        />
      </svg>
      {/* Center fraction */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-mono font-bold leading-none"
          style={{
            fontSize: "0.6rem",
            color: isComplete
              ? "oklch(var(--color-accent-success))"
              : "oklch(var(--muted-foreground))",
          }}
        >
          {completed}/{total}
        </span>
      </div>
    </div>
  );
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const dashboardData = useDashboardHeader();
  const isDashboard = dashboardData !== null;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center px-4"
      style={{
        background: "oklch(var(--card))",
        paddingTop: "env(safe-area-inset-top)",
        height: "calc(56px + env(safe-area-inset-top))",
        boxShadow: "0 4px 16px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.35)",
      }}
    >
      {/* ── Left side ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onMenuClick}
          data-ocid="header.menu_button"
          aria-label="Open navigation menu"
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl transition-smooth",
            "text-muted-foreground hover:text-foreground hover:bg-muted/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── Center / main content ── */}
      <div className="flex-1 flex items-center min-w-0 px-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-lg font-bold text-foreground tracking-tight">
            Cumulative
          </h1>
        </div>
      </div>

      {/* ── Right side ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          data-ocid="header.theme_toggle"
          aria-label={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-full transition-smooth",
            "shadow-neumorphic-emboss-dark",
            "text-muted-foreground hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "active:scale-95",
          )}
          style={{ background: "oklch(var(--card))" }}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Dashboard: always show compact progress ring — even at 0/0 */}
        {isDashboard ? (
          <HeaderProgressRing
            completed={dashboardData.progressCompleted}
            total={dashboardData.progressTotal}
            isComplete={dashboardData.isComplete}
          />
        ) : (
          /* Other pages: profile link */
          <Link
            to="/profile"
            data-ocid="header.profile_link"
            aria-label="Go to profile"
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full transition-smooth",
              "bg-muted/30 shadow-neumorphic-emboss-dark",
              "text-muted-foreground hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <User size={18} />
          </Link>
        )}
      </div>
    </header>
  );
}
