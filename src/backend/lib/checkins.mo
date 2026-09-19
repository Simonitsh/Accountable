import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Common "../types/common";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import AuthTypes "../types/auth";
import Int "mo:core/Int";
import DateUtils "./date-utils";

module {
  public func hasSameDayCheckIn(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goalId : Common.GoalId,
    caller : Common.UserId,
    now : Common.Timestamp,
    timezoneOffsetMinutes : Int,
  ) : Bool {
    switch (checkIns.find(func(c) {
      c.goalId == goalId and c.owner == caller and DateUtils.sameDay(c.timestamp, now, timezoneOffsetMinutes)
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
            DateUtils.sameDay(c.timestamp, now, request.timezoneOffsetMinutes) and c.checkInType == #inProgress
          }) != null;
          if (alreadyStarted) Runtime.trap("Lock-In already started today");
        };
        case (#success) {
          let alreadyDone = checkIns.find(func(c) {
            c.goalId == request.goalId and c.owner == caller and
            DateUtils.sameDay(c.timestamp, now, request.timezoneOffsetMinutes) and c.checkInType == #success
          }) != null;
          if (alreadyDone) Runtime.trap("Lock-In already completed today");
        };
        case (#missedCheckIn or #missedCheckOut) {
          // Block if any terminal record already exists today
          let alreadyTerminal = checkIns.find(func(c) {
            c.goalId == request.goalId and c.owner == caller and
            DateUtils.sameDay(c.timestamp, now, request.timezoneOffsetMinutes) and
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
        case (#missed) {
          // #missed is written only by the overnight auto-fail process; a user
          // cannot record a forgotten day by hand.
          Runtime.trap("Missed status is recorded automatically, not by the user");
        };
      };
    } else {
      // Regular goal: strict one-per-day
      if (hasSameDayCheckIn(checkIns, request.goalId, caller, now, request.timezoneOffsetMinutes)) {
        Runtime.trap("Already checked in for this goal today");
      };
      switch (request.checkInType) {
        case (#skip) {
          // A deliberate skip always carries an obstacle.
          switch (request.obstacleTemplateId) {
            case null Runtime.trap("Skip check-in requires an obstacle template");
            case (?_) {};
          };
        };
        case (#missed) {
          // #missed is written only by the overnight auto-fail process; a user
          // cannot record a forgotten day by hand.
          Runtime.trap("Missed status is recorded automatically, not by the user");
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
      timestamp = now;
      lockInStartedAt = request.lockInStartedAt;
      lockInEndedAt = request.lockInEndedAt;
      executedIfThen = request.executedIfThen;
      followUpDeclined = false;
      note = request.note;
    };
    checkIns.add(checkIn);
    checkIn;
  };

  /// Midnight auto-fail: generate a #missed check-in for every active goal that
  /// had no terminal check-in yesterday — but only if yesterday was a scheduled day.
  /// If yesterday was NOT in goal.scheduledDays (rest day), skip silently.
  /// Each goal's "yesterday" boundary is computed in its OWNER's timezone, looked
  /// up from the profiles map (falling back to UTC offset 0 when no profile exists).
  ///
  /// A #missed record is a forgotten day — distinct from a deliberate #skip,
  /// which always carries an obstacle. #missed is terminal, so a day already
  /// closed out is never re-recorded on a later night.
  public func autoFailMissedGoals(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goals : List.List<GoalTypes.Goal>,
    nextCheckInId : [var Nat],
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    nowNs : Int,
  ) : Nat {
    var count : Nat = 0;
    label goalLoop for (goal in goals.values()) {
      if (goal.state != #active) continue goalLoop;
      // Skip Lock-In goals — they handle their own missed states via frontend + checkin flow
      if (goal.isLockIn) continue goalLoop;
      // Resolve this goal's owner timezone offset (fall back to UTC when no profile).
      let timezoneOffsetMinutes : Int = switch (profiles.get(goal.owner)) {
        case (?profile) profile.timezoneOffsetMinutes;
        case null 0;
      };
      let offsetNs : Int = timezoneOffsetMinutes * 60 * 1_000_000_000;
      // Local "now" and "yesterday" day boundaries
      let localNowNs : Int = nowNs + offsetNs;
      let localYesterdayNs : Int = localNowNs - DateUtils.DAY_NS;
      // Yesterday's start/end in UTC (for querying check-ins stored in UTC)
      let localMidnightNs : Int = (localNowNs / DateUtils.DAY_NS) * DateUtils.DAY_NS;
      let yesterdayStartUtc : Int = localMidnightNs - DateUtils.DAY_NS - offsetNs;
      let yesterdayEndUtc : Int = localMidnightNs - offsetNs;
      // Day-of-week abbreviation for yesterday in user's local timezone
      // Pass 0 for tzOffset since localYesterdayNs is already in local time
      let yesterdayAbbr : Text = DateUtils.dayOfWeekAbbr(localYesterdayNs, 0);
      // Skip if yesterday was not a scheduled day (rest day)
      if (not DateUtils.isScheduledDay(yesterdayAbbr, goal.scheduledDays)) continue goalLoop;
      // Check if there is any terminal check-in for this goal yesterday (UTC window).
      // #missed is terminal too, so an already-closed-out day is never re-recorded.
      let hadTerminal = checkIns.find(func(c) {
        c.goalId == goal.id and
        c.owner == goal.owner and
        c.timestamp >= yesterdayStartUtc and
        c.timestamp < yesterdayEndUtc and
        (c.checkInType == #success or c.checkInType == #skip or c.checkInType == #missed or
         c.checkInType == #missedCheckIn or c.checkInType == #missedCheckOut)
      }) != null;
      if (not hadTerminal) {
        let missedCheckIn : CheckInTypes.CheckIn = {
          id = nextCheckInId[0];
          goalId = goal.id;
          owner = goal.owner;
          checkInType = #missed; // a scheduled day that passed with no interaction
          obstacleTemplateId = null; // a missed day never carries an obstacle
          timestamp = yesterdayEndUtc - 1; // one ns before midnight
          lockInStartedAt = null;
          lockInEndedAt = null;
          executedIfThen = false;
          followUpDeclined = false;
          note = null;
        };
        checkIns.add(missedCheckIn);
        nextCheckInId[0] += 1;
        count += 1;
      };
    };
    count;
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

  public func markCheckInIfThenUsed(
    checkIns : List.List<CheckInTypes.CheckIn>,
    checkInId : Common.CheckInId,
    caller : Common.UserId,
  ) : { #ok; #err : { #notFound; #unauthorized } } {
    switch (checkIns.find(func(c) { c.id == checkInId })) {
      case null #err(#notFound);
      case (?c) {
        if (c.owner != caller) return #err(#unauthorized);
        // Idempotent: already tagged is a normal no-op success.
        if (not c.executedIfThen) {
          checkIns.mapInPlace(func(c) {
            if (c.id == checkInId) {
              // Answering "used my plan" supersedes a prior decline — the two
              // facts are mutually exclusive.
              { c with executedIfThen = true; followUpDeclined = false };
            } else { c };
          });
        };
        #ok;
      };
    };
  };

  /// Records that the follow-up question was asked and the user declined to
  /// answer. Idempotent and ownership-checked, mirroring markCheckInIfThenUsed.
  /// Declining never sets executedIfThen, so a declined check-in stays on the
  /// did-not-use side of the effectiveness split.
  public func markCheckInFollowUpDeclined(
    checkIns : List.List<CheckInTypes.CheckIn>,
    checkInId : Common.CheckInId,
    caller : Common.UserId,
  ) : { #ok; #err : { #notFound; #unauthorized } } {
    switch (checkIns.find(func(c) { c.id == checkInId })) {
      case null #err(#notFound);
      case (?c) {
        if (c.owner != caller) return #err(#unauthorized);
        // Idempotent: already declined is a normal no-op success.
        if (not c.followUpDeclined) {
          checkIns.mapInPlace(func(c) {
            if (c.id == checkInId) {
              // Declining supersedes a prior "used my plan" answer.
              { c with followUpDeclined = true; executedIfThen = false };
            } else { c };
          });
        };
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
