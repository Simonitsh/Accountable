import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { UserProfilePublic } from "../backend.d.ts";
import { useAuth } from "./useAuth";
import { useBackend } from "./useBackend";

/**
 * Fetches the current user's profile from the backend.
 *
 * KEY DESIGN: The query is gated on BOTH authentication AND actor readiness.
 * This prevents the 500ms polling loop that caused a permanent loading spinner:
 *
 *   Old (broken): enabled: isAuthenticated
 *     → queryFn fires before actor is ready → returns null → polling loop
 *     → profileIsFetching=true forever → OnboardingGate spins forever
 *
 *   New (fixed): enabled: isAuthenticated && actorReady
 *     → query never fires until actor is truly ready
 *     → first queryFn call gets real data (or null for new users)
 *     → routing decision made cleanly on first successful fetch
 *
 * The refetchInterval is capped at MAX_RETRIES (10 × 500ms = 5 seconds) to
 * prevent indefinite polling if the user is mid-registration or the canister
 * is slow. After the cap, the user can refresh manually.
 */

const MAX_RETRIES = 10;

export function useUserProfile() {
  const { actor, actorReady } = useBackend();
  const { isAuthenticated } = useAuth();
  const retryCount = useRef(0);
  const queryClient = useQueryClient();
  const timezoneSyncedRef = useRef(false);

  const query = useQuery<UserProfilePublic | null>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      // Defensive guard — should never be null if enabled condition is correct,
      // but throw to surface any timing issue rather than silently returning null.
      if (!actor) throw new Error("actor not ready");
      try {
        return await actor.getMyProfile();
      } catch {
        return null;
      }
    },
    // Only fire when BOTH auth has settled AND the canister actor is ready.
    // This is the critical fix: prevents premature firing that caused the loop.
    enabled: isAuthenticated && actorReady,
    staleTime: 0,
    refetchOnMount: true,
    // Safety net: if the first fetch returned null (new user, not yet registered),
    // retry every 500ms — but stop after MAX_RETRIES to prevent infinite polling.
    refetchInterval: (query) => {
      if (query.state.data) {
        retryCount.current = 0;
        return false;
      }
      if (retryCount.current >= MAX_RETRIES) return false;
      retryCount.current += 1;
      return 500;
    },
    retry: 2,
    retryDelay: 300,
  });

  // Timezone mutation — called once if profile.timezone is empty
  const timezoneMutation = useMutation({
    mutationFn: async (tz: string) => {
      if (!actor) throw new Error("actor not ready");
      return actor.setTimezone(tz);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });

  // Auto-detect and save timezone once after profile loads if it's empty
  // Stable ref to mutate so it doesn't create a dep on the mutation object
  const timezoneMutateRef = useRef<(tz: string) => void>(
    timezoneMutation.mutate,
  );
  timezoneMutateRef.current = timezoneMutation.mutate;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only fire once when data first loads
  useEffect(() => {
    if (!query.data || timezoneSyncedRef.current) return;
    if (query.data.timezone && query.data.timezone.trim() !== "") {
      timezoneSyncedRef.current = true;
      return;
    }
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected) return;
    timezoneSyncedRef.current = true;
    timezoneMutateRef.current(detected);
  }, [query.data]);

  return query;
}
