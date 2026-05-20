import List "mo:core/List";
import Time "mo:core/Time";
import Common "../types/common";
import GoalTypes "../types/goals";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";

/// Goals — pure domain logic module.
///
/// All functions are stateless: they receive the mutable List and ID counter
/// from the caller (main.mo via the Goals module). No state is held here.
/// This module returns typed Result<T, GoalError> values — callers must handle
/// all error variants explicitly.
module {
  /// Returns true if two HH:MM time blocks overlap.
  /// Overlap condition: newStart < existingEnd AND newEnd > existingStart.
  func timesOverlap(newStart : Text, newEnd : Text, exStart : Text, exEnd : Text) : Bool {
    newStart < exEnd and newEnd > exStart;
  };

  /// Finds any active Lock-In goal owned by `caller` whose time block overlaps
  /// [newStart, newEnd]. Excludes the goal with `excludeId` (for updates).
  func findOverlappingLockIn(
    goals : List.List<GoalTypes.Goal>,
    caller : Common.UserId,
    newStart : Text,
    newEnd : Text,
    excludeId : ?Common.GoalId,
  ) : ?GoalTypes.Goal {
    goals.find(func(g) {
      if (g.owner != caller) return false;
      if (not g.isLockIn) return false;
      switch (g.state) {
        case (#active or #paused) {};
        case _ { return false };
      };
      switch (excludeId) {
        case (?eid) { if (g.id == eid) return false };
        case null {};
      };
      switch (g.startTime, g.endTime) {
        case (?gs, ?ge) timesOverlap(newStart, newEnd, gs, ge);
        case _ false;
      };
    });
  };

  /// Parses "HH:MM" into minutes-from-midnight. Returns null if format is invalid.
  func parseMinutes(t : Text) : ?Nat {
    let parts = t.split(#char ':');
    switch (parts.next(), parts.next()) {
      case (?hh, ?mm) {
        switch (Nat.fromText(hh), Nat.fromText(mm)) {
          case (?h, ?m) { ?(h * 60 + m) };
          case _ null;
        };
      };
      case _ null;
    };
  };

  /// Returns true if the current server time-of-day falls within the
  /// Lock-In active window: [startMinutes - 5, endMinutes + 5] (inclusive).
  /// Handles midnight crossover when endMinutes + 5 >= 1440.
  func isInActiveWindow(startTime : Text, endTime : Text) : Bool {
    switch (parseMinutes(startTime), parseMinutes(endTime)) {
      case (?startMin, ?endMin) {
        let nowNs : Int = Time.now();
        let nowSec : Int = Int.rem(nowNs / 1_000_000_000, 86400);
        let nowMin : Nat = Int.abs(nowSec) / 60;
        let windowStart : Nat = if (startMin >= 5) { startMin - 5 } else { 0 };
        let windowEnd : Nat = endMin + 5;
        if (windowEnd >= 1440) {
          // Midnight crossover: active if nowMin >= windowStart OR nowMin <= (windowEnd - 1440)
          nowMin >= windowStart or nowMin <= (windowEnd - 1440)
        } else {
          nowMin >= windowStart and nowMin <= windowEnd
        };
      };
      case _ false;
    };
  };

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
      iconName = goal.iconName;
      themeColor = goal.themeColor;
      isLockIn = goal.isLockIn;
      startTime = goal.startTime;
      endTime = goal.endTime;
      lastEditedAt = goal.lastEditedAt;
      emailNotifications = goal.emailNotifications;
      intentTime = goal.intentTime;
      reminderOffset = goal.reminderOffset;
    };
  };

  public func createGoal(
    goals : List.List<GoalTypes.Goal>,
    nextId : Nat,
    caller : Common.UserId,
    request : GoalTypes.CreateGoalRequest,
  ) : { #ok : GoalTypes.GoalPublic; #err : GoalTypes.GoalError } {
    // Overlap validation for Lock-In habits
    if (request.isLockIn) {
      switch (request.startTime, request.endTime) {
        case (?newStart, ?newEnd) {
          switch (findOverlappingLockIn(goals, caller, newStart, newEnd, null)) {
            case (?conflict) {
              return #err(#lockInOverlap("This time overlaps with your existing Lock-In: " # conflict.wish));
            };
            case null {};
          };
        };
        case _ {};
      };
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
      var iconName = request.iconName;
      var themeColor = request.themeColor;
      var isLockIn = request.isLockIn;
      var startTime = request.startTime;
      var endTime = request.endTime;
      var lastEditedAt = null;
      var emailNotifications = false;
      var intentTime = null;
      var reminderOffset = null;
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
        // Daily edit lockout: each goal can only be edited once per calendar day (user's local timezone).
        // First edit (lastEditedAt == null) is always allowed.
        switch (g.lastEditedAt) {
          case (?lea) {
            let nowMs : Int = Time.now() / 1_000_000;
            let tzOffsetMs : Int = request.timezoneOffsetMinutes * 60 * 1000;
            let lastEditedAdjusted : Int = (lea / 1_000_000) + tzOffsetMs;
            let nowAdjusted : Int = nowMs + tzOffsetMs;
            let lastEditedDay : Int = lastEditedAdjusted / 86_400_000;
            let todayDay : Int = nowAdjusted / 86_400_000;
            if (lastEditedDay == todayDay) {
              return #err(#dailyEditLockout);
            };
          };
          case null {};
        };
        // Strict Lock-In edit lockout: reject any edit while the active window is open
        if (g.isLockIn) {
          switch (g.startTime, g.endTime) {
            case (?st, ?et) {
              if (isInActiveWindow(st, et)) {
                return #err(#strictLockActive);
              };
            };
            case _ {};
          };
        };
        switch (g.state) {
          case (#active or #paused) {};
          case _ { return #err(#goalNotEditable) };
        };
        // Determine post-update Lock-In status and times for overlap check
        let willBeLockIn = switch (request.isLockIn) { case (?v) v; case null g.isLockIn };
        let willStart = switch (request.startTime) { case (?t) ?t; case null g.startTime };
        let willEnd = switch (request.endTime) { case (?t) ?t; case null g.endTime };
        if (willBeLockIn) {
          switch (willStart, willEnd) {
            case (?ns, ?ne) {
              switch (findOverlappingLockIn(goals, caller, ns, ne, ?goalId)) {
                case (?conflict) {
                  return #err(#lockInOverlap("This time overlaps with your existing Lock-In: " # conflict.wish));
                };
                case null {};
              };
            };
            case _ {};
          };
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
        switch (request.iconName) {
          case (?i) { g.iconName := ?i };
          case null {};
        };
        switch (request.themeColor) {
          case (?c) { g.themeColor := ?c };
          case null {};
        };
        switch (request.isLockIn) {
          case (?v) { g.isLockIn := v };
          case null {};
        };
        switch (request.startTime) {
          case (?t) { g.startTime := ?t };
          case null {};
        };
        switch (request.endTime) {
          case (?t) { g.endTime := ?t };
          case null {};
        };
        switch (request.emailNotifications) {
          case (?v) { g.emailNotifications := v };
          case null {};
        };
        switch (request.intentTime) {
          case (?t) { g.intentTime := ?t };
          case null {};
        };
        switch (request.reminderOffset) {
          case (?o) { g.reminderOffset := ?o };
          case null {};
        };
        let now = Time.now();
        g.updatedAt := now;
        g.lastEditedAt := ?now;
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
