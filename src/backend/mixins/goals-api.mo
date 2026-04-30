import Map "mo:core/Map";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import GoalTypes "../types/goals";
import AuthTypes "../types/auth";
import Goals "../modules/Goals";

/// Goals API Mixin — public canister interface for goal management.
///
/// All operations are delegated to the Goals.GoalStore class, which is the
/// single source of truth for goal storage. GoalStore is constructed per-call
/// (not stored as a field) because class instances are not stable types — the
/// underlying state slices (lists/maps/arrays) are what the actor persists.
mixin (
  goals : List.List<GoalTypes.Goal>,
  obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
  profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
  nextGoalId : [var Nat],
  nextObstacleTemplateId : [var Nat],
) {

  public shared ({ caller }) func createGoal(request : GoalTypes.CreateGoalRequest) : async GoalTypes.GoalPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot create goals");
    let goalStore = Goals.GoalStore(goals, obstacleTemplates, profiles, nextGoalId, nextObstacleTemplateId);
    switch (goalStore.createGoal(caller, request)) {
      case (#ok goal) goal;
      // Surface limit errors as a recognisable trap message so the frontend
      // can detect "limitReached" in the rejection reason string.
      case (#err (#limitReached)) Runtime.trap("limitReached");
      case (#err _) Runtime.trap("Goal creation failed");
    };
  };

  public shared query ({ caller }) func getGoal(goalId : Common.GoalId) : async ?GoalTypes.GoalPublic {
    let goalStore = Goals.GoalStore(goals, obstacleTemplates, profiles, nextGoalId, nextObstacleTemplateId);
    goalStore.getGoal(goalId, caller);
  };

  public shared ({ caller }) func updateGoalState(goalId : Common.GoalId, newState : Common.GoalState) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot update goals");
    let goalStore = Goals.GoalStore(goals, obstacleTemplates, profiles, nextGoalId, nextObstacleTemplateId);
    switch (goalStore.updateGoalState(goalId, caller, newState)) {
      case (#ok result) result;
      case (#err (#goalNotFound)) false;
      case (#err (#notOwner)) Runtime.trap("Not the goal owner");
      case (#err _) false;
    };
  };

  public shared ({ caller }) func updateGoal(goalId : Common.GoalId, request : GoalTypes.UpdateGoalRequest) : async { #ok : GoalTypes.GoalPublic; #err : Text } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot update goals");
    let goalStore = Goals.GoalStore(goals, obstacleTemplates, profiles, nextGoalId, nextObstacleTemplateId);
    switch (goalStore.updateGoal(goalId, caller, request)) {
      case (#ok goal) #ok goal;
      case (#err (#goalNotFound)) #err "goalNotFound";
      case (#err (#notOwner)) #err "notOwner";
      case (#err (#goalNotEditable)) #err "goalNotEditable";
      case (#err (#limitReached)) #err "limitReached";
      case (#err (#invalidInput)) #err "invalidInput";
    };
  };

  public shared query ({ caller }) func listMyGoals() : async [GoalTypes.GoalPublic] {
    let goalStore = Goals.GoalStore(goals, obstacleTemplates, profiles, nextGoalId, nextObstacleTemplateId);
    goalStore.listOwnedGoals(caller);
  };

  public shared ({ caller }) func createObstacleTemplate(request : GoalTypes.CreateObstacleRequest) : async GoalTypes.ObstacleTemplate {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot create obstacle templates");
    let goalStore = Goals.GoalStore(goals, obstacleTemplates, profiles, nextGoalId, nextObstacleTemplateId);
    goalStore.createObstacleTemplate(caller, request);
  };

  public shared query ({ caller }) func listMyObstacleTemplates() : async [GoalTypes.ObstacleTemplate] {
    let goalStore = Goals.GoalStore(goals, obstacleTemplates, profiles, nextGoalId, nextObstacleTemplateId);
    goalStore.listObstacleTemplates(caller);
  };
};
