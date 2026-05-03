import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { BottomTabBar } from "./BottomTabBar";
import { Drawer } from "./Drawer";
import { Header } from "./Header";

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: profile } = useUserProfile();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header profile={profile} onMenuClick={() => setDrawerOpen(true)} />

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profile={profile}
        onLogout={logout}
      />

      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: "calc(56px + env(safe-area-inset-top))",
          paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
        }}
      >
        <Outlet />
      </main>

      <BottomTabBar />

      <footer className="fixed bottom-0 left-0 right-0 z-10 flex items-end justify-center pb-1 pointer-events-none">
        <p className="text-[10px] text-muted-foreground/40 font-mono pointer-events-auto">
          &copy; {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
