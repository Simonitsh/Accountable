import List "mo:core/List";
import Common "../types/common";
import GoalTypes "../types/goals";
import GoalLib "../lib/goals";

/// Goals Module — single authoritative source for goal storage.
///
/// STORAGE CONTRACT
/// ────────────────
/// `goals` and `nextGoalId` are declared `var` intentionally.
///
///   ⚠️  NEVER change `var goals` to `let goals`.
///   ⚠️  NEVER change `var nextGoalId` to `let nextGoalId`.
///
/// Changing either to `let` will cause ALL goals to be silently discarded
/// on every function call. The bug is silent — no compile error, no runtime
/// trap — and extremely hard to detect. This warning exists because this bug
/// has regressed twice. Do not remove this comment.
///
/// This module is a class so it can be instantiated by main.mo as the single
/// owner of goal state. All public methods delegate to GoalLib for domain
/// logic, ensuring goal storage has exactly ONE mutable declaration site.
module {
  public class GoalStore(
    // These mutable collections are the SINGLE source of truth for goal state.
    // They are passed in from main.mo so the actor's orthogonal persistence
    // covers them — but they MUST remain var/mutable at the declaration site.
    goals : List.List<GoalTypes.Goal>,
    obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
    nextGoalId : [var Nat],           // ⚠️ MUST be [var Nat], NOT [Nat]
    nextObstacleTemplateId : [var Nat], // ⚠️ MUST be [var Nat], NOT [Nat]
  ) {
    /// Create a new goal for `caller`.
    public func createGoal(
      caller : Common.UserId,
      request : GoalTypes.CreateGoalRequest,
    ) : { #ok : GoalTypes.GoalPublic; #err : GoalTypes.GoalError } {
      let id = nextGoalId[0];
      nextGoalId[0] += 1;
      GoalLib.createGoal(goals, id, caller, request);
    };

    /// Retrieve a goal by ID. Only the owning caller can see their goal.
    public func getGoal(
      goalId : Common.GoalId,
      caller : Common.UserId,
    ) : ?GoalTypes.GoalPublic {
      GoalLib.getGoal(goals, goalId, caller);
    };

    /// Transition a goal to a new state. Returns #err #goalNotFound or #notOwner on failure.
    public func updateGoalState(
      goalId : Common.GoalId,
      caller : Common.UserId,
      newState : Common.GoalState,
    ) : { #ok : Bool; #err : GoalTypes.GoalError } {
      GoalLib.updateGoalState(goals, goalId, caller, newState);
    };

    /// Update mutable fields (wish, wishDescription, ifThenPlan) of an active/paused goal.
    public func updateGoal(
      goalId : Common.GoalId,
      caller : Common.UserId,
      request : GoalTypes.UpdateGoalRequest,
    ) : { #ok : GoalTypes.GoalPublic; #err : GoalTypes.GoalError } {
      GoalLib.updateGoal(goals, goalId, caller, request);
    };

    /// List all goals owned by `caller`.
    public func listOwnedGoals(caller : Common.UserId) : [GoalTypes.GoalPublic] {
      GoalLib.listOwnedGoals(goals, caller);
    };

    /// Create an obstacle template for `caller`.
    public func createObstacleTemplate(
      caller : Common.UserId,
      request : GoalTypes.CreateObstacleRequest,
    ) : GoalTypes.ObstacleTemplate {
      let id = nextObstacleTemplateId[0];
      nextObstacleTemplateId[0] += 1;
      GoalLib.createObstacleTemplate(obstacleTemplates, id, caller, request);
    };

    /// List all obstacle templates owned by `caller`.
    public func listObstacleTemplates(caller : Common.UserId) : [GoalTypes.ObstacleTemplate] {
      GoalLib.listObstacleTemplates(obstacleTemplates, caller);
    };
  };
};
