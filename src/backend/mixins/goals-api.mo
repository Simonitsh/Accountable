import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import GoalTypes "../types/goals";
import CheckInTypes "../types/checkins";
import FeedTypes "../types/feed";
import Goals "../modules/Goals";

/// Goals API Mixin — public canister interface for goal management.
///
/// MACRO GOAL vs HABIT
/// ───────────────────
/// `createMacroGoal` creates a container (category, wish, outcome) via the
/// dedicated goal wizard flow. `createHabit` creates a habit inside an
/// existing macro goal — `goalId` is required and the habit inherits the
/// parent's category. Standalone habit creation (goalId = null) is NOT
/// available; the only way to create a habit is inside a macro goal.
///
/// `listMyGoals` returns macro goals grouped with their linked habits to
/// support the dashboard grouping UI. `listHabitsByParent` fetches habits
/// for a specific macro goal.
mixin (
  goals : List.List<GoalTypes.Goal>,
  obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
  nextGoalId : [var Nat],
  nextObstacleTemplateId : [var Nat],
  checkIns : List.List<CheckInTypes.CheckIn>,
  interactions : List.List<FeedTypes.Interaction>,
) {
  // GoalStore holds only references to the shared mutable collections above
  // — it owns no state of its own, so re-initializing it on every restart is
  // safe and correct. `transient` keeps it out of stable storage.
  transient let store = Goals.GoalStore(goals, obstacleTemplates, nextGoalId, nextObstacleTemplateId);

  /// Create a macro goal (a container). Captured by the goal wizard:
  /// category, wish, outcome (wishDescription). Does NOT accept Lock-In or
  /// schedule fields.
  public shared ({ caller }) func createMacroGoal(request : GoalTypes.CreateMacroGoalRequest) : async { #ok : GoalTypes.MacroGoalPublic; #err : Text } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot create goals");
    switch (store.createMacroGoal(caller, request)) {
      case (#ok g) #ok(g);
      case (#err e) #err(goalErrorToText(e));
    };
  };

  /// Create a habit inside an existing macro goal. `request.goalId` is
  /// REQUIRED — the habit must reference an existing macro goal owned by the
  /// caller. The habit inherits the parent's category; wish/outcome are
  /// sourced from the parent and read-only. The habit's wishDescription
  /// (displayed name) defaults to the parent's, but is overridden by
  /// `request.wishDescription` when the caller supplies one.
  public shared ({ caller }) func createHabit(request : GoalTypes.CreateHabitRequest) : async { #ok : GoalTypes.HabitPublic; #err : Text } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot create habits");
    switch (store.createHabit(caller, request)) {
      case (#ok h) #ok(h);
      case (#err e) #err(goalErrorToText(e));
    };
  };

  /// Retrieve a macro goal by ID. Only the owning caller can see it.
  public shared query ({ caller }) func getMacroGoal(goalId : Common.GoalId) : async ?GoalTypes.MacroGoalPublic {
    store.getMacroGoal(goalId, caller);
  };

  /// Retrieve a habit by ID. Only the owning caller can see it.
  public shared query ({ caller }) func getHabit(habitId : Common.GoalId) : async ?GoalTypes.HabitPublic {
    store.getHabit(habitId, caller);
  };

  /// Transition a goal (macro or habit) to a new state.
  public shared ({ caller }) func updateGoalState(goalId : Common.GoalId, newState : Common.GoalState) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot update goal state");
    switch (store.updateGoalState(goalId, caller, newState)) {
      case (#ok b) b;
      case (#err e) Runtime.trap(goalErrorToText(e));
    };
  };

  /// Permanently delete a macro goal and all of its child habits in a single
  /// atomic operation. Removes every child habit's check-ins, timeline
  /// entries, and feed interactions before removing the habits and the goal
  /// itself. All-or-nothing: partial failure cannot leave dangling habits.
  /// Hard-delete is final — no soft-delete or recoverable state.
  public shared ({ caller }) func deleteGoal(goalId : Common.GoalId) : async { #ok; #err : Text } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot delete goals");
    switch (store.deleteGoal(checkIns, interactions, goalId, caller)) {
      case (#ok) #ok;
      case (#err e) #err(goalErrorToText(e));
    };
  };

  /// Permanently delete a single habit in one atomic operation. Removes the
  /// habit's check-ins, timeline entries, and feed interactions before
  /// removing the habit itself. All-or-nothing: partial failure cannot leave
  /// dangling check-ins. Hard-delete is final — no soft-delete or recoverable
  /// state. Scoped to one habit — does not touch the parent macro goal or
  /// sibling habits.
  public shared ({ caller }) func deleteHabit(habitId : Common.GoalId) : async { #ok; #err : Text } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot delete habits");
    switch (store.deleteHabit(checkIns, interactions, habitId, caller)) {
      case (#ok) #ok;
      case (#err e) #err(goalErrorToText(e));
    };
  };

  /// Update an editable habit. wish/wishDescription/outcome/category are
  /// immutable (sourced from the parent macro goal).
  public shared ({ caller }) func updateHabit(habitId : Common.GoalId, request : GoalTypes.UpdateHabitRequest) : async { #ok : GoalTypes.HabitPublic; #err : Text } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot update habits");
    switch (store.updateHabit(habitId, caller, request)) {
      case (#ok h) #ok(h);
      case (#err e) #err(goalErrorToText(e));
    };
  };

  /// Update an editable macro goal. Only cosmetic fields are editable;
  /// wish/wishDescription/outcome/category are immutable after creation.
  public shared ({ caller }) func updateMacroGoal(goalId : Common.GoalId, request : GoalTypes.UpdateMacroGoalRequest) : async { #ok : GoalTypes.MacroGoalPublic; #err : Text } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot update macro goals");
    switch (store.updateMacroGoal(goalId, caller, request)) {
      case (#ok g) #ok(g);
      case (#err e) #err(goalErrorToText(e));
    };
  };

  /// List the caller's macro goals, each grouped with its linked habits.
  /// Supports the dashboard grouping requirement.
  public shared query ({ caller }) func listMyGoals() : async [GoalTypes.GoalWithHabitsPublic] {
    store.listMyGoalsGrouped(caller);
  };

  /// List habits linked to a specific macro goal (by parent goalId).
  public shared query ({ caller }) func listHabitsByParent(parentGoalId : Common.GoalId) : async { #ok : [GoalTypes.HabitPublic]; #err : Text } {
    switch (store.listHabitsByParent(parentGoalId, caller)) {
      case (#ok hs) #ok(hs);
      case (#err e) #err(goalErrorToText(e));
    };
  };

  /// Returns the caller's reusable macro goals for the wizard chips.
  /// Each entry exposes id, wish, wishDescription, state, and category.
  public shared query ({ caller }) func listMyReusableGoals() : async [GoalTypes.ReusableGoalPublic] {
    store.listReusableGoals(caller);
  };

  public shared ({ caller }) func createObstacleTemplate(request : GoalTypes.CreateObstacleRequest) : async GoalTypes.ObstacleTemplate {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot create obstacle templates");
    store.createObstacleTemplate(caller, request);
  };

  public shared query ({ caller }) func listMyObstacleTemplates() : async [GoalTypes.ObstacleTemplate] {
    store.listObstacleTemplates(caller);
  };

  // Local helper — converts a typed GoalError to a stable Text for the API
  // boundary. Defined at the end of the mixin so the public methods above
  // can reference it (Motoko allows forward references within a block).
  func goalErrorToText(e : GoalTypes.GoalError) : Text {
    switch (e) {
      case (#goalNotFound) "Goal not found";
      case (#notOwner) "Not the goal owner";
      case (#goalNotEditable) "Goal is not editable";
      case (#invalidInput) "Invalid input";
      case (#lockInOverlap(msg)) msg;
      case (#strictLockActive) "Strict Lock-In is currently active";
      case (#dailyEditLockout) "Daily edit lockout — already edited today";
      case (#immutableType) "Field is immutable after creation";
      case (#reusedGoalReadOnly) "Reused goal text is read-only";
      case (#parentGoalRequired) "Parent macro goal is required and must exist";
      case (#wrongGoalKind) "Wrong goal kind for this operation";
    };
  };
};
