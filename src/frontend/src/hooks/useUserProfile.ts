import { useQuery } from "@tanstack/react-query";
import type { UserProfile } from "../types";
import { useAuth } from "./useAuth";
import { useBackend } from "./useBackend";

// Mock user profile until backend methods are available
function mockProfile(principalText: string): UserProfile {
  return {
    id: principalText,
    username: `${principalText.slice(0, 8)}...`,
    role: "user",
    tier: 1,
    goalLimit: 3,
  };
}

export function useUserProfile() {
  const { actor, isFetching } = useBackend();
  const { isAuthenticated, principalText } = useAuth();

  return useQuery<UserProfile | null>({
    queryKey: ["userProfile", principalText],
    queryFn: async () => {
      if (!principalText) return null;
      // Backend profile method - fall back to mock if not available
      if (actor && "getUserProfile" in actor) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (actor as any).getUserProfile();
          if (result) return result as UserProfile;
        } catch {
          // fall through to mock
        }
      }
      return mockProfile(principalText);
    },
    enabled: isAuthenticated && !isFetching && !!principalText,
    staleTime: 5 * 60 * 1000,
  });
}
