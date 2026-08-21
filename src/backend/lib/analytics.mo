import List "mo:core/List";
import Array "mo:core/Array";
import Set "mo:core/Set";
import Int "mo:core/Int";
import Common "../types/common";
import AnalyticsTypes "../types/analytics";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import GoalLib "./goals";

module {
  let DAY_NS : Int = 86_400_000_000_000;

  func _sameDay(a : Common.Timestamp, b : Common.Timestamp) : Bool {
    (a / DAY_NS) == (b / DAY_NS);
  };

  func dayIndex(ts : Common.Timestamp, now : Common.Timestamp) : Int {
    (now / DAY_NS) - (ts / DAY_NS);
  };

  /// Weekday index in the app's scheduledDays convention: 0 = Monday …
  /// 6 = Sunday, computed in the user's timezone.
  func weekdayIndex(ts : Common.Timestamp, timezoneOffsetMinutes : Int) : Nat {
    let offsetNs = timezoneOffsetMinutes * 60 * 1_000_000_000;
    let localNs = ts + offsetNs;
    let daysSinceEpoch = localNs / DAY_NS;
    // Epoch day 0 (1970-01-01) was a Thursday = weekday index 4 (0=Sun).
    let raw = Int.rem(4 + daysSinceEpoch, 7);
    let sundayFirst = if (raw < 0) { raw + 7 } else { raw };
    // Convert 0=Sun … 6=Sat to 0=Mon … 6=Sun.
    let mondayFirst = Int.rem(sundayFirst + 6, 7);
    mondayFirst.toNat();
  };

  func weekdayAbbr(idx : Nat) : Text {
    switch (idx) {
      case 0 "mon";
      case 1 "tue";
      case 2 "wed";
      case 3 "thu";
      case 4 "fri";
      case 5 "sat";
      case 6 "sun";
      case _ "mon"; // unreachable
    };
  };

  func isScheduledDay(dayAbbr : Text, scheduledDays : [Text]) : Bool {
    scheduledDays.find(func(d) { d == dayAbbr }) != null;
  };

  /// Counts the distinct scheduled days (per `scheduledDays`) that have
  /// elapsed between `createdAt` and `now`, in the user's timezone.
  func countScheduledDaysInWindow(
    createdAt : Common.Timestamp,
    now : Common.Timestamp,
    scheduledDays : [Text],
    timezoneOffsetMinutes : Int,
  ) : Nat {
    let offsetNs = timezoneOffsetMinutes * 60 * 1_000_000_000;
    let startDay = (createdAt + offsetNs) / DAY_NS;
    let endDay = (now + offsetNs) / DAY_NS;
    var count : Nat = 0;
    var d = startDay;
    while (d <= endDay) {
      let wd = weekdayIndex(d * DAY_NS - offsetNs, timezoneOffsetMinutes);
      if (isScheduledDay(weekdayAbbr(wd), scheduledDays)) count += 1;
      d += 1;
    };
    count;
  };

  /// Returns the most frequently occurring obstacle id in `ids`, or null when
  /// the list is empty. Ties resolve to the first encountered maximum.
  func mostFrequentObstacle(ids : [Common.ObstacleTemplateId]) : ?Common.ObstacleTemplateId {
    var bestId : ?Common.ObstacleTemplateId = null;
    var bestCount : Nat = 0;
    for (a in ids.values()) {
      var count : Nat = 0;
      for (b in ids.values()) {
        if (a == b) count += 1;
      };
      if (count > bestCount) {
        bestCount := count;
        bestId := ?a;
      };
    };
    bestId;
  };

  func resolveObstacle(
    id : Common.ObstacleTemplateId,
    obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
  ) : ?AnalyticsTypes.ObstacleStat {
    switch (obstacleTemplates.find(func(t) { t.id == id })) {
      case null null;
      case (?t) ?{ id = t.id; title = t.title };
    };
  };

  /// The obstacle the user anticipated most across their habits (the
  /// obstacleTemplateId set at creation on the most habits).
  func computePlannedObstacle(
    habits : [GoalTypes.Goal],
    obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
  ) : ?AnalyticsTypes.ObstacleStat {
    let ids = habits.values()
      .filter(func(h) { h.obstacleTemplateId != null })
      .map(func(h) { switch (h.obstacleTemplateId) { case null 0; case (?id) id } })
      .toArray();
    switch (mostFrequentObstacle(ids)) {
      case null null;
      case (?id) resolveObstacle(id, obstacleTemplates);
    };
  };

  /// The obstacle actually logged most often across the user's skip check-ins.
  func computeActualObstacle(
    checkIns : [CheckInTypes.CheckIn],
    obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
  ) : ?AnalyticsTypes.ObstacleStat {
    let ids = checkIns.values()
      .filter(func(c) { c.checkInType == #skip and c.obstacleTemplateId != null })
      .map(func(c) { switch (c.obstacleTemplateId) { case null 0; case (?id) id } })
      .toArray();
    switch (mostFrequentObstacle(ids)) {
      case null null;
      case (?id) resolveObstacle(id, obstacleTemplates);
    };
  };

  /// Per-category rollup over the user's habits and their check-ins.
  func computeCategoryStats(
    habits : [GoalTypes.Goal],
    checkIns : [CheckInTypes.CheckIn],
  ) : [AnalyticsTypes.CategoryStat] {
    var cats : [GoalTypes.GoalCategory] = [];
    for (h in habits.values()) {
      if (cats.find(func(c) { c == h.category }) == null) {
        cats := cats.concat([h.category]);
      };
    };
    cats.map(func(cat) {
      var totalSuccesses : Nat = 0;
      var totalSkips : Nat = 0;
      var activeHabits : Nat = 0;
      for (h in habits.values()) {
        if (h.category == cat) {
          if (h.state == #active) activeHabits += 1;
          for (c in checkIns.values()) {
            if (c.goalId == h.id) {
              switch (c.checkInType) {
                case (#success) totalSuccesses += 1;
                case (#skip) totalSkips += 1;
                case _ {};
              };
            };
          };
        };
      };
      let total = totalSuccesses + totalSkips;
      let completionRate = if (total == 0) 0.0 else totalSuccesses.toFloat() / total.toFloat();
      { category = cat; totalSuccesses; totalSkips; completionRate; activeHabits };
    });
  };

  public func computeGoalAnalytics(
    goal : GoalTypes.HabitPublic,
    checkIns : [CheckInTypes.CheckIn],
    now : Common.Timestamp,
    timezoneOffsetMinutes : Int,
  ) : AnalyticsTypes.GoalAnalytics {
    var totalSuccesses : Nat = 0;
    var totalSkips : Nat = 0;

    for (c in checkIns.values()) {
      switch (c.checkInType) {
        case (#success) totalSuccesses += 1;
        case (#skip) totalSkips += 1;
        case (#inProgress or #missedCheckIn or #missedCheckOut) {}; // Lock-In intermediate/failed states: not counted
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

    // "Shows up" progress: distinct local days with a #success.
    let offsetNs = timezoneOffsetMinutes * 60 * 1_000_000_000;
    let shownUpDays = Set.empty<Int>();
    for (c in checkIns.values()) {
      if (c.checkInType == #success) {
        shownUpDays.add((c.timestamp + offsetNs) / DAY_NS);
      };
    };
    let daysShownUp = shownUpDays.size();
    let daysInWindow = countScheduledDaysInWindow(goal.createdAt, now, goal.scheduledDays, timezoneOffsetMinutes);

    {
      goalId = goal.id;
      goalName = goal.wish;
      currentStreak;
      longestStreak;
      totalSuccesses;
      totalSkips;
      totalMissed = 0; // missed tracking beyond scope for now
      completionRate;
      daysShownUp;
      daysInWindow;
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
    obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
    caller : Common.UserId,
    now : Common.Timestamp,
    timezoneOffsetMinutes : Int,
  ) : AnalyticsTypes.AnalyticsSummary {
    // Analytics are per-habit (check-ins are recorded against habits, not
    // macro goals). Filter to habits only (goalId set).
    let ownedHabits = goals.values().filter(func(g) {
      g.owner == caller and g.goalId != null
    }).toArray();
    let goalIds = ownedHabits.map(func(g) { g.id });
    let allCheckIns = checkIns.values().filter(func(c) { c.owner == caller }).toArray();

    let goalAnalytics = ownedHabits.map(func(g) {
      let gPublic = GoalLib.toHabitPublic(g);
      let goalCheckIns = allCheckIns.filter(func(c) { c.goalId == g.id });
      computeGoalAnalytics(gPublic, goalCheckIns, now, timezoneOffsetMinutes);
    });

    let daily = computeDailySuccessRate30Days(allCheckIns, goalIds, now);

    // ── 1. IF-THEN effectiveness ────────────────────────────────────────────
    // Only over check-ins the user actually recorded as #success or #skip.
    var withPlanSuccess : Nat = 0;
    var withPlanTotal : Nat = 0;
    var withoutPlanSuccess : Nat = 0;
    var withoutPlanTotal : Nat = 0;
    for (c in allCheckIns.values()) {
      if (c.checkInType == #success or c.checkInType == #skip) {
        if (c.executedIfThen) {
          withPlanTotal += 1;
          if (c.checkInType == #success) withPlanSuccess += 1;
        } else {
          withoutPlanTotal += 1;
          if (c.checkInType == #success) withoutPlanSuccess += 1;
        };
      };
    };
    let successRateWithPlan = if (withPlanTotal == 0) 0.0 else withPlanSuccess.toFloat() / withPlanTotal.toFloat();
    let successRateWithoutPlan = if (withoutPlanTotal == 0) 0.0 else withoutPlanSuccess.toFloat() / withoutPlanTotal.toFloat();

    // ── 2. Day-of-week pattern ──────────────────────────────────────────────
    let weekdaySuccess = [var 0, 0, 0, 0, 0, 0, 0];
    let weekdayTotal = [var 0, 0, 0, 0, 0, 0, 0];
    for (c in allCheckIns.values()) {
      if (c.checkInType == #success or c.checkInType == #skip) {
        let wd = weekdayIndex(c.timestamp, timezoneOffsetMinutes);
        weekdayTotal[wd] += 1;
        if (c.checkInType == #success) weekdaySuccess[wd] += 1;
      };
    };
    let successRateByWeekday = Array.tabulate(7, func(i) {
      if (weekdayTotal[i] == 0) 0.0 else weekdaySuccess[i].toFloat() / weekdayTotal[i].toFloat();
    });

    // ── 3. Per-category rollup ──────────────────────────────────────────────
    let categoryStats = computeCategoryStats(ownedHabits, allCheckIns);

    // ── 4. Planned vs actual obstacle ───────────────────────────────────────
    let plannedObstacle = computePlannedObstacle(ownedHabits, obstacleTemplates);
    let actualObstacle = computeActualObstacle(allCheckIns, obstacleTemplates);
    let plannedMatchesActual = switch (plannedObstacle, actualObstacle) {
      case (?p, ?a) p.id == a.id;
      case _ false;
    };

    // ── 5. "Shows up" progress count (overall) ──────────────────────────────
    let offsetNs = timezoneOffsetMinutes * 60 * 1_000_000_000;
    let shownUpDays = Set.empty<Int>();
    for (c in allCheckIns.values()) {
      if (c.checkInType == #success) {
        shownUpDays.add((c.timestamp + offsetNs) / DAY_NS);
      };
    };
    let daysShownUp = shownUpDays.size();
    var daysInWindow : Nat = 0;
    for (g in ownedHabits.values()) {
      let gPublic = GoalLib.toHabitPublic(g);
      daysInWindow += countScheduledDaysInWindow(gPublic.createdAt, now, gPublic.scheduledDays, timezoneOffsetMinutes);
    };

    {
      goals = goalAnalytics;
      dailySuccessRate30Days = daily;
      successRateWithPlan;
      successRateWithoutPlan;
      checkInsWithPlan = withPlanTotal;
      checkInsWithoutPlan = withoutPlanTotal;
      successRateByWeekday;
      categoryStats;
      plannedObstacle;
      actualObstacle;
      plannedMatchesActual;
      daysShownUp;
      daysInWindow;
    };
  };
};
