import List "mo:core/List";
import Time "mo:core/Time";
import Common "../types/common";
import GoalTypes "../types/goals";

/// Goals — pure domain logic module.
///
/// All functions are stateless: they receive the mutable List and ID counter
/// from the caller (main.mo via the Goals module). No state is held here.
/// This module returns typed Result<T, GoalError> values — callers must handle
/// all error variants explicitly.
module {
  public func toPublic(goal : GoalTypes.Goal) : GoalTypes.GoalPublic {
    {
      id = goal.id;
      owner = goal.owner;
      wish = goal.wish;
      wishDescription = goal.wishDescription;
      outcome = goal.outcome;
      obstacleTemplateId = goal.obstacleTemplateId;
      ifThenPlan = goal.ifThenPlan;
      state = goal.state;
      createdAt = goal.createdAt;
      updatedAt = goal.updatedAt;
    };
  };

  public func countActiveGoals(
    goals : List.List<GoalTypes.Goal>,
    owner : Common.UserId,
  ) : Nat {
    goals.values().filter(func(g) { g.owner == owner and g.state == #active }).size();
  };

  public func createGoal(
    goals : List.List<GoalTypes.Goal>,
    nextId : Nat,
    caller : Common.UserId,
    request : GoalTypes.CreateGoalRequest,
    activeGoalCount : Nat,
    goalLimit : Nat,
  ) : { #ok : GoalTypes.GoalPublic; #err : GoalTypes.GoalError } {
    if (activeGoalCount >= goalLimit) {
      return #err(#limitReached);
    };
    let now = Time.now();
    let goal : GoalTypes.Goal = {
      id = nextId;
      owner = caller;
      var wish = request.wish;
      var wishDescription = request.wishDescription;
      outcome = request.outcome;
      obstacleTemplateId = request.obstacleTemplateId;
      var ifThenPlan = request.ifThenPlan;
      var state = #active;
      createdAt = now;
      var updatedAt = now;
    };
    goals.add(goal);
    #ok(toPublic(goal));
  };

  public func getGoal(
    goals : List.List<GoalTypes.Goal>,
    goalId : Common.GoalId,
    caller : Common.UserId,
  ) : ?GoalTypes.GoalPublic {
    switch (goals.find(func(g) { g.id == goalId and g.owner == caller })) {
      case (?g) ?toPublic(g);
      case null null;
    };
  };

  public func updateGoalState(
    goals : List.List<GoalTypes.Goal>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    newState : Common.GoalState,
  ) : { #ok : Bool; #err : GoalTypes.GoalError } {
    switch (goals.find(func(g) { g.id == goalId })) {
      case null { #err(#goalNotFound) };
      case (?g) {
        if (g.owner != caller) return #err(#notOwner);
        g.state := newState;
        g.updatedAt := Time.now();
        #ok true;
      };
    };
  };

  public func listOwnedGoals(
    goals : List.List<GoalTypes.Goal>,
    caller : Common.UserId,
  ) : [GoalTypes.GoalPublic] {
    goals.values().filter(func(g) { g.owner == caller }).map<GoalTypes.Goal, GoalTypes.GoalPublic>(
      func(g) { toPublic(g) }
    ).toArray();
  };

  public func updateGoal(
    goals : List.List<GoalTypes.Goal>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    request : GoalTypes.UpdateGoalRequest,
  ) : { #ok : GoalTypes.GoalPublic; #err : GoalTypes.GoalError } {
    switch (goals.find(func(g) { g.id == goalId })) {
      case null { #err(#goalNotFound) };
      case (?g) {
        if (g.owner != caller) return #err(#notOwner);
        switch (g.state) {
          case (#active or #paused) {};
          case _ { return #err(#goalNotEditable) };
        };
        switch (request.wish) {
          case (?w) { g.wish := w };
          case null {};
        };
        switch (request.wishDescription) {
          case (?wd) { g.wishDescription := wd };
          case null {};
        };
        switch (request.ifThenPlan) {
          case (?p) { g.ifThenPlan := p };
          case null {};
        };
        g.updatedAt := Time.now();
        #ok(toPublic(g));
      };
    };
  };

  public func createObstacleTemplate(
    templates : List.List<GoalTypes.ObstacleTemplate>,
    nextId : Nat,
    caller : Common.UserId,
    request : GoalTypes.CreateObstacleRequest,
  ) : GoalTypes.ObstacleTemplate {
    let tmpl : GoalTypes.ObstacleTemplate = {
      id = nextId;
      owner = caller;
      title = request.title;
      description = request.description;
    };
    templates.add(tmpl);
    tmpl;
  };

  public func listObstacleTemplates(
    templates : List.List<GoalTypes.ObstacleTemplate>,
    caller : Common.UserId,
  ) : [GoalTypes.ObstacleTemplate] {
    templates.values().filter(func(t) { t.owner == caller }).toArray();
  };
};
