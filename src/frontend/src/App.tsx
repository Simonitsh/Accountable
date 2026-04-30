import {
  Navigate,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Layout } from "./components/Layout";
import { useAuth } from "./hooks/useAuth";
import { AdminPage as AdminPageImpl } from "./pages/AdminPage";
import { AnalyticsPage as AnalyticsPageImpl } from "./pages/AnalyticsPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { DashboardPage as DashboardPageImpl } from "./pages/DashboardPage";
import { FeedPage as FeedPageImpl } from "./pages/FeedPage";
import { GoalsPage as GoalsPageImpl } from "./pages/GoalsPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage as ProfilePageImpl } from "./pages/ProfilePage";
import { SettingsPage as SettingsPageImpl } from "./pages/SettingsPage";

// ─── Placeholder pages ────────────────────────────────────────────────────────
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

// ─── Auth gate ────────────────────────────────────────────────────────────────
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-ocid="app.loading_state"
      >
        <span className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
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
