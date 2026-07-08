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
      if (!actor) throw new Error("actor not ready");
      try {
        return await actor.getMyProfile();
      } catch {
        return null;
      }
    },
    enabled: isAuthenticated && actorReady,
    staleTime: 0,
    refetchOnMount: true,
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

  const timezoneMutateRef = useRef<(tz: string) => void>(
    timezoneMutation.mutate,
  );
  timezoneMutateRef.current = timezoneMutation.mutate;

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

/**
 * Returns a mutation to update the user's profile (displayName, bio, email).
 * Only updates the UI after the backend confirms success.
 *
 * CRITICAL: The backend (lib/auth.mo) unconditionally assigns
 * profile.avatarShape := avatarShape and profile.avatarColor := avatarColor on
 * every updateMyProfile call. Passing null/null would wipe the user's saved
 * avatar on every bio/displayName/email edit. To preserve the avatar, we read
 * the current profile from the query cache and forward its avatarShape /
 * avatarColor verbatim — the same preservation pattern useUpdateAvatar uses
 * for the non-avatar fields.
 */
export function useUpdateBio() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bio,
      displayName,
      email,
    }: {
      bio: string;
      displayName: string;
      email: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      // Read the current profile from the cache so we can forward the existing
      // avatar fields verbatim — the backend overwrites them unconditionally.
      const currentProfile = queryClient.getQueryData<UserProfilePublic | null>(
        ["userProfile"],
      );
      const shapeArg = currentProfile?.avatarShape ?? null;
      const colorArg = currentProfile?.avatarColor ?? null;
      // Explicitly send null for empty strings to clear the field on the backend.
      // Do NOT use `|| undefined` — that silently ignores clearing.
      const nameArg = displayName.trim().length > 0 ? displayName.trim() : null;
      const bioArg = bio.trim().length > 0 ? bio.trim() : null;
      const emailArg = email.trim().length > 0 ? email.trim() : null;
      const result = await (
        actor as unknown as {
          updateMyProfile: (...args: unknown[]) => Promise<unknown>;
        }
      ).updateMyProfile(
        nameArg,
        shapeArg,
        colorArg,
        bioArg,
        emailArg,
        BigInt(-new Date().getTimezoneOffset()),
      );
      if (
        result &&
        typeof result === "object" &&
        "__kind__" in result &&
        (result as { __kind__: string }).__kind__ === "err"
      )
        throw new Error(String((result as unknown as { err: unknown }).err));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.refetchQueries({ queryKey: ["userProfile"] });
    },
  });
}

/**
 * Returns a mutation to update ONLY the user's avatar (avatarShape + avatarColor
 * + avatarColorMode).
 *
 * Per the dispatch contract, this calls updateMyProfile with the CURRENT
 * displayName, the NEW avatarShape, the NEW avatarColor, the NEW
 * avatarColorMode, the CURRENT bio, the CURRENT email, and the CURRENT
 * timezoneOffsetMinutes — so the non-avatar fields are preserved verbatim while
 * the avatar fields are replaced.
 *
 * Pass `null` for both avatarShape and avatarColor to clear the avatar back to
 * the default username-initial state. Pass `null` for avatarColorMode to let
 * the backend default it (Fill).
 */
export function useUpdateAvatar() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      avatarShape,
      avatarColor,
      avatarColorMode,
      currentProfile,
    }: {
      avatarShape:
        | "Triangle"
        | "Square"
        | "Pentagon"
        | "Hexagon"
        | "Star"
        | null;
      avatarColor: string | null;
      avatarColorMode: "Fill" | "BorderOnly" | null;
      currentProfile: UserProfilePublic;
    }) => {
      if (!actor) throw new Error("Actor not available");
      // Preserve the current non-avatar fields verbatim. Empty strings become
      // null so the backend clears them rather than storing "".
      const nameArg =
        currentProfile.displayName &&
        currentProfile.displayName.trim().length > 0
          ? currentProfile.displayName.trim()
          : null;
      const bioArg =
        currentProfile.bio && currentProfile.bio.trim().length > 0
          ? currentProfile.bio.trim()
          : null;
      const emailArg =
        currentProfile.email && currentProfile.email.trim().length > 0
          ? currentProfile.email.trim()
          : null;
      const tzArg = currentProfile.timezoneOffsetMinutes ?? null;
      // Map the local "Fill" | "BorderOnly" string to the backend enum value.
      // The backend enum serializes to the same string keys, so a plain string
      // literal is sufficient here (the actor call is cast to unknown[] below).
      const modeArg =
        avatarColorMode === "Fill"
          ? "Fill"
          : avatarColorMode === "BorderOnly"
            ? "BorderOnly"
            : null;
      const result = await (
        actor as unknown as {
          updateMyProfile: (...args: unknown[]) => Promise<unknown>;
        }
      ).updateMyProfile(
        nameArg,
        avatarShape,
        avatarColor,
        modeArg,
        bioArg,
        emailArg,
        tzArg,
      );
      if (
        result &&
        typeof result === "object" &&
        "__kind__" in result &&
        (result as { __kind__: string }).__kind__ === "err"
      )
        throw new Error(String((result as unknown as { err: unknown }).err));
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.refetchQueries({ queryKey: ["userProfile"] });
    },
  });
}
