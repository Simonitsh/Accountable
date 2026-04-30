import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { FeedItem } from "../components/FeedItem";
import { useBackend } from "../hooks/useBackend";
import type { FeedItem as FeedItemType } from "../types";

export function FeedPage() {
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
    <div className="flex flex-col h-full min-h-0" data-ocid="feed.page">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-display text-lg font-semibold text-foreground">
          Partner Feed
        </h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-smooth active:scale-90 disabled:opacity-50"
          aria-label="Refresh feed"
          data-ocid="feed.refresh_button"
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
            data-ocid="feed.loading_state"
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
            data-ocid="feed.error_state"
            role="alert"
          >
            <span className="text-3xl">⚠️</span>
            <p className="text-muted-foreground text-sm text-center">
              Couldn&apos;t load the feed. Tap refresh to try again.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="text-sm text-accent-social underline underline-offset-2"
              data-ocid="feed.retry_button"
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
            data-ocid="feed.empty_state"
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
