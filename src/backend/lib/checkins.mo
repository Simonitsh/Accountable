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

  func sameDay(a : Common.Timestamp, b : Common.Timestamp) : Bool {
    (a / DAY_NS) == (b / DAY_NS);
  };

  public func hasSameDayCheckIn(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    now : Common.Timestamp,
  ) : Bool {
    switch (checkIns.find(func(c) {
      c.goalId == goalId and c.owner == caller and sameDay(c.timestamp, now)
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
    // One-per-day rule:
    // For Lock-In goals: allow #inProgress AND #success (check-in + check-out) on the same day.
    //   - Block a second #inProgress if one already exists today.
    //   - Block #success if a #success already exists today (already checked out).
    //   - Block #failedLockIn if any terminal record already exists today.
    // For regular goals: block any duplicate on the same day.
    if (goal.isLockIn) {
      switch (request.checkInType) {
        case (#inProgress) {
          // Block if already have an #inProgress today
          let alreadyStarted = checkIns.find(func(c) {
            c.goalId == request.goalId and c.owner == caller and
            sameDay(c.timestamp, now) and c.checkInType == #inProgress
          }) != null;
          if (alreadyStarted) Runtime.trap("Lock-In already started today");
        };
        case (#success) {
          // Block if already checked out today
          let alreadyDone = checkIns.find(func(c) {
            c.goalId == request.goalId and c.owner == caller and
            sameDay(c.timestamp, now) and c.checkInType == #success
          }) != null;
          if (alreadyDone) Runtime.trap("Lock-In already completed today");
        };
        case (#failedLockIn) {
          // Block if any terminal record already exists today
          let alreadyTerminal = checkIns.find(func(c) {
            c.goalId == request.goalId and c.owner == caller and
            sameDay(c.timestamp, now) and
            (c.checkInType == #success or c.checkInType == #failedLockIn)
          }) != null;
          if (alreadyTerminal) Runtime.trap("Lock-In already finalized today");
          // #failedLockIn requires obstacle linkage for analytics
          switch (request.obstacleTemplateId) {
            case null Runtime.trap("Failed Lock-In requires an obstacle template for analytics");
            case (?_) {};
          };
        };
        case (#skip) {
          // Skip on a Lock-In goal is treated like a regular skip — requires obstacle
          switch (request.obstacleTemplateId) {
            case null Runtime.trap("Skip check-in requires an obstacle template");
            case (?_) {};
          };
          if (hasSameDayCheckIn(checkIns, request.goalId, caller, now)) {
            Runtime.trap("Already checked in for this goal today");
          };
        };
      };
    } else {
      // Regular goal: strict one-per-day
      if (hasSameDayCheckIn(checkIns, request.goalId, caller, now)) {
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
        case (#success or #inProgress or #failedLockIn) {};
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
    checkInId : Common.CheckInId,
    caller : Common.UserId,
  ) : { #ok; #err : { #notFound; #unauthorized } } {
    switch (checkIns.find(func(c) { c.id == checkInId })) {
      case null #err(#notFound);
      case (?c) {
        if (c.owner != caller) return #err(#unauthorized);
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
