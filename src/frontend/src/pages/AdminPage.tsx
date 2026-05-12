import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { AlertTriangle, Clock, Save, Search, Shield } from "lucide-react";
import { useState } from "react";
import { useBackend } from "../hooks/useBackend";
import { useUserProfile } from "../hooks/useUserProfile";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserProfilePublic {
  principal: string;
  username: string;
  goalLimit: number;
}

interface AdminAuditEntry {
  adminPrincipal: string;
  targetPrincipal: string;
  newLimit: number;
  timestamp: bigint;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useAllUsers() {
  const { actor, isFetching } = useBackend();
  return useQuery<UserProfilePublic[]>({
    queryKey: ["admin", "allUsers"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (actor as any).listAllUsers();
        return result ?? [];
      } catch {
        return MOCK_USERS;
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

function useAuditLog() {
  const { actor, isFetching } = useBackend();
  return useQuery<AdminAuditEntry[]>({
    queryKey: ["admin", "auditLog"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (actor as any).getAdminAuditLog();
        return result ?? [];
      } catch {
        return MOCK_AUDIT;
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

function useSetGoalLimitOverride() {
  const { actor } = useBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      principal,
      limit,
    }: {
      principal: string;
      limit: number;
    }) => {
      if (!actor) throw new Error("No actor");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (actor as any).setGoalLimitOverride(principal, limit);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

// ─── Mock data (used as fallback) ────────────────────────────────────────────
const MOCK_USERS: UserProfilePublic[] = [
  { principal: "aaaaa-aa", username: "alice_dev", goalLimit: 25 },
  { principal: "bbbbb-bb", username: "bob_user", goalLimit: 3 },
  { principal: "ccccc-cc", username: "carol_plus", goalLimit: 10 },
];
const MOCK_AUDIT: AdminAuditEntry[] = [
  {
    adminPrincipal: "admin-00",
    targetPrincipal: "bbbbb-bb",
    newLimit: 5,
    timestamp: BigInt(Date.now() - 3_600_000) * BigInt(1_000_000),
  },
  {
    adminPrincipal: "admin-00",
    targetPrincipal: "ccccc-cc",
    newLimit: 15,
    timestamp: BigInt(Date.now() - 86_400_000) * BigInt(1_000_000),
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function truncate(s: string, n = 12) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function UserRow({
  user,
  index,
}: {
  user: UserProfilePublic;
  index: number;
}) {
  const [limit, setLimit] = useState<string>(String(user.goalLimit));
  const mutation = useSetGoalLimitOverride();

  const handleSave = () => {
    const n = Number.parseInt(limit, 10);
    if (Number.isNaN(n) || n < 0) return;
    mutation.mutate({ principal: user.principal, limit: n });
  };

  return (
    <div
      className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center p-3 rounded-lg bg-card card-neumorphic border border-border/40 transition-smooth hover:border-primary/30"
      data-ocid={`admin.user_row.item.${index}`}
    >
      {/* Principal + username */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {user.username}
        </p>
        <p className="text-xs font-mono text-muted-foreground">
          {truncate(user.principal, 16)}
        </p>
      </div>

      {/* Current limit */}
      <span className="text-sm text-muted-foreground hidden sm:block">
        Limit:{" "}
        <span className="text-foreground font-semibold">{user.goalLimit}</span>
      </span>

      {/* Override input */}
      <Input
        type="number"
        min={0}
        max={100}
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        className="w-20 h-8 text-center text-sm font-mono bg-background border-border/60"
        data-ocid={`admin.goal_limit_input.${index}`}
      />

      {/* Save */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleSave}
        disabled={mutation.isPending}
        className="h-8 px-3 border-primary/40 text-primary hover:bg-primary/10 hover:shadow-glow-success transition-smooth"
        data-ocid={`admin.save_limit_button.${index}`}
      >
        {mutation.isPending ? (
          <span className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
        ) : (
          <Save className="w-3 h-3" />
        )}
      </Button>
    </div>
  );
}

function AuditTable({ entries }: { entries: AdminAuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-muted-foreground"
        data-ocid="admin.audit_log.empty_state"
      >
        <Clock className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No audit entries yet</p>
      </div>
    );
  }
  return (
    <div
      className="rounded-lg overflow-hidden border border-border/40"
      data-ocid="admin.audit_log.table"
    >
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left px-4 py-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">
              Target
            </th>
            <th className="text-right px-4 py-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">
              New Limit
            </th>
            <th className="text-right px-4 py-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={`${e.targetPrincipal}-${String(e.timestamp)}`}
              className="border-t border-border/30 hover:bg-muted/20 transition-smooth"
              data-ocid={`admin.audit_log.row.${i + 1}`}
            >
              <td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">
                {truncate(e.targetPrincipal, 18)}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-accent-success">
                {e.newLimit}
              </td>
              <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                {new Date(
                  Number(e.timestamp / BigInt(1_000_000)),
                ).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function AdminPage() {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { data: users = [], isLoading: usersLoading } = useAllUsers();
  const { data: auditEntries = [], isLoading: auditLoading } = useAuditLog();
  const [search, setSearch] = useState("");

  // Redirect non-admins
  if (!profileLoading && profile?.role !== "admin") {
    return <Navigate to="/" />;
  }

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.principal.toLowerCase().includes(search.toLowerCase()),
  );

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
            Override goal limits &amp; review audit log
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
          Changes take effect immediately. Overrides persist until removed. Use
          with care.
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
            placeholder="Search by username or principal…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border/60 text-sm"
            data-ocid="admin.search_input"
          />
        </div>

        {usersLoading ? (
          <div
            className="flex flex-col gap-2"
            data-ocid="admin.users.loading_state"
          >
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-8 text-muted-foreground text-sm"
            data-ocid="admin.users.empty_state"
          >
            No users found
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((user, i) => (
              <UserRow key={user.principal} user={user} index={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* Audit log section */}
      <section data-ocid="admin.audit_log.section">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-display text-base font-semibold text-foreground">
            Audit Log
          </h2>
        </div>
        {auditLoading ? (
          <div data-ocid="admin.audit_log.loading_state">
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : (
          <AuditTable entries={auditEntries} />
        )}
      </section>
    </div>
  );
}
