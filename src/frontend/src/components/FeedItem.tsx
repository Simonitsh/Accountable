import { HandMetal } from "lucide-react";
import { useState } from "react";
import { useBackend } from "../hooks/useBackend";
import type { FeedItem as FeedItemType } from "../types";
import { OBSTACLE_TEMPLATES } from "../types";

interface FeedItemProps {
  item: FeedItemType;
  index: number;
}

function formatRelativeTime(timestamp: bigint): string {
  const now = Date.now();
  const ts = Number(timestamp) / 1_000_000; // nanoseconds → ms
  const diffMs = now - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

export function FeedItem({ item, index }: FeedItemProps) {
  const { actor } = useBackend();
  const [highFiveCount, setHighFiveCount] = useState(item.highFiveCount);
  const [hasHighFived, setHasHighFived] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSuccess = item.checkIn.checkInType === "success";
  const obstacleLabel = item.checkIn.obstacleTemplateId
    ? OBSTACLE_TEMPLATES.find((t) => t.id === item.checkIn.obstacleTemplateId)
        ?.label
    : undefined;

  async function handleHighFive() {
    if (hasHighFived || isLoading || !actor) return;
    setIsLoading(true);
    try {
      await (
        actor as unknown as {
          recordInteraction: (id: string, kind: string) => Promise<void>;
        }
      ).recordInteraction(item.checkIn.id, "#highFive");
      setHighFiveCount((c) => c + 1);
      setHasHighFived(true);
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <article
      className="card-neumorphic bg-card rounded-xl p-4 flex flex-col gap-3"
      style={{
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
      data-ocid={`feed.item.${index}`}
      aria-label={`${item.partnerDisplayName}'s check-in for ${item.goalName}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="font-display font-semibold text-foreground truncate leading-tight">
            {item.partnerDisplayName}
          </span>
          <span className="text-sm text-muted-foreground truncate mt-0.5">
            {item.goalName}
          </span>
        </div>

        {/* Check-in badge */}
        {isSuccess ? (
          <span
            className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-card border border-current text-accent-success shadow-glow-success"
            data-ocid={`feed.item.${index}.success_badge`}
          >
            ✓ Success
          </span>
        ) : (
          <span
            className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-card border border-current text-accent-skip shadow-glow-skip"
            data-ocid={`feed.item.${index}.skip_badge`}
          >
            ↻ Skip
          </span>
        )}
      </div>

      {/* Obstacle label (skip only) */}
      {!isSuccess && obstacleLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-1.5 w-fit">
          <span className="opacity-60">Obstacle:</span>
          <span className="text-accent-skip font-medium">{obstacleLabel}</span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(item.checkIn.timestamp)}
        </span>

        {/* High-Five button */}
        <button
          type="button"
          onClick={handleHighFive}
          disabled={hasHighFived || isLoading}
          className={[
            "flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border transition-smooth",
            hasHighFived
              ? "border-accent/60 text-accent-social bg-accent/10 cursor-not-allowed opacity-80"
              : "border-accent/40 text-accent-social hover:shadow-glow-social hover:bg-accent/10 active:scale-95",
          ].join(" ")}
          aria-label={hasHighFived ? "Already high-fived" : "Give a high five"}
          data-ocid={`feed.item.${index}.highfive_button`}
        >
          <HandMetal
            size={15}
            className={isLoading ? "animate-pulse" : ""}
            aria-hidden="true"
          />
          <span>{highFiveCount > 0 ? highFiveCount : ""}</span>
          {!hasHighFived && <span className="sr-only">High-Five</span>}
          {hasHighFived && <span>High-Fived!</span>}
          {!hasHighFived && highFiveCount === 0 && (
            <span aria-hidden="true">High-Five</span>
          )}
        </button>
      </div>
    </article>
  );
}
