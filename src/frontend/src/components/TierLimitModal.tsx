import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpCircle, X, Zap } from "lucide-react";
import type { UserProfile } from "../types";
import { type SubscriptionTier, TIER_GOAL_LIMITS, TIER_LABELS } from "../types";

interface TierLimitModalProps {
  open: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}

function getNextTier(current: SubscriptionTier): SubscriptionTier | null {
  if (current === 1) return 2;
  if (current === 2) return 3;
  return null;
}

const TIER_ACCENT: Record<SubscriptionTier, string> = {
  1: "text-muted-foreground",
  2: "text-accent-skip",
  3: "text-accent-success",
};

const TIER_UPGRADE_COPY: Record<
  SubscriptionTier,
  { headline: string; body: string }
> = {
  1: {
    headline: "Ready to build more habits?",
    body: "Upgrade to Plus and manage up to 10 goals simultaneously. Research shows multi-habit tracking accelerates overall progress.",
  },
  2: {
    headline: "Unlock your full potential.",
    body: "Power tier gives you 25 concurrent goals — ideal for high-performers who want to stack habits systematically.",
  },
  3: {
    headline: "You've reached the maximum.",
    body: "Power tier supports up to 25 active goals. Archive completed or paused goals to free up slots.",
  },
};

export default function TierLimitModal({
  open,
  onClose,
  userProfile,
}: TierLimitModalProps) {
  const navigate = useNavigate();
  if (!open) return null;

  const currentTier = (userProfile?.tier ?? 1) as SubscriptionTier;
  const nextTier = getNextTier(currentTier);
  const currentLimit = TIER_GOAL_LIMITS[currentTier];
  const nextLimit = nextTier ? TIER_GOAL_LIMITS[nextTier] : null;
  const copy = TIER_UPGRADE_COPY[currentTier];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Dialog */}
      <dialog
        open
        aria-modal="true"
        aria-label="Goal Limit Reached"
        data-ocid="tier_limit.dialog"
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] max-w-sm w-full mx-auto rounded-2xl bg-card border border-border shadow-neumorphic-emboss-dark overflow-hidden p-0 m-auto"
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-accent-social/10 border border-accent-social/20 shrink-0 mt-0.5">
              <Zap size={18} className="text-accent-social" />
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <h2 className="text-base font-display font-semibold text-foreground leading-tight">
                Goal Limit Reached
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {TIER_LABELS[currentTier]} plan · {currentLimit} active goal
                {currentLimit !== 1 ? "s" : ""} max
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-ocid="tier_limit.close_button"
            aria-label="Close"
            className="absolute top-3.5 right-3.5 text-muted-foreground hover:text-foreground w-7 h-7"
          >
            <X size={15} />
          </Button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Current tier card */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Current Plan
              </p>
              <p
                className={`text-lg font-display font-bold ${TIER_ACCENT[currentTier]}`}
              >
                Tier {currentTier} — {TIER_LABELS[currentTier]}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Active goal limit</p>
              <p className="text-2xl font-mono font-bold text-foreground">
                {currentLimit}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {copy.body}
          </p>

          {/* Upgrade path */}
          {nextTier && nextLimit && (
            <div
              data-ocid="tier_limit.upgrade_card"
              className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary font-medium uppercase tracking-wide">
                    Upgrade to
                  </p>
                  <p className="text-base font-display font-bold text-foreground">
                    Tier {nextTier} — {TIER_LABELS[nextTier]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Goal limit</p>
                  <p className="text-2xl font-mono font-bold text-accent-success">
                    {nextLimit}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{copy.headline}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-5 pb-5">
          {nextTier ? (
            <Button
              type="button"
              data-ocid="tier_limit.upgrade_button"
              className="w-full gap-2 button-primary-neon"
              onClick={() => {
                onClose();
                void navigate({ to: "/settings" });
              }}
            >
              <ArrowUpCircle size={16} />
              Upgrade to {TIER_LABELS[nextTier]}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            data-ocid="tier_limit.cancel_button"
            className="w-full"
            onClick={onClose}
          >
            {nextTier ? "Not now" : "Got it"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
