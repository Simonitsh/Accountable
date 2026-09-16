import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { FeedItem } from "../components/FeedItem";
import { PartnerHabitDetail } from "../components/PartnerHabitDetail";
import { PartnerOverviewCard } from "../components/PartnerOverviewCard";
import { useBackend } from "../hooks/useBackend";
import { usePartnerOverviews } from "../hooks/usePartnerHabits";
import type { FeedItem as FeedItemType } from "../types";

// ─── New partner highlight (mirrors DashboardPage new-habit-glow pattern) ───────
// ScanTab sets this localStorage key after a successful partner connection.
// We read it on mount, clear it immediately (so it only fires once), and apply
// a subtle emerald green border glow to the matching partner card for 3s.
const NEW_PARTNER_KEY = "cumulative-new-partner-key";
const NEW_PARTNER_DURATION_MS = 3_000;

type TabId = "feed" | "my-partners";

const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "feed", label: "Partner Feed", icon: Activity },
  { id: "my-partners", label: "My Partners", icon: Users },
];

function NewPartnerGlow() {
  return <div aria-hidden="true" className="new-habit-glow" />;
}

// ─── Feed sub-tab ──────────────────────────────────────────────────────────────
// Renders the partner feed (recent partner check-ins) as the default sub-view
// inside the Partners tab. Mirrors the original FeedPage implementation.
function PartnerFeedTab() {
  const { actor, isFetching: actorFetching } = useBackend();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: feedItems,
    isLoading,
    refetch,
    isError,
  } = useQuery<FeedItemType[]>({
    queryKey: ["partnerFeed"],
    queryFn: async () => {
      if (!actor) return [];
      return (
        actor as unknown as { getPartnerFeed: () => Promise<FeedItemType[]> }
      ).getPartnerFeed();
    },
    enabled: !!actor && !actorFetching,
    staleTime: 30_000,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const isEmpty =
    !isLoading && !isError && (!feedItems || feedItems.length === 0);

  return (
    <div className="flex flex-col h-full min-h-0" data-ocid="partners.feed.tab">
      {/* Feed header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="font-display text-base font-semibold text-foreground">
          Recent Activity
        </h2>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-smooth active:scale-90 disabled:opacity-50"
          aria-label="Refresh feed"
          data-ocid="partners.feed.refresh_button"
        >
          <RefreshCw
            size={16}
            className={isRefreshing ? "animate-spin" : ""}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Feed body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Loading skeletons */}
        {(isLoading || actorFetching) && (
          <div
            className="space-y-3"
            data-ocid="partners.feed.loading_state"
            aria-live="polite"
            aria-busy="true"
          >
            {(["sk1", "sk2", "sk3", "sk4"] as const).map((skKey) => (
              <div
                key={skKey}
                className="card-neumorphic bg-card border border-border/50 rounded-xl p-4 space-y-3"
              >
                <div className="flex justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32 bg-muted/60" />
                    <Skeleton className="h-3 w-24 bg-muted/40" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full bg-muted/60" />
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border/30">
                  <Skeleton className="h-3 w-16 bg-muted/40" />
                  <Skeleton className="h-7 w-28 rounded-full bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3"
            data-ocid="partners.feed.error_state"
            role="alert"
          >
            <span className="text-3xl">⚠️</span>
            <p className="text-muted-foreground text-sm text-center">
              Couldn't load the feed. Tap refresh to try again.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="text-sm text-accent-social underline underline-offset-2"
              data-ocid="partners.feed.retry_button"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-20 px-6 gap-5"
            data-ocid="partners.feed.empty_state"
          >
            <div className="w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center shadow-neumorphic-emboss-dark">
              <Users size={36} className="text-muted-foreground/50" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="font-display font-semibold text-foreground text-base">
                No activity yet
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Connect with accountability partners to see their progress here.
              </p>
            </div>
          </motion.div>
        )}

        {/* Feed items */}
        {!isLoading && !isError && feedItems && feedItems.length > 0 && (
          <AnimatePresence mode="popLayout">
            {feedItems.map((item, index) => (
              <motion.div
                key={`${item.checkIn.id}-${index}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <FeedItem item={item} index={index + 1} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─── My Partners sub-tab ───────────────────────────────────────────────────────
// Renders the overview list of all accepted partners as expandable
// PartnerOverviewCard components. Tapping a card reveals its PartnerHabitDetail.
function MyPartnersTab() {
  const {
    data: overviews,
    isLoading,
    isError,
    refetch,
  } = usePartnerOverviews();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── New partner highlight ────────────────────────────────────────────────
  const [newPartnerKey, setNewPartnerKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem(NEW_PARTNER_KEY);
    } catch {
      return null;
    }
  });

  // Clear the key immediately so it doesn't fire again on re-mount, then
  // auto-clear the highlight state after the glow duration.
  useEffect(() => {
    if (!newPartnerKey) return;
    try {
      localStorage.removeItem(NEW_PARTNER_KEY);
    } catch {}
    const timer = setTimeout(() => {
      setNewPartnerKey(null);
    }, NEW_PARTNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [newPartnerKey]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleToggle = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const isEmpty = !isLoading && !isError && (overviews?.length ?? 0) === 0;

  return (
    <div
      className="flex flex-col h-full min-h-0"
      data-ocid="partners.my_partners.tab"
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex flex-col">
          <h2 className="font-display text-base font-semibold text-foreground">
            Your Partners
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tap a partner to see their habits
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-smooth active:scale-90 disabled:opacity-50"
          aria-label="Refresh partners"
          data-ocid="partners.my_partners.refresh_button"
        >
          <RefreshCw
            size={16}
            className={isRefreshing ? "animate-spin" : ""}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Loading skeletons */}
        {isLoading && (
          <div
            className="space-y-3"
            data-ocid="partners.my_partners.loading_state"
            aria-live="polite"
            aria-busy="true"
          >
            {(["sk1", "sk2", "sk3"] as const).map((skKey) => (
              <div
                key={skKey}
                className="card-neumorphic bg-card border border-border/50 rounded-xl p-4 flex items-center gap-3"
              >
                <Skeleton className="h-10 w-10 rounded-full bg-muted/60 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 bg-muted/60" />
                  <Skeleton className="h-3 w-24 bg-muted/40" />
                </div>
                <Skeleton className="h-6 w-6 rounded-full bg-muted/40" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3"
            data-ocid="partners.my_partners.error_state"
            role="alert"
          >
            <span className="text-3xl" aria-hidden="true">
              ⚠️
            </span>
            <p className="text-muted-foreground text-sm text-center">
              Couldn't load your partners. Tap refresh to try again.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="text-sm text-accent-social underline underline-offset-2"
              data-ocid="partners.my_partners.retry_button"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-20 px-6 gap-5"
            data-ocid="partners.my_partners.empty_state"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-neumorphic-emboss-dark"
              style={{ background: "oklch(var(--muted))" }}
            >
              <Users
                size={36}
                className="text-muted-foreground/50"
                aria-hidden="true"
              />
            </div>
            <div className="text-center space-y-1.5">
              <p className="font-display font-semibold text-foreground text-base">
                No partners yet
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Connect with accountability partners in Connections to see their
                habits here.
              </p>
            </div>
          </motion.div>
        )}

        {/* Overview cards — only one expanded at a time */}
        {!isLoading && !isError && overviews && overviews.length > 0 && (
          <AnimatePresence mode="popLayout">
            {overviews.map((overview, index) => {
              const isNewPartner = newPartnerKey === overview.key;
              return (
                <motion.div
                  key={overview.key}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                  className="relative"
                >
                  <PartnerOverviewCard
                    overview={overview}
                    index={index}
                    isExpanded={expandedKey === overview.key}
                    onToggle={() => handleToggle(overview.key)}
                  >
                    {expandedKey === overview.key && (
                      <PartnerHabitDetail target={overview.key} index={index} />
                    )}
                  </PartnerOverviewCard>
                  {isNewPartner && <NewPartnerGlow />}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/**
 * PartnersPage — partner feed + partner overview, presented as in-page sub-tabs.
 *
 * Default sub-tab is "feed" so the partner feed is the FIRST thing users see
 * when they tap the Partners tab in the bottom tab bar. The "my-partners"
 * sub-tab shows the overview list of accepted partners as expandable
 * PartnerOverviewCard components (tapping one reveals PartnerHabitDetail).
 *
 * Tab pattern mirrors ConnectionsPage (TabId union + TABS array + activeTab
 * useState + role=tablist/tab/tabpanel).
 */
export function PartnersPage() {
  const [activeTab, setActiveTab] = useState<TabId>("feed");

  return (
    <div className="flex flex-col h-full min-h-0" data-ocid="partners.page">
      {/* Page header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-display text-lg font-semibold text-foreground">
          Partners
        </h1>
      </div>

      {/* Sub-tab bar */}
      <div
        className="card-neumorphic mx-4 mb-1 flex gap-2 rounded-2xl p-2"
        role="tablist"
        data-ocid="partners.tabs"
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-smooth ${
                isActive
                  ? "shadow-neumorphic-inset text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-ocid={`partners.tab.${tab.id}`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div role="tabpanel" className="flex-1 min-h-0">
        {activeTab === "feed" && <PartnerFeedTab />}
        {activeTab === "my-partners" && <MyPartnersTab />}
      </div>
    </div>
  );
}
