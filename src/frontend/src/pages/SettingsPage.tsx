import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Info, Lock, Settings, Zap } from "lucide-react";
import type { UserProfilePublic } from "../backend.d.ts";
import { useUserProfile } from "../hooks/useUserProfile";
import { TIER_GOAL_LIMITS, TIER_LABELS } from "../types";
import type { SubscriptionTier } from "../types";

function toNumericTier(tier: UserProfilePublic["tier"]): SubscriptionTier {
  if (tier === "tier3") return 3;
  if (tier === "tier2") return 2;
  return 1;
}

// ─── Tier plan data ───────────────────────────────────────────────────────────
const PLANS: {
  tier: SubscriptionTier;
  name: string;
  price: string;
  colour: string;
  features: string[];
}[] = [
  {
    tier: 1,
    name: "Free",
    price: "$0/mo",
    colour: "border-border/50 bg-card/60",
    features: ["3 concurrent goals", "WOOP goal builder", "Partner Feed"],
  },
  {
    tier: 2,
    name: "Plus",
    price: "$6/mo",
    colour: "border-secondary/30 bg-secondary/5",
    features: [
      "10 concurrent goals",
      "Advanced analytics",
      "Priority connections",
    ],
  },
  {
    tier: 3,
    name: "Power",
    price: "$15/mo",
    colour: "border-primary/30 bg-primary/5",
    features: [
      "25 concurrent goals",
      "Early access features",
      "Priority support",
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function PlanCard({
  tier,
  name,
  price,
  colour,
  features,
  isCurrent,
}: (typeof PLANS)[0] & { isCurrent: boolean }) {
  return (
    <div
      className={`relative flex flex-col gap-3 p-4 rounded-xl border transition-smooth card-neumorphic ${colour} ${isCurrent ? "ring-1 ring-primary/50" : ""}`}
      data-ocid={`settings.plan_card.${tier}`}
    >
      {isCurrent && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-accent-success border border-primary/30">
          Current
        </span>
      )}
      <div>
        <p className="font-display text-sm font-bold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{price}</p>
      </div>
      <ul className="flex flex-col gap-1">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span className="w-1 h-1 rounded-full bg-primary/60 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { data: profile, isLoading } = useUserProfile();

  if (isLoading) {
    return (
      <div
        className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto pb-24"
        data-ocid="settings.loading_state"
      >
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  const tier = profile ? toNumericTier(profile.tier) : (1 as SubscriptionTier);
  const defaultLimit = TIER_GOAL_LIMITS[tier];
  const isOverridden = !!profile && Number(profile.goalLimit) !== defaultLimit;

  return (
    <div
      className="flex flex-col gap-6 px-4 py-6 max-w-lg mx-auto pb-24"
      data-ocid="settings.page"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Subscription Settings
          </h1>
          <p className="text-xs text-muted-foreground">Manage your plan</p>
        </div>
      </div>

      {/* Current subscription card */}
      <div className="p-5 rounded-2xl bg-card card-neumorphic border border-border/40 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Current Plan
          </p>
          <Badge
            className={
              tier === 3
                ? "bg-primary/20 text-accent-success border-primary/30"
                : tier === 2
                  ? "bg-secondary/20 text-accent-skip border-secondary/30"
                  : "bg-muted text-muted-foreground border-border/60"
            }
            data-ocid="settings.current_tier_badge"
          >
            {TIER_LABELS[tier]}
          </Badge>
        </div>

        <Separator className="bg-border/30" />

        <InfoRow
          label="Subscription tier"
          value={`Tier ${tier} — ${TIER_LABELS[tier]}`}
        />
        <InfoRow
          label="Goal limit"
          value={profile ? Number(profile.goalLimit) : defaultLimit}
          mono
        />
        {isOverridden && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <Info className="w-3.5 h-3.5 text-accent-success flex-shrink-0" />
            <p className="text-xs text-accent-success">
              Your limit has been overridden by an administrator.
            </p>
          </div>
        )}
      </div>

      {/* All plans */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-display text-base font-semibold text-foreground">
            Available Plans
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <PlanCard key={p.tier} {...p} isCurrent={p.tier === tier} />
          ))}
        </div>
      </section>

      {/* Upgrade note */}
      {tier < 3 && (
        <div
          className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/30 transition-smooth hover:border-primary/30 cursor-pointer group"
          data-ocid="settings.upgrade_cta"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-smooth" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Upgrade your plan
              </p>
              <p className="text-xs text-muted-foreground">
                Unlock more goals and advanced features
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-smooth" />
        </div>
      )}

      {/* Read-only notice */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        Subscription changes are managed through your account. Contact support
        if you need assistance.
      </p>
    </div>
  );
}
