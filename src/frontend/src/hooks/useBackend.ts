import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";

export function useBackend() {
  const { actor, isFetching } = useActor(createActor);
  // actorReady is a stable boolean: true only when actor is non-null AND
  // the initialization fetch is complete. Use this to gate queries that
  // must not fire before the canister connection is fully established.
  const actorReady = !!actor && !isFetching;
  return { actor, isFetching, actorReady };
}

/**
 * useDeleteGoal — hard-deletes a macro goal via the `deleteGoal` canister
 * method. The backend signature is
 *   (goalId : GoalId) -> async { #ok; #err : Text }
 * so the mutation unwraps the variant and throws on #err.
 *
 * On success it invalidates the `myGoals`, `myReusableGoals`, `myCheckIns`,
 * and `analytics` query caches so every surface that lists the goal or its
 * child habits' data (dashboard, My Goals page, My Habits page, the WOOP
 * wizard reuse chips, the check-in feed, and the analytics page) refetches
 * without the deleted goal. Pages that need custom toast / onSettled behavior
 * pass their own callbacks via `options`; supplied callbacks run AFTER the
 * cache invalidation defaults.
 */
interface DeleteGoalVariables {
  goalId: bigint;
}

interface UseDeleteGoalOptions {
  onSuccess?: (variables: DeleteGoalVariables) => void;
  onError?: (err: Error, variables: DeleteGoalVariables) => void;
  onSettled?: (variables: DeleteGoalVariables) => void;
}

export function useDeleteGoal(options?: UseDeleteGoalOptions) {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId }: DeleteGoalVariables) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.deleteGoal(goalId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["myGoals"] });
      queryClient.invalidateQueries({ queryKey: ["myReusableGoals"] });
      queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      options?.onSuccess?.(variables);
    },
    onError: (err: Error, variables) => {
      console.error("[useDeleteGoal] deleteGoal error:", err);
      options?.onError?.(err, variables);
    },
    onSettled: (_data, _err, variables) => {
      options?.onSettled?.(variables);
    },
  });
}

/**
 * useDeleteHabit — hard-deletes a single habit via the `deleteHabit` canister
 * method. The backend signature is
 *   (habitId : GoalId) -> async { #ok; #err : Text }
 * so the mutation unwraps the variant and throws on #err.
 *
 * On success it invalidates the `myGoals`, `myReusableGoals`, `myCheckIns`,
 * and `analytics` query caches so every surface that lists habits or their
 * check-in history (dashboard, My Goals page, My Habits page, the WOOP
 * wizard reuse chips, the check-in feed, and the analytics page) refetches
 * without the deleted habit. Pages that need custom toast / onSettled
 * behavior pass their own callbacks via `options`; supplied callbacks run
 * AFTER the cache invalidation defaults.
 */
interface DeleteHabitVariables {
  habitId: bigint;
}

interface UseDeleteHabitOptions {
  onSuccess?: (variables: DeleteHabitVariables) => void;
  onError?: (err: Error, variables: DeleteHabitVariables) => void;
  onSettled?: (variables: DeleteHabitVariables) => void;
}

export function useDeleteHabit(options?: UseDeleteHabitOptions) {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId }: DeleteHabitVariables) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.deleteHabit(habitId);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["myGoals"] });
      queryClient.invalidateQueries({ queryKey: ["myReusableGoals"] });
      queryClient.invalidateQueries({ queryKey: ["myCheckIns"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      options?.onSuccess?.(variables);
    },
    onError: (err: Error, variables) => {
      console.error("[useDeleteHabit] deleteHabit error:", err);
      options?.onError?.(err, variables);
    },
    onSettled: (_data, _err, variables) => {
      options?.onSettled?.(variables);
    },
  });
}
