import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import Int "mo:core/Int";
import Debug "mo:core/Debug";

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
    let checkIn : CheckInTypes.CheckIn = {
      id = nextId;
      goalId = request.goalId;
      owner = caller;
      checkInType = request.checkInType;
      obstacleTemplateId = request.obstacleTemplateId;
      customObstacleNote = request.customObstacleNote;
      timestamp = now;
      lockInStartedAt = request.lockInStartedAt;
      lockInEndedAt = request.lockInEndedAt;
      executedIfThen = request.executedIfThen;
    };
    checkIns.add(checkIn);
    checkIn;
  };

  /// Returns true if the given day-of-week abbreviation ("mon".."sun") is in scheduledDays.
  func isScheduledDay(dayAbbr : Text, scheduledDays : [Text]) : Bool {
    scheduledDays.find(func(d) { d == dayAbbr }) != null;
  };

  /// Derives the day-of-week abbreviation ("mon".."sun") from a nanosecond timestamp,
  /// adjusted for the user's timezone offset in minutes.
  /// Unix epoch (1970-01-01) was a Thursday, so epoch day 0 = Thursday (index 3).
  /// Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  func dayOfWeekAbbr(timestampNs : Int, timezoneOffsetMinutes : Int) : Text {
    // Shift the timestamp into local time, then compute the day index
    let localNs : Int = timestampNs + (timezoneOffsetMinutes * 60 * 1_000_000_000);
    // Days since epoch (truncate toward zero for both positive and negative)
    let daysSinceEpoch : Int = localNs / DAY_NS;
    // Epoch day 0 (1970-01-01) was a Thursday = weekday index 4 (0=Sun)
    // dayOfWeek: (4 + daysSinceEpoch) mod 7, always positive
    let raw : Int = Int.rem(4 + daysSinceEpoch, 7);
    let idx : Int = if (raw < 0) { raw + 7 } else { raw };
    switch (idx) {
      case 0 "sun";
      case 1 "mon";
      case 2 "tue";
      case 3 "wed";
      case 4 "thu";
      case 5 "fri";
      case 6 "sat";
      case _ "mon"; // unreachable
    };
  };

  /// Midnight auto-fail: generate a #Missed check-in for every active goal that
  /// had no terminal check-in yesterday — but only if yesterday was a scheduled day.
  /// If yesterday was NOT in goal.scheduledDays (rest day), skip silently.
  public func autoFailMissedGoals(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goals : List.List<GoalTypes.Goal>,
    nextCheckInId : [var Nat],
    nowNs : Int,
    timezoneOffsetMinutes : Int,
  ) : Nat {
    let offsetNs : Int = timezoneOffsetMinutes * 60 * 1_000_000_000;
    // Local "now" and "yesterday" day boundaries
    let localNowNs : Int = nowNs + offsetNs;
    let localYesterdayNs : Int = localNowNs - DAY_NS;
    // Yesterday's start/end in UTC (for querying check-ins stored in UTC)
    let localMidnightNs : Int = (localNowNs / DAY_NS) * DAY_NS;
    let yesterdayStartUtc : Int = localMidnightNs - DAY_NS - offsetNs;
    let yesterdayEndUtc : Int = localMidnightNs - offsetNs;
    // Day-of-week abbreviation for yesterday in user's local timezone
    // Pass 0 for tzOffset since localYesterdayNs is already in local time
    let yesterdayAbbr : Text = dayOfWeekAbbr(localYesterdayNs, 0);
    var count : Nat = 0;
    label goalLoop for (goal in goals.values()) {
      if (goal.state != #active) continue goalLoop;
      // Skip if yesterday was not a scheduled day (rest day)
      if (not isScheduledDay(yesterdayAbbr, goal.scheduledDays)) continue goalLoop;
      // Skip Lock-In goals — they handle their own missed states via frontend + checkin flow
      if (goal.isLockIn) continue goalLoop;
      // Check if there is any terminal check-in for this goal yesterday (UTC window)
      let hadTerminal = checkIns.find(func(c) {
        c.goalId == goal.id and
        c.owner == goal.owner and
        c.timestamp >= yesterdayStartUtc and
        c.timestamp < yesterdayEndUtc and
        (c.checkInType == #success or c.checkInType == #skip or
         c.checkInType == #missedCheckIn or c.checkInType == #missedCheckOut)
      }) != null;
      if (not hadTerminal) {
        let missedCheckIn : CheckInTypes.CheckIn = {
          id = nextCheckInId[0];
          goalId = goal.id;
          owner = goal.owner;
          checkInType = #skip; // auto-missed recorded as skip for analytics consistency
          obstacleTemplateId = null;
          customObstacleNote = null;
          timestamp = yesterdayEndUtc - 1; // one ns before midnight
          lockInStartedAt = null;
          lockInEndedAt = null;
          executedIfThen = false;
        };
        checkIns.add(missedCheckIn);
        nextCheckInId[0] += 1;
        count += 1;
      };
    };
    count;
  };

  /// Public wrapper for isScheduledDay — used by email-notifications-api.
  public func isScheduledDayPublic(dayAbbr : Text, scheduledDays : [Text]) : Bool {
    isScheduledDay(dayAbbr, scheduledDays);
  };

  /// Public wrapper for dayOfWeekAbbr — used by email-notifications-api.
  public func dayOfWeekAbbrPublic(timestampNs : Int, timezoneOffsetMinutes : Int) : Text {
    dayOfWeekAbbr(timestampNs, timezoneOffsetMinutes);
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
