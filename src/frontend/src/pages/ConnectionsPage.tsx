import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Link2,
  Loader2,
  Unlink,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useBackend } from "../hooks/useBackend";

// ─── Backend shape ─────────────────────────────────────────────────────────────
interface ConnectionPublic {
  id: string;
  fromPrincipal: string;
  toPrincipal: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: bigint;
}

type SendResult = { ok: null } | { err: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────
function truncatePrincipal(p: string) {
  if (p.length <= 20) return p;
  return `${p.slice(0, 10)}…${p.slice(-6)}`;
}

function SectionHeader({
  icon,
  label,
}: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <h2 className="font-display text-sm font-semibold tracking-wide uppercase text-muted-foreground">
        {label}
      </h2>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="card-neumorphic bg-card rounded-xl p-6 flex flex-col items-center gap-2 text-center"
      data-ocid="connections.empty_state"
    >
      <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Users className="w-5 h-5 text-muted-foreground" />
      </span>
      <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
    </div>
  );
}

function ConnectionCard({
  principal,
  subtitle,
  badge,
  actions,
  ocid,
}: {
  principal: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  ocid?: string;
}) {
  return (
    <div
      className="card-neumorphic bg-card rounded-xl p-4 flex items-center gap-3"
      data-ocid={ocid}
    >
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 shadow-neumorphic-emboss-dark">
        <Users className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate font-mono tracking-tight">
          {truncatePrincipal(principal)}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {badge}
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function ConnectionsPage() {
  const { actor, isFetching } = useBackend();
  const [principalInput, setPrincipalInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const {
    data: activeConnections = [],
    isLoading: loadingActive,
    refetch: refetchActive,
  } = useQuery<ConnectionPublic[]>({
    queryKey: ["connections", "active"],
    queryFn: async () => {
      if (!actor) return [];
      return (
        actor as unknown as {
          listConnections: () => Promise<ConnectionPublic[]>;
        }
      ).listConnections();
    },
    enabled: !!actor && !isFetching,
  });

  const {
    data: pendingConnections = [],
    isLoading: loadingPending,
    refetch: refetchPending,
  } = useQuery<ConnectionPublic[]>({
    queryKey: ["connections", "pending"],
    queryFn: async () => {
      if (!actor) return [];
      return (
        actor as unknown as {
          listPendingRequests: () => Promise<ConnectionPublic[]>;
        }
      ).listPendingRequests();
    },
    enabled: !!actor && !isFetching,
  });

  const refresh = () => {
    void refetchActive();
    void refetchPending();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (toPrincipal: string) => {
      if (!actor) throw new Error("Not connected");
      return (
        actor as unknown as {
          sendConnectionRequest: (p: string) => Promise<SendResult>;
        }
      ).sendConnectionRequest(toPrincipal);
    },
    onSuccess: (result) => {
      if ("err" in result) {
        setSendError(result.err);
        setSendSuccess(false);
      } else {
        setSendError(null);
        setSendSuccess(true);
        setPrincipalInput("");
        refresh();
        setTimeout(() => setSendSuccess(false), 4000);
      }
    },
    onError: () => {
      setSendError("Failed to send request. Please check the principal ID.");
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({
      connectionId,
      accept,
    }: { connectionId: string; accept: boolean }) => {
      if (!actor) throw new Error("Not connected");
      return (
        actor as unknown as {
          respondToConnection: (
            id: string,
            accept: boolean,
          ) => Promise<boolean>;
        }
      ).respondToConnection(connectionId, accept);
    },
    onSettled: () => refresh(),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!actor) throw new Error("Not connected");
      return (
        actor as unknown as {
          respondToConnection: (
            id: string,
            accept: boolean,
          ) => Promise<boolean>;
        }
      ).respondToConnection(connectionId, false);
    },
    onSettled: () => refresh(),
  });

  const handleSend = () => {
    setSendError(null);
    const trimmed = principalInput.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="flex flex-col gap-8 px-4 py-6 max-w-lg mx-auto w-full pb-28">
      {/* ── Send Request ───────────────────────────────────────────────────────── */}
      <section data-ocid="connections.send.section">
        <SectionHeader
          icon={<UserPlus className="w-4 h-4" />}
          label="Send Request"
        />

        <div className="card-neumorphic bg-card rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter your partner's principal ID to send an accountability request.
            They must accept before you can see each other's check-ins.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="aaaaa-bbbbb-ccccc-…"
              value={principalInput}
              onChange={(e) => {
                setPrincipalInput(e.target.value);
                setSendError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="bg-muted border-input font-mono text-sm flex-1"
              data-ocid="connections.send.input"
            />
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || !principalInput.trim()}
              className="button-primary-neon shrink-0"
              data-ocid="connections.send.submit_button"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">Send</span>
            </Button>
          </div>

          {sendError && (
            <p
              className="text-xs text-destructive-foreground bg-destructive/20 rounded-md px-3 py-2"
              data-ocid="connections.send.error_state"
            >
              {sendError}
            </p>
          )}
          {sendSuccess && (
            <p
              className="text-xs text-accent-success bg-primary/10 rounded-md px-3 py-2"
              data-ocid="connections.send.success_state"
            >
              Request sent! Waiting for them to accept.
            </p>
          )}
        </div>
      </section>

      {/* ── Pending Requests ───────────────────────────────────────────────────── */}
      <section data-ocid="connections.pending.section">
        <SectionHeader
          icon={<UserCheck className="w-4 h-4" />}
          label={`Pending Requests${pendingConnections.length > 0 ? ` (${pendingConnections.length})` : ""}`}
        />

        {loadingPending ? (
          <div
            className="flex justify-center py-6"
            data-ocid="connections.pending.loading_state"
          >
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : pendingConnections.length === 0 ? (
          <EmptyState message="No pending requests right now. When someone sends you a connection request, it will appear here." />
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingConnections.map((conn, i) => (
              <li key={conn.id} data-ocid={`connections.pending.item.${i + 1}`}>
                <ConnectionCard
                  principal={conn.fromPrincipal}
                  subtitle="Sent you a connection request"
                  badge={
                    <Badge
                      variant="outline"
                      className="text-xs border-primary/40 text-primary shrink-0"
                    >
                      Pending
                    </Badge>
                  }
                  actions={
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          respondMutation.mutate({
                            connectionId: conn.id,
                            accept: true,
                          })
                        }
                        disabled={respondMutation.isPending}
                        className="button-primary-neon h-8 px-3 text-xs"
                        data-ocid={`connections.accept_button.${i + 1}`}
                      >
                        {respondMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserCheck className="w-3 h-3" />
                        )}
                        <span className="ml-1 hidden sm:inline">Accept</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          respondMutation.mutate({
                            connectionId: conn.id,
                            accept: false,
                          })
                        }
                        disabled={respondMutation.isPending}
                        className="h-8 px-3 text-xs border-destructive/40 text-destructive-foreground hover:bg-destructive/20 transition-smooth"
                        data-ocid={`connections.reject_button.${i + 1}`}
                      >
                        <UserX className="w-3 h-3" />
                        <span className="ml-1 hidden sm:inline">Reject</span>
                      </Button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Active Partners ────────────────────────────────────────────────────── */}
      <section data-ocid="connections.active.section">
        <SectionHeader
          icon={<Users className="w-4 h-4" />}
          label={`Active Partners${activeConnections.length > 0 ? ` (${activeConnections.length})` : ""}`}
        />

        {loadingActive ? (
          <div
            className="flex justify-center py-6"
            data-ocid="connections.active.loading_state"
          >
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : activeConnections.length === 0 ? (
          <EmptyState message="No active partners yet. Once you exchange accepted requests, your accountability partners will appear here." />
        ) : (
          <ul className="flex flex-col gap-3">
            {activeConnections.map((conn, i) => (
              <li key={conn.id} data-ocid={`connections.active.item.${i + 1}`}>
                <ConnectionCard
                  principal={conn.toPrincipal || conn.fromPrincipal}
                  subtitle="Accountability partner"
                  badge={
                    <Badge
                      variant="outline"
                      className="text-xs border-primary/40 text-accent-success shrink-0"
                    >
                      Connected
                    </Badge>
                  }
                  actions={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => disconnectMutation.mutate(conn.id)}
                      disabled={disconnectMutation.isPending}
                      className="h-8 px-3 text-xs border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive-foreground transition-smooth"
                      data-ocid={`connections.disconnect_button.${i + 1}`}
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unlink className="w-3 h-3" />
                      )}
                      <span className="ml-1 hidden sm:inline">Disconnect</span>
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
