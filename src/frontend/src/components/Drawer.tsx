import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  LogOut,
  ShieldCheck,
  Target,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { UserProfilePublic } from "../backend.d.ts";
import { TIER_LABELS } from "../types";
import type { SubscriptionTier } from "../types";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfilePublic | null;
  onLogout: () => void;
}

function toNumericTier(tier: UserProfilePublic["tier"]): SubscriptionTier {
  if (tier === "tier3") return 3;
  if (tier === "tier2") return 2;
  return 1;
}

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/goals", icon: Target, label: "My Goals" },
  { to: "/profile", icon: User, label: "Profile" },
  { to: "/settings", icon: CreditCard, label: "Subscription Settings" },
  { to: "/connections", icon: Users, label: "Connections" },
  { to: "/admin", icon: ShieldCheck, label: "Admin Controls", adminOnly: true },
];

export function Drawer({ isOpen, onClose, profile, onLogout }: DrawerProps) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const prevPathRef = useRef(currentPath);

  useEffect(() => {
    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      onClose();
    }
  });

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || profile?.role === "admin",
  );

  const displayName =
    profile?.displayName && profile.displayName.trim() !== ""
      ? profile.displayName.trim()
      : null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
          aria-hidden="true"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onClose();
          }}
          role="presentation"
        />
      )}

      {/* Drawer panel */}
      <dialog
        open={isOpen}
        aria-label="Navigation menu"
        data-ocid="nav.drawer"
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col m-0 p-0 h-full max-h-full",
          "border-r border-border shadow-neumorphic-emboss-dark transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "oklch(var(--card))" }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar initial */}
            <div
              className="flex items-center justify-center w-10 h-10 rounded-full select-none flex-shrink-0"
              style={{
                background: "oklch(0.22 0.01 260)",
                boxShadow:
                  "inset 2px 2px 4px oklch(0.15 0.01 260), inset -2px -2px 4px oklch(0.28 0.01 260)",
              }}
              aria-hidden="true"
            >
              {profile?.displayName?.trim() || profile?.username?.trim() ? (
                <span
                  className="font-display font-bold text-base"
                  style={{ color: "oklch(var(--color-accent-success))" }}
                >
                  {(
                    profile.displayName?.trim() ||
                    profile.username?.trim() ||
                    ""
                  )
                    .charAt(0)
                    .toUpperCase()}
                </span>
              ) : (
                <User
                  size={18}
                  style={{ color: "oklch(var(--color-accent-success) / 0.7)" }}
                />
              )}
            </div>

            {/* Display name / CTA */}
            <div className="min-w-0">
              {displayName ? (
                <>
                  <p className="font-display font-semibold text-foreground text-sm truncate">
                    {displayName}
                  </p>
                  {profile && (
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {TIER_LABELS[toNumericTier(profile.tier)]} tier
                    </p>
                  )}
                </>
              ) : (
                <Link
                  to="/profile"
                  className="text-sm font-body text-muted-foreground hover:text-foreground transition-smooth underline-offset-2 hover:underline"
                  data-ocid="nav.drawer.setup_profile_link"
                >
                  Set up your profile
                </Link>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-ocid="nav.drawer.close_button"
            aria-label="Close menu"
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg transition-smooth flex-shrink-0",
              "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = currentPath === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    data-ocid={`nav.drawer.${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.link`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-smooth",
                      "text-sm font-body",
                      isActive
                        ? "bg-muted/50 text-foreground shadow-neumorphic-emboss-dark"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(
                        "flex-shrink-0",
                        item.adminOnly
                          ? "text-[oklch(var(--color-accent-social))]"
                          : isActive
                            ? "text-[oklch(var(--color-accent-success))]"
                            : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div
          className="border-t border-border p-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <button
            type="button"
            onClick={onLogout}
            data-ocid="nav.drawer.logout_button"
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-smooth",
              "text-sm font-body text-muted-foreground hover:text-foreground hover:bg-muted/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </dialog>
    </>
  );
}
