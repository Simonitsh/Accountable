import { useActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

export function useBackend() {
  const { actor, isFetching } = useActor(createActor);
  // actorReady is a stable boolean: true only when actor is non-null AND
  // the initialization fetch is complete. Use this to gate queries that
  // must not fire before the canister connection is fully established.
  const actorReady = !!actor && !isFetching;
  return { actor, isFetching, actorReady };
}
