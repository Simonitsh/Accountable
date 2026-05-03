import List "mo:core/List";
import Array "mo:core/Array";
import Common "../types/common";
import AnalyticsTypes "../types/analytics";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";

module {
  let DAY_NS : Int = 86_400_000_000_000;

  func _sameDay(a : Common.Timestamp, b : Common.Timestamp) : Bool {
    (a / DAY_NS) == (b / DAY_NS);
  };

  func dayIndex(ts : Common.Timestamp, now : Common.Timestamp) : Int {
    (now / DAY_NS) - (ts / DAY_NS);
  };

  public func computeGoalAnalytics(
    goal : GoalTypes.GoalPublic,
    checkIns : [CheckInTypes.CheckIn],
    now : Common.Timestamp,
  ) : AnalyticsTypes.GoalAnalytics {
    var totalSuccesses : Nat = 0;
    var totalSkips : Nat = 0;

    for (c in checkIns.values()) {
      switch (c.checkInType) {
        case (#success) totalSuccesses += 1;
        case (#skip) totalSkips += 1;
      };
    };

    // Compute current streak: consecutive days ending today or yesterday with a success
    // Sort check-ins by timestamp descending to compute streak
    let sorted = checkIns.sort(func(a, b) {
      if (a.timestamp > b.timestamp) #less
      else if (a.timestamp < b.timestamp) #greater
      else #equal
    });

    var currentStreak : Nat = 0;
    var longestStreak : Nat = 0;
    var tempStreak : Nat = 0;
    var lastDayIdx : ?Int = null;

    // Walk sorted (newest first) to build current streak
    label streakLoop for (c in sorted.values()) {
      if (c.checkInType != #success) {
        // Skip-type breaks the current streak
        switch (lastDayIdx) {
          case null {};
          case (?_) break streakLoop;
        };
      } else {
        let dIdx = dayIndex(c.timestamp, now);
        switch (lastDayIdx) {
          case null {
            // First entry: valid only if today (0) or yesterday (1)
            if (dIdx <= 1) {
              currentStreak := 1;
              lastDayIdx := ?dIdx;
            } else {
              break streakLoop;
            };
          };
          case (?prev) {
            if (dIdx == prev + 1) {
              currentStreak += 1;
              lastDayIdx := ?dIdx;
            } else {
              break streakLoop;
            };
          };
        };
      };
    };

    // Compute longest streak (forward pass)
    var prevDayIdx2 : ?Int = null;
    for (c in checkIns.values()) {
      if (c.checkInType == #success) {
        let dIdx = dayIndex(c.timestamp, now);
        switch (prevDayIdx2) {
          case null {
            tempStreak := 1;
            prevDayIdx2 := ?dIdx;
          };
          case (?prev) {
            if (dIdx == prev - 1) {
              tempStreak += 1;
            } else {
              tempStreak := 1;
            };
            prevDayIdx2 := ?dIdx;
          };
        };
        if (tempStreak > longestStreak) longestStreak := tempStreak;
      };
    };
    if (currentStreak > longestStreak) longestStreak := currentStreak;

    let total = totalSuccesses + totalSkips;
    let completionRate : Float = if (total == 0) 0.0 else totalSuccesses.toFloat() / total.toFloat();

    {
      goalId = goal.id;
      goalName = goal.wish;
      currentStreak;
      longestStreak;
      totalSuccesses;
      totalSkips;
      totalMissed = 0; // missed tracking beyond scope for now
      completionRate;
    };
  };

  public func computeDailySuccessRate30Days(
    checkIns : [CheckInTypes.CheckIn],
    goalIds : [Common.GoalId],
    now : Common.Timestamp,
  ) : [Float] {
    // For each of the last 30 days, compute success rate across all goals
    let result = Array.tabulate(30, func(i) {
      let targetDayOffset = i; // i=0 is today, i=29 is 29 days ago
      let dayStart = (now / DAY_NS - targetDayOffset.toInt()) * DAY_NS;
      let dayEnd = dayStart + DAY_NS;

      var successes : Nat = 0;
      var total : Nat = 0;

      for (c in checkIns.values()) {
        if (
          c.timestamp >= dayStart and
          c.timestamp < dayEnd and
          goalIds.find(func(id) { id == c.goalId }) != null
        ) {
          total += 1;
          if (c.checkInType == #success) successes += 1;
        };
      };

      if (total == 0) 0.0 else successes.toFloat() / total.toFloat();
    });
    result;
  };

  public func getAnalytics(
    goals : List.List<GoalTypes.Goal>,
    checkIns : List.List<CheckInTypes.CheckIn>,
    caller : Common.UserId,
    now : Common.Timestamp,
  ) : AnalyticsTypes.AnalyticsSummary {
    let ownedGoals = goals.values().filter(func(g) { g.owner == caller }).toArray();
    let goalIds = ownedGoals.map(func(g) { g.id });
    let allCheckIns = checkIns.values().filter(func(c) { c.owner == caller }).toArray();

    let goalAnalytics = ownedGoals.map(func(g) {
      let gPublic : GoalTypes.GoalPublic = {
        id = g.id;
        owner = g.owner;
        wish = g.wish;
        wishDescription = g.wishDescription;
        outcome = g.outcome;
        obstacleTemplateId = g.obstacleTemplateId;
        ifThenPlan = g.ifThenPlan;
        state = g.state;
        createdAt = g.createdAt;
        updatedAt = g.updatedAt;
        iconName = g.iconName;
        themeColor = g.themeColor;
      };
      let goalCheckIns = allCheckIns.filter(func(c) { c.goalId == g.id });
      computeGoalAnalytics(gPublic, goalCheckIns, now);
    });

    let daily = computeDailySuccessRate30Days(allCheckIns, goalIds, now);

    {
      goals = goalAnalytics;
      dailySuccessRate30Days = daily;
    };
  };
};
