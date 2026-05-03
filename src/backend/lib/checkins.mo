import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";

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
    // Verify ownership
    switch (goals.find(func(g) { g.id == request.goalId and g.owner == caller })) {
      case null Runtime.trap("Goal not found or not owned by caller");
      case (?g) {
        if (g.state != #active) Runtime.trap("Goal is not active");
      };
    };
    let now = Time.now();
    // Enforce one check-in per goal per day
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
      case (#success) {};
    };
    let checkIn : CheckInTypes.CheckIn = {
      id = nextId;
      goalId = request.goalId;
      owner = caller;
      checkInType = request.checkInType;
      obstacleTemplateId = request.obstacleTemplateId;
      timestamp = now;
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

  public func getCheckInsForPartners(
    checkIns : List.List<CheckInTypes.CheckIn>,
    partnerIds : [Common.UserId],
  ) : [CheckInTypes.CheckIn] {
    checkIns.values().filter(func(c) {
      partnerIds.find(func(p) { p == c.owner }) != null
    }).toArray();
  };
};
