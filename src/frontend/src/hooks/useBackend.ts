import { useActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

export function useBackend() {
  const { actor, isFetching } = useActor(createActor);
  return { actor, isFetching };
}
