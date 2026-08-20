import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  Copy,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";
import { useState } from "react";
import type { UserProfilePublic, UserRole } from "../backend.d.ts";
import { useBackend } from "../hooks/useBackend";
import { useUserProfile } from "../hooks/useUserProfile";

// ─── Role helpers ────────────────────────────────────────────────────────────
//
// The backend exposes `UserRole` two different ways depending on which generated
// binding is active at runtime:
//   - backend.d.ts          → enum UserRole { admin = "admin", user = "user" }
//   - declarations/backend.did.d.ts → Candid variant { admin: null } | { user: null }
//
// A single string comparison (`role === "admin"`) only matches the enum shape;
// a variant-object comparison (`role?.admin === null`) only matches the Candid
// shape. `isAdminRole` handles BOTH (plus a defensive string-coercion path) so
// the admin gate works no matter which binding the actor serializes through.
function isAdminRole(role: UserRole | null | undefined): boolean {
  if (role == null) return false;
  if (typeof role === "string") return role === "admin";
  if (typeof role === "object") {
    const r = role as { admin?: unknown; user?: unknown };
    return "admin" in r && r.admin != null;
  }
  return false;
}

// ─── Authorization error ─────────────────────────────────────────────────────
// Thrown by useAllUsers when the backend rejects the caller as a non-admin.
// Distinct from a generic Error so the render layer can tell "server said no"
// apart from a genuine network/actor failure.
class AdminUnauthorizedError extends Error {
  readonly isAdminUnauthorized = true;
  constructor() {
    super("admin access required");
    this.name = "AdminUnauthorizedError";
  }
}

function isAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("admin only") || m.includes("unauthorized");
}

