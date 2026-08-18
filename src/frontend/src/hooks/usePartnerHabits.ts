import type { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import type {
  PartnerHabitDetail,
  PartnerOverview,
  UserProfilePublic,
} from "../backend.d.ts";
import { useAuth } from "./useAuth";
import { useBackend } from "./useBackend";

/**
 * Partner habits data layer.
 *
 * Per user instructions, the backend only returns habit data for accepted,
 * mutual partners — these hooks simply surface what the actor returns. No
 * client-side filtering of pending/non-partner data is performed (or needed).
 *
 * Two queries:
 *  - usePartnerOverviews(): the overview list (avatar, name, activeHabitCount,
 *    currentStreak) for every accepted partner. Used to render the overview
 *    grid on PartnersPage.
 *  - usePartnerHabits(target): the full habit list for a single partner,
 *    fetched on demand when their overview card is expanded.
 *
 * Both queries are gated on `isAuthenticated && actorReady` so they never
 * fire before the canister connection is fully established (mirrors the
 * useUserProfile gating pattern).
 */

export interface PartnerOverviewView {
  /** Stable key — the partner's principal as a string. */
  key: string;
  profile: UserProfilePublic;
  activeHabitCount: number;
  currentStreak: number;
}

function toOverviewView(o: PartnerOverview): PartnerOverviewView {
  return {
    key: o.profile.id.toString(),
    profile: o.profile,
    activeHabitCount: Number(o.activeHabitCount ?? 0n),
    currentStreak: Number(o.currentStreak ?? 0n),
  };
}

/** Overview list for every accepted, mutual partner. */
export function usePartnerOverviews() {
  const { actor, actorReady } = useBackend();
  const { isAuthenticated } = useAuth();

  return useQuery<PartnerOverviewView[]>({
    queryKey: ["partnerOverviews"],
    queryFn: async () => {
      if (!actor) return [];
      const raw = await actor.listPartnerOverviews();
      return raw.map(toOverviewView);
    },
    enabled: isAuthenticated && actorReady,
    staleTime: 30_000,
  });
}

export interface PartnerHabitsView {
  /** Stable key — the partner's principal as a string. */
  key: string;
  profile: UserProfilePublic;
  habits: PartnerHabitDetail["habits"];
}

type PartnerHabitsResult =
  | { __kind__: "ok"; ok: PartnerHabitsView }
  | { __kind__: "err"; err: string };

/**
 * Full habit list for a single partner. Pass the partner's principal as a
 * string (the same `key` exposed by `PartnerOverviewView`). Pass `null` to
 * disable the query — used when no card is expanded.
 */
export function usePartnerHabits(target: string | null) {
  const { actor, actorReady } = useBackend();
  const { isAuthenticated } = useAuth();

  return useQuery<PartnerHabitsResult>({
    queryKey: ["partnerHabits", target],
    queryFn: async () => {
      if (!actor || !target) {
        return { __kind__: "err", err: "notPartner" } as PartnerHabitsResult;
      }
      const { Principal } = await import("@icp-sdk/core/principal");
      let principal: Principal;
      try {
        principal = Principal.fromText(target);
      } catch {
        return { __kind__: "err", err: "notPartner" } as PartnerHabitsResult;
      }
      const res = await actor.getPartnerHabits(principal);
      if (res.__kind__ === "ok") {
        return {
          __kind__: "ok",
          ok: {
            key: res.ok.profile.id.toString(),
            profile: res.ok.profile,
            habits: res.ok.habits,
          },
        } satisfies PartnerHabitsResult;
      }
      return { __kind__: "err", err: res.err } satisfies PartnerHabitsResult;
    },
    enabled: isAuthenticated && actorReady && !!target,
    staleTime: 30_000,
  });
}
