import { useInternetIdentity } from "@caffeineai/core-infrastructure";

export function useAuth() {
  const {
    identity,
    loginStatus,
    login,
    clear,
    isAuthenticated,
    isInitializing,
    isLoggingIn,
  } = useInternetIdentity();

  const principalText = identity?.getPrincipal().toText() ?? null;
  const isAnonymous = !isAuthenticated || principalText === "2vxsx-fae";

  return {
    identity,
    isAuthenticated: isAuthenticated && !isAnonymous,
    isLoading: isInitializing,
    isLoggingIn,
    loginStatus,
    principalText: isAnonymous ? null : principalText,
    login,
    logout: clear,
  };
}
