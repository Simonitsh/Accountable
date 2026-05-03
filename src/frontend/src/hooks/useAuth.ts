import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useEffect, useRef, useState } from "react";

/**
 * Stable auth hook that avoids the "permanent initializing" trap.
 *
 * The underlying InternetIdentityProvider re-runs its useEffect whenever
 * authClient changes (it's in the dependency array). Every re-run sets
 * loginStatus back to "initializing" before resolving again — which causes
 * isLoading to flicker true/false in a loop.
 *
 * This hook latches isLoading=false the first time loginStatus leaves
 * "initializing". Once it has settled once, isLoading stays false regardless
 * of subsequent "initializing" flickers from the provider's internal re-runs.
 */
export function useAuth() {
  const { identity, loginStatus, login, clear, isAuthenticated, isLoggingIn } =
    useInternetIdentity();

  // Track whether auth has ever resolved (left "initializing" state).
  // Using a ref so it persists across renders without triggering re-renders.
  const hasSettledRef = useRef(false);
  // Local state to trigger re-render when we first settle.
  const [hasSettled, setHasSettled] = useState(false);

  useEffect(() => {
    if (!hasSettledRef.current && loginStatus !== "initializing") {
      hasSettledRef.current = true;
      setHasSettled(true);
    }
  }, [loginStatus]);

  const principalText = identity?.getPrincipal().toText() ?? null;
  const isAnonymous = !isAuthenticated || principalText === "2vxsx-fae";

  // isLoading is only true until auth has settled for the very first time.
  // After that, it stays false — even if the provider briefly flickers back
  // to "initializing" on subsequent renders.
  const isLoading = !hasSettled;

  return {
    identity,
    isAuthenticated: isAuthenticated && !isAnonymous,
    isLoading,
    isLoggingIn,
    loginStatus,
    principalText: isAnonymous ? null : principalText,
    login,
    logout: clear,
  };
}
