import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, Users } from "lucide-react";

interface TabItem {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  accentClass: string;
  glowClass: string;
}

const TABS: TabItem[] = [
  {
    to: "/",
    icon: Home,
    label: "Today's Dashboard",
    accentClass: "text-[oklch(var(--color-accent-success))]",
    glowClass: "shadow-glow-success",
  },
  {
    to: "/feed",
    icon: Users,
    label: "Partner Feed",
    accentClass: "text-[oklch(var(--color-accent-social))]",
    glowClass: "shadow-glow-social",
  },
  {
    to: "/analytics",
    icon: BarChart3,
    label: "Analytics",
    accentClass: "text-muted-foreground",
    glowClass: "",
  },
];

export function BottomTabBar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border"
      style={{
        background: "oklch(var(--card))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around h-16">
        {TABS.map((tab) => {
          const isActive =
            tab.to === "/"
              ? currentPath === "/"
              : currentPath.startsWith(tab.to);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.to}
              to={tab.to}
              data-ocid={`nav.${tab.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.tab`}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[72px] py-2 px-3 rounded-xl transition-smooth",
                "hover:bg-muted/30",
                isActive ? "opacity-100" : "opacity-50",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-smooth",
                  isActive && "shadow-neumorphic-emboss-dark",
                  isActive ? `bg-muted/50 ${tab.glowClass}` : "bg-transparent",
                )}
              >
                <Icon
                  size={20}
                  className={cn(
                    "transition-smooth",
                    isActive ? tab.accentClass : "text-muted-foreground",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-body font-medium leading-none transition-smooth",
                  isActive ? tab.accentClass : "text-muted-foreground",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
