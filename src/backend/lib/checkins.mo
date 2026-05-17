import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import Int "mo:core/Int";

module {
  // 86400 seconds in nanoseconds
  let DAY_NS : Int = 86_400_000_000_000;

  func sameDay(a : Common.Timestamp, b : Common.Timestamp, timezoneOffsetMinutes : Int) : Bool {
    let offsetNs = timezoneOffsetMinutes * 60 * 1_000_000_000;
    ((a + offsetNs) / DAY_NS) == ((b + offsetNs) / DAY_NS);
  };

  public func hasSameDayCheckIn(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    now : Common.Timestamp,
    timezoneOffsetMinutes : Int,
  ) : Bool {
    switch (checkIns.find(func(c) {
      c.goalId == goalId and c.owner == caller and sameDay(c.timestamp, now, timezoneOffsetMinutes)
    })) {
      case (?_) true;
      case null false;
    };
  };

  public func recordCheckIn(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goals : List.List<GoalTypes.Goal>,
    nextId : Nat,
    caller : Common.UserId,
    request : CheckInTypes.RecordCheckInRequest,
  ) : CheckInTypes.CheckIn {
    // Verify ownership and active state
    let goal = switch (goals.find(func(g) { g.id == request.goalId and g.owner == caller })) {
      case null Runtime.trap("Goal not found or not owned by caller");
      case (?g) {
        if (g.state != #active) Runtime.trap("Goal is not active");
        g;
      };
    };
    let now = Time.now();
    // One-per-day rule for Lock-In goals:
    //   - #inProgress: block if already started today
    //   - #success:    block if already checked out today
    //   - #missedCheckIn / #missedCheckOut: block if any terminal record already exists today;
    //                  both require an obstacleTemplateId for analytics
    if (goal.isLockIn) {
      switch (request.checkInType) {
        case (#inProgress) {
          let alreadyStarted = checkIns.find(func(c) {
            c.goalId == request.goalId and c.owner == caller and
            sameDay(c.timestamp, now, request.timezoneOffsetMinutes) and c.checkInType == #inProgress
          }) != null;
          if (alreadyStarted) Runtime.trap("Lock-In already started today");
        };
        case (#success) {
          let alreadyDone = checkIns.find(func(c) {
            c.goalId == request.goalId and c.owner == caller and
            sameDay(c.timestamp, now, request.timezoneOffsetMinutes) and c.checkInType == #success
          }) != null;
          if (alreadyDone) Runtime.trap("Lock-In already completed today");
        };
        case (#missedCheckIn or #missedCheckOut) {
          // Block if any terminal record already exists today
          let alreadyTerminal = checkIns.find(func(c) {
            c.goalId == request.goalId and c.owner == caller and
            sameDay(c.timestamp, now, request.timezoneOffsetMinutes) and
            (c.checkInType == #success or c.checkInType == #missedCheckIn or c.checkInType == #missedCheckOut)
          }) != null;
          if (alreadyTerminal) Runtime.trap("Lock-In already finalized today");
          // Both missed variants require obstacle linkage for analytics
          switch (request.obstacleTemplateId) {
            case null Runtime.trap("Missed Lock-In requires an obstacle template for analytics");
            case (?_) {};
          };
        };
        case (#skip) {
          switch (request.obstacleTemplateId) {
            case null Runtime.trap("Skip check-in requires an obstacle template");
            case (?_) {};
          };
          if (hasSameDayCheckIn(checkIns, request.goalId, caller, now, request.timezoneOffsetMinutes)) {
            Runtime.trap("Already checked in for this goal today");
          };
        };
      };
    } else {
      // Regular goal: strict one-per-day
      if (hasSameDayCheckIn(checkIns, request.goalId, caller, now, request.timezoneOffsetMinutes)) {
        Runtime.trap("Already checked in for this goal today");
      };
      // Skip requires obstacle linkage
      switch (request.checkInType) {
        case (#skip) {
          switch (request.obstacleTemplateId) {
            case null Runtime.trap("Skip check-in requires an obstacle template");
            case (?_) {};
          };
        };
        case (#success or #inProgress or #missedCheckIn or #missedCheckOut) {};
      };
    };
    // Validate customObstacleNote length
    switch (request.customObstacleNote) {
      case (?note) {
        if (note.size() > 140) Runtime.trap("customObstacleNote exceeds 140 characters");
      };
      case null {};
    };
    let checkIn : CheckInTypes.CheckIn = {
      id = nextId;
      goalId = request.goalId;
      owner = caller;
      checkInType = request.checkInType;
      obstacleTemplateId = request.obstacleTemplateId;
      timestamp = now;
      lockInStartedAt = request.lockInStartedAt;
      lockInEndedAt = request.lockInEndedAt;
      executedIfThen = request.executedIfThen;
      customObstacleNote = request.customObstacleNote;
    };
    checkIns.add(checkIn);
    checkIn;
  };

  public func listCheckIns(
    checkIns : List.List<CheckInTypes.CheckIn>,
    caller : Common.UserId,
  ) : [CheckInTypes.CheckIn] {
    checkIns.values().filter(func(c) { c.owner == caller }).toArray();
  };

  public func getCheckInsForGoal(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goalId : Common.GoalId,
    caller : Common.UserId,
  ) : [CheckInTypes.CheckIn] {
    checkIns.values().filter(func(c) { c.goalId == goalId and c.owner == caller }).toArray();
  };

  public func deleteCheckIn(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goals : List.List<GoalTypes.Goal>,
    checkInId : Common.CheckInId,
    caller : Common.UserId,
  ) : { #ok; #err : { #notFound; #unauthorized; #sealed : Text } } {
    switch (checkIns.find(func(c) { c.id == checkInId })) {
      case null #err(#notFound);
      case (?c) {
        if (c.owner != caller) return #err(#unauthorized);
        // All terminal Lock-In states are permanently sealed — no undo.
        // Covers: #success, #missedCheckIn, #missedCheckOut
        let isTerminalLockIn = c.checkInType == #success or
          c.checkInType == #missedCheckIn or
          c.checkInType == #missedCheckOut;
        if (isTerminalLockIn) {
          switch (goals.find(func(g) { g.id == c.goalId })) {
            case (?g) {
              if (g.isLockIn) return #err(#sealed("Sealed: Lock-In sessions cannot be undone."));
            };
            case null {};
          };
        };
        checkIns.retain(func(c) { c.id != checkInId });
        #ok;
      };
    };
  };

  public func getCheckInsForPeriod(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    fromTimestamp : Int,
    toTimestamp : Int,
  ) : [CheckInTypes.CheckIn] {
    checkIns.values().filter(func(c) {
      c.goalId == goalId and c.owner == caller and
      c.timestamp >= fromTimestamp and c.timestamp <= toTimestamp
    }).toArray();
  };

  // Returns all check-ins for a goal on or after fromTimestamp, sorted descending
  // (newest first). Designed for the 14-day Behavioral Timeline view.
  public func getCheckInsForGoalTimeline(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    fromTimestamp : Int,
  ) : [CheckInTypes.CheckIn] {
    let filtered = checkIns.values().filter(func(c) {
      c.goalId == goalId and c.owner == caller and c.timestamp >= fromTimestamp
    }).toArray();
    filtered.sort(func(a, b) { Int.compare(b.timestamp, a.timestamp) });
  };

  public func getCheckInsForPartners(
    checkIns : List.List<CheckInTypes.CheckIn>,
    partnerIds : [Common.UserId],
  ) : [CheckInTypes.CheckIn] {
    checkIns.values().filter(func(c) {
      partnerIds.find(func(p) { p == c.owner }) != null
    }).toArray();
  };
};
