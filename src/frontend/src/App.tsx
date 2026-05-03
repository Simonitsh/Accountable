import {
  Navigate,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Layout } from "./components/Layout";
import { useAuth } from "./hooks/useAuth";
import { useBackend } from "./hooks/useBackend";
import { useUserProfile } from "./hooks/useUserProfile";
import { AdminPage as AdminPageImpl } from "./pages/AdminPage";
import { AnalyticsPage as AnalyticsPageImpl } from "./pages/AnalyticsPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { DashboardPage as DashboardPageImpl } from "./pages/DashboardPage";
import { FeedPage as FeedPageImpl } from "./pages/FeedPage";
import { GoalsPage as GoalsPageImpl } from "./pages/GoalsPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ProfilePage as ProfilePageImpl } from "./pages/ProfilePage";
import { SettingsPage as SettingsPageImpl } from "./pages/SettingsPage";

// ─── Route page wrappers ──────────────────────────────────────────────────────
function DashboardPage() {
  return <DashboardPageImpl />;
}
function FeedPage() {
  return <FeedPageImpl />;
}
function AnalyticsPage() {
  return <AnalyticsPageImpl />;
}
function ProfilePage() {
  return <ProfilePageImpl />;
}
function SettingsPage() {
  return <SettingsPageImpl />;
}
function AdminPage() {
  return <AdminPageImpl />;
}
function GoalsPage() {
  return <GoalsPageImpl />;
}

// ─── Shared spinner ───────────────────────────────────────────────────────────
function AppSpinner({ ocid, label }: { ocid: string; label?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-background gap-4"
      data-ocid={ocid}
    >
      <span className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
      {label && (
        <p className="text-sm text-muted-foreground font-body">{label}</p>
      )}
    </div>
  );
}

// ─── Onboarding gate ──────────────────────────────────────────────────────────
//
// Three-state machine:
//   LOADING         → waiting for actor + profile to be ready
//   NEEDS_ONBOARDING → authenticated, actor ready, but no username set
//   READY           → authenticated, actor ready, username confirmed → show app
//
// KEY: The routing decision is latched with a useRef once it's made.
// Once we decide READY, we never go back to LOADING or NEEDS_ONBOARDING,
// even if subsequent renders briefly re-evaluate. This prevents routing loops.
//
type GateState = "LOADING" | "NEEDS_ONBOARDING" | "READY";

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { actorReady } = useBackend();
  const {
    data: profile,
    isLoading: profileIsLoading,
    isFetching: profileIsFetching,
    refetch,
  } = useUserProfile();

  // One-way latch: once we decide on a final state, we never go backwards.
  // This is the key to breaking re-render loops.
  const latchedStateRef = useRef<"NEEDS_ONBOARDING" | "READY" | null>(null);
  const [gateState, setGateState] = useState<GateState>("LOADING");

  useEffect(() => {
    // Snapshot the latch so TypeScript doesn't narrow it away after guards below.
    const latched = latchedStateRef.current;

    // Never override a latched READY decision — returning user stays on dashboard.
    if (latched === "READY") return;

    // Still waiting for actor or profile query to complete — stay in LOADING.
    if (!actorReady) return;
    if (profileIsLoading) return;
    // profileIsFetching=true but no data yet → still polling for result
    if (profileIsFetching && !profile) return;

    // We have a definitive answer: actor ready + profile query settled.
    // Determine if the user needs onboarding.
    const username = profile?.username ?? "";
    const principalStr = profile?.id?.toString() ?? "";
    const needsOnboarding =
      !profile ||
      username.trim().length === 0 ||
      (principalStr.length > 0 && username === principalStr);

    if (needsOnboarding) {
      // The early return above already handles the case where latched === "READY",
      // so here latched can only be null | "NEEDS_ONBOARDING". Safe to set.
      latchedStateRef.current = "NEEDS_ONBOARDING";
      setGateState("NEEDS_ONBOARDING");
    } else {
      // Username confirmed — latch READY permanently.
      latchedStateRef.current = "READY";
      setGateState("READY");
    }
  }, [actorReady, profileIsLoading, profileIsFetching, profile]);

  if (gateState === "LOADING") {
    return (
      <AppSpinner
        ocid="onboarding.loading_state"
        label="Setting up your session…"
      />
    );
  }

  if (gateState === "NEEDS_ONBOARDING") {
    return (
      <OnboardingPage
        onComplete={() => {
          // After username is set, refetch profile — useEffect above will
          // see the populated username and transition gate to READY.
          void refetch();
        }}
      />
    );
  }

  // READY — render the app
  return <>{children}</>;
}

// ─── Auth gate ────────────────────────────────────────────────────────────────
//
// Blocks only on auth settlement. Once auth is known:
//   - not authenticated → LoginPage
//   - authenticated     → OnboardingGate (decides dashboard vs onboarding)
//
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppSpinner ocid="app.loading_state" />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <OnboardingGate>{children}</OnboardingGate>;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: () => (
    <AuthGate>
      <Layout />
    </AuthGate>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feed",
  component: FeedPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: AnalyticsPage,
});

const connectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connections",
  component: ConnectionsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfilePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const goalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/goals",
  component: GoalsPage,
});

const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: () => <Navigate to="/" />,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  feedRoute,
  analyticsRoute,
  connectionsRoute,
  profileRoute,
  settingsRoute,
  adminRoute,
  goalsRoute,
  catchAllRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
