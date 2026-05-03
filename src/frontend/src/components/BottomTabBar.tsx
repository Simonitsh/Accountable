import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, Users } from "lucide-react";

interface TabItem {
  to: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    style?: React.CSSProperties;
  }>;
  label: string;
  accentClass: string;
  glowClass: string;
}

const TABS: TabItem[] = [
  {
    to: "/",
    icon: Home,
    label: "Dashboard",
    accentClass: "text-[#10B981]",
    glowClass: "",
  },
  {
    to: "/feed",
    icon: Users,
    label: "Partners",
    accentClass: "text-[#EAB308]",
    glowClass: "",
  },
  {
    to: "/analytics",
    icon: BarChart3,
    label: "Analytics",
    accentClass: "text-white",
    glowClass: "",
  },
];

export function BottomTabBar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: "oklch(var(--card))",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 -4px 16px rgba(0,0,0,0.35), 0 -1px 4px rgba(0,0,0,0.2)",
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
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-smooth",
                  isActive && "bg-muted/30",
                )}
              >
                <Icon
                  size={20}
                  className={cn(
                    "transition-smooth",
                    isActive ? tab.accentClass : "",
                  )}
                  style={
                    isActive ? undefined : { color: "rgba(255,255,255,0.5)" }
                  }
                />
              </div>
              <span
                className="text-[10px] font-body font-medium leading-none transition-smooth"
                style={{
                  color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                }}
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
