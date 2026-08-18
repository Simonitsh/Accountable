import { Avatar } from "@/components/Avatar";
import { MyIdTab } from "@/components/MyIdTab";
import { MyQrTab } from "@/components/MyQrTab";
import { ScanTab } from "@/components/ScanTab";
import { useAuth } from "@/hooks/useAuth";
import {
  useConnections,
  usePendingRequests,
  useRespondToConnection,
} from "@/hooks/useConnections";
import { Check, Clock, Inbox, QrCode, ScanLine, User, X } from "lucide-react";
import { useState } from "react";

type TabId = "myid" | "myqr" | "scan" | "requests";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "myid", label: "My ID", icon: User },
  { id: "myqr", label: "My QR", icon: QrCode },
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "requests", label: "Requests", icon: Inbox },
];

function RequestsTab() {
  const { principalText } = useAuth();
  const pending = usePendingRequests();
  const active = useConnections();
  const respond = useRespondToConnection();

  const handleRespond = async (connectionId: bigint, accept: boolean) => {
    try {
      await respond.mutateAsync({ connectionId, accept });
    } catch {
      // surfaced via query invalidation / mutation error state
    }
  };

  const pendingItems = pending.data ?? [];
  const activeItems = active.data ?? [];

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* Pending requests */}
      <section data-ocid="requests.pending.section">
        <div className="mb-3 flex items-center gap-2 text-foreground">
          <Clock className="h-4 w-4 text-foreground" />
          <h2 className="font-display text-lg font-semibold">
            Pending Requests
          </h2>
          {pendingItems.length > 0 && (
            <span className="chip-neumorphic rounded-full px-2 py-0.5 text-xs font-semibold text-foreground">
              {pendingItems.length}
            </span>
          )}
        </div>

        {pendingItems.length === 0 ? (
          <div
            className="card-neumorphic flex flex-col items-center gap-2 rounded-2xl p-8 text-center text-muted-foreground"
            data-ocid="requests.pending.empty_state"
          >
            <Inbox className="h-8 w-8 text-foreground/60" />
            <p className="text-sm">No pending requests right now.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" data-ocid="requests.pending.list">
            {pendingItems.map((req, idx) => {
              const fromText = req.fromPrincipal.toText();
              return (
                <li
                  key={fromText}
                  className="card-neumorphic flex items-center gap-3 rounded-2xl p-4"
                  data-ocid={`requests.pending.item.${idx + 1}`}
                >
                  <Avatar username={fromText.slice(-4)} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-foreground">
                      {fromText}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Wants to connect
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRespond(req.id, true)}
                    disabled={respond.isPending}
                    className="button-primary-neon flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-smooth disabled:opacity-50"
                    data-ocid={`requests.pending.accept_button.${idx + 1}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespond(req.id, false)}
                    disabled={respond.isPending}
                    className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-foreground transition-smooth disabled:opacity-50"
                    data-ocid={`requests.pending.decline_button.${idx + 1}`}
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Active connections */}
      <section data-ocid="requests.active.section">
        <div className="mb-3 flex items-center gap-2 text-foreground">
          <Check className="h-4 w-4 text-foreground" />
          <h2 className="font-display text-lg font-semibold">
            Active Partners
          </h2>
          {activeItems.length > 0 && (
            <span className="chip-neumorphic rounded-full px-2 py-0.5 text-xs font-semibold text-foreground">
              {activeItems.length}
            </span>
          )}
        </div>

        {activeItems.length === 0 ? (
          <div
            className="card-neumorphic flex flex-col items-center gap-2 rounded-2xl p-8 text-center text-muted-foreground"
            data-ocid="requests.active.empty_state"
          >
            <Inbox className="h-8 w-8 text-foreground/60" />
            <p className="text-sm">
              No active partners yet. Send a request to get started.
            </p>
          </div>
        ) : (
          <ul
            className="grid gap-3 sm:grid-cols-2"
            data-ocid="requests.active.list"
          >
            {activeItems.map((conn, idx) => {
              const partnerPrincipal =
                conn.fromPrincipal.toText() === principalText
                  ? conn.toPrincipal
                  : conn.fromPrincipal;
              const partnerText = partnerPrincipal.toText();
              return (
                <li
                  key={partnerText}
                  className="card-neumorphic flex items-center gap-3 rounded-2xl p-4"
                  data-ocid={`requests.active.item.${idx + 1}`}
                >
                  <Avatar username={partnerText.slice(-4)} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-foreground">
                      {partnerText}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Connected
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("myid");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Connections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your ID, scan a partner&apos;s QR, or manage requests.
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="card-neumorphic mb-6 flex gap-2 rounded-2xl p-2"
        role="tablist"
        data-ocid="connections.tabs"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-smooth ${
                isActive
                  ? "shadow-neumorphic-inset text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-ocid={`connections.tab.${tab.id}`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === "myid" && <MyIdTab />}
        {activeTab === "myqr" && <MyQrTab />}
        {activeTab === "scan" && <ScanTab />}
        {activeTab === "requests" && <RequestsTab />}
      </div>
    </div>
  );
}

export default ConnectionsPage;
