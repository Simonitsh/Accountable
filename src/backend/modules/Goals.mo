import List "mo:core/List";
import Common "../types/common";
import GoalTypes "../types/goals";
import CheckInTypes "../types/checkins";
import FeedTypes "../types/feed";
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
    nextGoalId : [var Nat],           // ⚠️ MUST be [var Nat], NOT [Nat]
  ) {
    /// Create a new macro goal (a container) for `caller`.
    public func createMacroGoal(
      caller : Common.UserId,
      request : GoalTypes.CreateMacroGoalRequest,
    ) : { #ok : GoalTypes.MacroGoalPublic; #err : GoalTypes.GoalError } {
      let result = GoalLib.createMacroGoal(goals, nextGoalId[0], caller, request);
      switch (result) {
        case (#ok _) { nextGoalId[0] += 1 };
        case (#err _) {};
      };
      result;
    };

    /// Create a new habit linked to an existing macro goal for `caller`.
    public func createHabit(
      caller : Common.UserId,
      request : GoalTypes.CreateHabitRequest,
    ) : { #ok : GoalTypes.HabitPublic; #err : GoalTypes.GoalError } {
      let result = GoalLib.createHabit(goals, nextGoalId[0], caller, request);
      switch (result) {
        case (#ok _) { nextGoalId[0] += 1 };
        case (#err _) {};
      };
      result;
    };

    /// Retrieve a macro goal by ID. Only the owning caller can see it.
    public func getMacroGoal(
      goalId : Common.GoalId,
      caller : Common.UserId,
    ) : ?GoalTypes.MacroGoalPublic {
      GoalLib.getMacroGoal(goals, goalId, caller);
    };

    /// Retrieve a habit by ID. Only the owning caller can see it.
    public func getHabit(
      habitId : Common.GoalId,
      caller : Common.UserId,
    ) : ?GoalTypes.HabitPublic {
      GoalLib.getHabit(goals, habitId, caller);
    };

    /// Transition a goal (macro or habit) to a new state.
    public func updateGoalState(
      goalId : Common.GoalId,
      caller : Common.UserId,
      newState : Common.GoalState,
    ) : { #ok : Bool; #err : GoalTypes.GoalError } {
      GoalLib.updateGoalState(goals, goalId, caller, newState);
    };

    /// Permanently delete a macro goal and all of its child habits in a single
    /// atomic operation. `checkIns` and `interactions` are the shared
    /// collections the cascade purges — they are passed in from the mixin
    /// (which owns them alongside `goals`) rather than held by the store, so
    /// the store stays the single owner of goal storage only.
    public func deleteGoal(
      checkIns : List.List<CheckInTypes.CheckIn>,
      interactions : List.List<FeedTypes.Interaction>,
      goalId : Common.GoalId,
      caller : Common.UserId,
    ) : { #ok; #err : GoalTypes.GoalError } {
      GoalLib.deleteGoal(goals, checkIns, interactions, goalId, caller);
    };

    /// Permanently delete a single habit in one atomic operation. `checkIns`
    /// and `interactions` are the shared collections the cascade purges —
    /// passed in from the mixin (which owns them alongside `goals`) rather
    /// than held by the store, so the store stays the single owner of goal
    /// storage only. Scoped to one habit — does not touch the parent macro
    /// goal or sibling habits.
    public func deleteHabit(
      checkIns : List.List<CheckInTypes.CheckIn>,
      interactions : List.List<FeedTypes.Interaction>,
      habitId : Common.GoalId,
      caller : Common.UserId,
    ) : { #ok; #err : GoalTypes.GoalError } {
      GoalLib.deleteHabit(goals, checkIns, interactions, habitId, caller);
    };

    /// Update an editable habit.
    public func updateHabit(
      habitId : Common.GoalId,
      caller : Common.UserId,
      request : GoalTypes.UpdateHabitRequest,
    ) : { #ok : GoalTypes.HabitPublic; #err : GoalTypes.GoalError } {
      GoalLib.updateHabit(goals, habitId, caller, request);
    };

    /// Update an editable macro goal.
    public func updateMacroGoal(
      goalId : Common.GoalId,
      caller : Common.UserId,
      request : GoalTypes.UpdateMacroGoalRequest,
    ) : { #ok : GoalTypes.MacroGoalPublic; #err : GoalTypes.GoalError } {
      GoalLib.updateMacroGoal(goals, goalId, caller, request);
    };

    /// List the caller's macro goals, each grouped with its linked habits.
    public func listMyGoalsGrouped(caller : Common.UserId) : [GoalTypes.GoalWithHabitsPublic] {
      GoalLib.listMyGoalsGrouped(goals, caller);
    };

    /// List habits linked to a specific macro goal (by parent goalId).
    public func listHabitsByParent(
      parentGoalId : Common.GoalId,
      caller : Common.UserId,
    ) : { #ok : [GoalTypes.HabitPublic]; #err : GoalTypes.GoalError } {
      GoalLib.listHabitsByParent(goals, parentGoalId, caller);
    };

    /// List the caller's reusable macro goals for the wizard chips.
    public func listReusableGoals(caller : Common.UserId) : [GoalTypes.ReusableGoalPublic] {
      GoalLib.listReusableGoals(goals, caller);
    };
  };
};
