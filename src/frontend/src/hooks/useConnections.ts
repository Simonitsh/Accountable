import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConnectionPublic } from "../backend.d.ts";
import { useAuth } from "./useAuth";
import { useBackend } from "./useBackend";

/**
 * Lists the signed-in user's accepted (active) connections.
 * Gated on auth + actor readiness to avoid firing before the canister
 * connection is established.
 */
export function useConnections() {
  const { actor, actorReady } = useBackend();
  const { isAuthenticated } = useAuth();

  return useQuery<ConnectionPublic[]>({
    queryKey: ["connections"],
    queryFn: async () => {
      if (!actor) throw new Error("actor not ready");
      return actor.listConnections();
    },
    enabled: isAuthenticated && actorReady,
    staleTime: 0,
    refetchOnMount: true,
    retry: 2,
  });
}

/**
 * Lists the signed-in user's incoming pending connection requests.
 */
export function usePendingRequests() {
  const { actor, actorReady } = useBackend();
  const { isAuthenticated } = useAuth();

  return useQuery<ConnectionPublic[]>({
    queryKey: ["pendingRequests"],
    queryFn: async () => {
      if (!actor) throw new Error("actor not ready");
      return actor.listPendingRequests();
    },
    enabled: isAuthenticated && actorReady,
    staleTime: 0,
    refetchOnMount: true,
    retry: 2,
  });
}

/**
 * Sends a connection request to a partner by their Principal ID (as text).
 * Converts the text Principal to a `Principal` object before calling the
 * backend. Throws if the text is not a valid Principal.
 */
export function useSendConnectionRequest() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetPrincipalText: string) => {
      if (!actor) throw new Error("Actor not available");
      const { Principal } = await import("@icp-sdk/core/principal");
      const target = Principal.fromText(targetPrincipalText);
      return actor.sendConnectionRequest(target);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });
}

/**
 * Responds to a pending connection request (accept or decline).
 * `connectionId` is a bigint on the backend.
 */
export function useRespondToConnection() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      connectionId,
      accept,
    }: {
      connectionId: bigint;
      accept: boolean;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.respondToConnection(connectionId, accept);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });
}