function isAdminUnauthorizedError(err: unknown): boolean {
  return (
    err instanceof AdminUnauthorizedError ||
    (err instanceof Error &&
      (err as { isAdminUnauthorized?: boolean }).isAdminUnauthorized === true)
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useAllUsers() {
  const { actor, isFetching } = useBackend();
  return useQuery<UserProfilePublic[]>({
    queryKey: ["admin", "allUsers"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const result = await actor.listAllUsers();
        // Defense-in-depth: the backend contract says listAllUsers returns an
        // array, but a non-array (rejection object, malformed payload) would
        // crash every downstream .filter / .map. Validate before returning.
        if (!Array.isArray(result)) return [];
        return result;
      } catch (err) {
        // The backend traps with 'admin only' / 'unauthorized' for non-admin
        // callers. Surface this as a real error state instead of masking it
        // with mock data — defense-in-depth for when the client admin gate
        // passes but the server still rejects.
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : String(err);
        if (isAuthError(message)) {
          throw new AdminUnauthorizedError();
        }
        // Genuine network/actor failure: rethrow so React Query surfaces it
        // as an error state with a retry affordance. Do NOT fall back to mock
        // data — that would silently hide a real outage from the admin.
        throw err;
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
    retry: 1,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function truncate(s: string, n = 12): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// Canonical copy-to-clipboard pattern (per project learning): prefer
// navigator.clipboard.writeText, fall back to a hidden textarea + execCommand,
// and surface a 2s "copied" state on the triggering button.
function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (value: string, id: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      // Silently ignore — the copied state simply won't flip.
    }
  };
  return { copiedId, copy };
}

function RoleBadge({ role }: { role: UserRole }) {
  const admin = isAdminRole(role);
  return (
    <Badge
      className={
        admin
          ? "bg-primary/20 text-accent-success border-primary/30 text-xs"
          : "bg-muted text-muted-foreground border-border/40 text-xs"
      }
    >
      {admin ? "Admin" : "User"}
    </Badge>
  );
}

function UserRow({
  user,
  index,
  copiedId,
  onCopy,
}: {
  user: UserProfilePublic;
  index: number;
  copiedId: string | null;
  onCopy: (value: string, id: string) => void;
}) {
  // Account identifier — the backend `id` is a Principal. Surface its string
  // form with a plain-language label ("Account ID") and one-click copy, since
  // the user is non-technical.
  const accountId = user?.id?.toString() ?? "";
  const copyId = `admin.user_row.${index}.account_id`;
  const copied = copiedId === copyId;

  const displayName = user?.displayName ?? "";
  const username = user?.username ?? "";
  const email = user?.email ?? "";
  const timezone = user?.timezone ?? "";

  return (
    <div
      className="grid grid-cols-[1fr_auto] gap-3 items-start p-3 rounded-lg bg-card card-neumorphic border border-border/40 transition-smooth hover:border-primary/30"
      data-ocid={`admin.user_row.item.${index}`}
    >
      {/* Identity block: display name + username + account id (copyable) */}
      <div className="min-w-0 flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground truncate">
          {displayName || username || "Unnamed user"}
        </p>
        {displayName && username ? (
          <p className="text-xs text-muted-foreground truncate">@{username}</p>
        ) : null}
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 flex-shrink-0">
            Account ID
          </span>
          <code className="text-xs font-mono text-muted-foreground truncate">
            {accountId ? truncate(accountId, 20) : "—"}
          </code>
          {accountId ? (
            <button
              type="button"
              onClick={() => onCopy(accountId, copyId)}
              aria-label="Copy account ID"
              data-ocid={`admin.user_row.copy_account_id_button.${index}`}
              className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? (
                <Check className="w-3 h-3 text-accent-success" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          ) : null}
        </div>
        {email ? (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {email}
          </p>
        ) : null}
        {timezone ? (
          <p className="text-[11px] text-muted-foreground/70 truncate">
            {timezone}
          </p>
        ) : null}
      </div>

      {/* Role badge */}
      <div className="flex-shrink-0">
        <RoleBadge role={user.role} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function AdminPage() {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
    refetch,
    isFetching: usersFetching,
  } = useAllUsers();
  const [search, setSearch] = useState("");
  const { copiedId, copy } = useCopyToClipboard();

  // Redirect non-admins (primary client-side guard). Uses the robust
  // isAdminRole helper so the comparison works whether the binding serializes
  // UserRole as an enum string or a Candid variant object.
  if (!profileLoading && !isAdminRole(profile?.role)) {
    return <Navigate to="/" />;
  }

  // Defense-in-depth: if the client gate passed but the server rejected the
  // caller (e.g. stale profile, role mismatch, tampered client), show a
  // friendly "admin access required" state instead of mock data or a crash.
  // Do NOT redirect — the gate above owns redirect; this is the server-side
  // backstop.
  const usersUnauthorized = isAdminUnauthorizedError(usersError);
  const usersFailed = !usersUnauthorized && !!usersError;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => {
        const username = (u?.username ?? "").toLowerCase();
        const displayName = (u?.displayName ?? "").toLowerCase();
        const email = (u?.email ?? "").toLowerCase();
        const id = (u?.id?.toString() ?? "").toLowerCase();
        return (
          username.includes(q) ||
          displayName.includes(q) ||
          email.includes(q) ||
          id.includes(q)
        );
      })
    : users;

  return (
    <div
      className="flex flex-col gap-6 px-4 py-6 max-w-2xl mx-auto pb-24"
      data-ocid="admin.page"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shadow-glow-success">
          <Shield className="w-5 h-5 text-accent-success" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Admin Controls
          </h1>
          <p className="text-xs text-muted-foreground">
            View all registered users
          </p>
        </div>
        <Badge className="ml-auto bg-primary/20 text-accent-success border-primary/30 text-xs">
          Admin
        </Badge>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/30 bg-destructive/10">
        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
        <p className="text-xs text-destructive/80 leading-relaxed">
          This page lists every account on the canister. Account IDs are
          sensitive — share them only with people you trust.
        </p>
      </div>

      {/* Users section */}
      <section data-ocid="admin.users.section">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            Users
          </h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {users.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, email, or account ID…"
            name="admin-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="pl-9 bg-background border-border/60 text-sm"
            data-ocid="admin.search_input"
          />
        </div>

        {usersUnauthorized ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center rounded-lg border border-destructive/30 bg-destructive/5"
            data-ocid="admin.users.unauthorized_state"
            role="alert"
          >
            <Shield className="w-8 h-8 text-destructive/70" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                You do not have access to this page
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xs">
                The server rejected this request because your account does not
                have admin privileges. If you believe this is a mistake, sign
                out and back in, or contact an administrator.
              </p>
            </div>
          </div>
        ) : usersFailed ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center rounded-lg border border-border/40 bg-muted/20"
            data-ocid="admin.users.error_state"
            role="alert"
          >
            <AlertTriangle className="w-8 h-8 text-muted-foreground/70" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Couldn&apos;t load users
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xs">
                Something went wrong fetching the user list. Check your
                connection and try again.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={usersFetching}
              className="h-8 px-3 border-primary/40 text-primary hover:bg-primary/10 transition-smooth"
              data-ocid="admin.users.retry_button"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${usersFetching ? "animate-spin" : ""}`}
              />
              <span className="ml-1.5">Retry</span>
            </Button>
          </div>
        ) : usersLoading ? (
          <div
            className="flex flex-col gap-2"
            data-ocid="admin.users.loading_state"
          >
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-8 text-muted-foreground text-sm"
            data-ocid="admin.users.empty_state"
          >
            {users.length === 0 ? "No users yet." : "No users found."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((user, i) => (
              <UserRow
                key={user.id?.toString() ?? `user-${i}`}
                user={user}
                index={i + 1}
                copiedId={copiedId}
                onCopy={copy}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
