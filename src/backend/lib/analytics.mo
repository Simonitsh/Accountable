import List "mo:core/List";
import Array "mo:core/Array";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Common "../types/common";
import AnalyticsTypes "../types/analytics";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import GoalLib "./goals";
import DateUtils "./date-utils";

module {
  /// Follow-through rate helper: successes / total, or 0.0 when total is 0.
  func rate(successes : Nat, total : Nat) : Float {
    if (total == 0) 0.0 else successes.toFloat() / total.toFloat();
  };

  func dayName(d : Nat) : Text {
    switch (d) {
      case 0 "Sunday";
      case 1 "Monday";
      case 2 "Tuesday";
      case 3 "Wednesday";
      case 4 "Thursday";
      case 5 "Friday";
      case 6 "Saturday";
      case _ "Unknown";
    };
  };

  /// Resolves an obstacle template id to its built-in title, or a fallback
  /// when the id does not match any of the seven built-ins.
  func obstacleName(id : Common.ObstacleTemplateId) : Text {
    switch (GoalTypes.builtinObstacles().find(func(t) { t.id == id })) {
      case null "Unknown obstacle";
      case (?t) t.title;
    };
  };

  /// If-then plan effectiveness: follow-through on days the plan was used
  /// (`executedIfThen = true`) versus days it was not.
  public func computeIfThenEffectiveness(
    checkIns : [CheckInTypes.CheckIn],
  ) : AnalyticsTypes.IfThenEffectiveness {
    var usedSuccess : Nat = 0;
    var usedTotal : Nat = 0;
    var notUsedSuccess : Nat = 0;
    var notUsedTotal : Nat = 0;
    for (c in checkIns.values()) {
      if (c.executedIfThen) {
        usedTotal += 1;
        if (c.checkInType == #success) usedSuccess += 1;
      } else {
        notUsedTotal += 1;
        if (c.checkInType == #success) notUsedSuccess += 1;
      };
    };
    {
      usedPlan = { successes = usedSuccess; total = usedTotal; rate = rate(usedSuccess, usedTotal) };
      notUsedPlan = { successes = notUsedSuccess; total = notUsedTotal; rate = rate(notUsedSuccess, notUsedTotal) };
    };
  };

  /// Follow-through per day of the week across the given check-ins, bucketed
  /// in the user's local time (timezoneOffsetMinutes).
  public func computeDayOfWeek(checkIns : [CheckInTypes.CheckIn], timezoneOffsetMinutes : Int) : [AnalyticsTypes.DayOfWeekStat] {
    var successes = [var 0, 0, 0, 0, 0, 0, 0];
    var totals = [var 0, 0, 0, 0, 0, 0, 0];
    for (c in checkIns.values()) {
      let d = DateUtils.dayOfWeek(c.timestamp, timezoneOffsetMinutes);
      totals[d] += 1;
      if (c.checkInType == #success) successes[d] += 1;
    };
    Array.tabulate(7, func(i) {
      {
        dayOfWeek = i;
        dayName = dayName(i);
        successes = successes[i];
        total = totals[i];
        rate = rate(successes[i], totals[i]);
      };
    });
  };

  /// Day-of-week index with the highest follow-through rate among days that
  /// have at least one check-in. null when no day has data.
  func bestDay(stats : [AnalyticsTypes.DayOfWeekStat]) : ?Nat {
    var best : ?Nat = null;
    var bestRate : Float = -1.0;
    for (s in stats.values()) {
      if (s.total > 0 and s.rate > bestRate) {
        bestRate := s.rate;
        best := ?s.dayOfWeek;
      };
    };
    best;
  };

  /// Day-of-week index with the lowest follow-through rate among days that
  /// have at least one check-in. null when no day has data.
  func worstDay(stats : [AnalyticsTypes.DayOfWeekStat]) : ?Nat {
    var worst : ?Nat = null;
    var worstRate : Float = 2.0;
    for (s in stats.values()) {
      if (s.total > 0 and s.rate < worstRate) {
        worstRate := s.rate;
        worst := ?s.dayOfWeek;
      };
    };
    worst;
  };

  /// Follow-through rolled up per category. Each habit's category comes from
  /// its existing `category` field; check-ins are attributed to a category via
  /// their habit's id.
  public func computeCategoryBreakdown(
    habits : [GoalTypes.Goal],
    checkIns : [CheckInTypes.CheckIn],
  ) : [AnalyticsTypes.CategoryStat] {
    let categories = [#Health, #Learning, #Social, #Productivity, #Leisure] : [GoalTypes.GoalCategory];
    categories.map(func(cat) {
      let catHabitIds = habits.filter(func(g) { g.category == cat }).map(func(g) { g.id });
      var successes : Nat = 0;
      var total : Nat = 0;
      for (c in checkIns.values()) {
        if (catHabitIds.find(func(id) { id == c.goalId }) != null) {
          total += 1;
          if (c.checkInType == #success) successes += 1;
        };
      };
      {
        category = cat;
        successes;
        total;
        rate = rate(successes, total);
      };
    });
  };

  /// Obstacles actually recorded on the given check-ins, counted by template
  /// id and sorted by frequency (most frequent first).
  func computeActualObstacles(
    checkIns : [CheckInTypes.CheckIn],
  ) : [AnalyticsTypes.ObstacleStat] {
    let counts = Map.empty<Common.ObstacleTemplateId, Nat>();
    for (c in checkIns.values()) {
      switch (c.obstacleTemplateId) {
        case null {};
        case (?id) {
          counts.add(id, (counts.get(id) ?? 0) + 1);
        };
      };
    };
    let stats = counts.entries().map(func((id, count)) {
      {
        obstacleTemplateId = ?id;
        obstacleName = obstacleName(id);
        count;
      };
    }).toArray();
    stats.sort(func(a, b) {
      if (a.count > b.count) #less
      else if (a.count < b.count) #greater
      else #equal
    });
  };

  /// Per-habit analytics for a single habit and its check-ins.
  public func computeHabitAnalytics(
    habit : GoalTypes.HabitPublic,
    checkIns : [CheckInTypes.CheckIn],
  ) : AnalyticsTypes.HabitAnalytics {
    // Shown-up days: count only genuine successes. Skips and auto-filled
    // forgotten days (recorded as skips by the auto-fail timer) are excluded.
    var shownUpDays : Nat = 0;
    for (c in checkIns.values()) {
      if (c.checkInType == #success) shownUpDays += 1;
    };

    let ifThen = computeIfThenEffectiveness(checkIns);

    let predictedObstacle = switch (habit.obstacleTemplateId) {
      case null null;
      case (?id) ?{
        obstacleTemplateId = ?id;
        obstacleName = obstacleName(id);
        count = 0;
      };
    };

    let actualObstacles = computeActualObstacles(checkIns);

    {
      habitId = habit.id;
      habitName = habit.wishDescription;
      category = habit.category;
      shownUpDays;
      ifThenEffectiveness = ifThen;
      predictedObstacle;
      actualObstacles;
    };
  };

  /// Computes the full Insights analytics summary for the caller. All values
  /// are derived on-the-fly from the caller's habits and check-ins — nothing
  /// is persisted, so no migration is required.
  public func getAnalytics(
    goals : List.List<GoalTypes.Goal>,
    checkIns : List.List<CheckInTypes.CheckIn>,
    caller : Common.UserId,
    timezoneOffsetMinutes : Int,
  ) : AnalyticsTypes.AnalyticsSummary {
    // Analytics are per-habit (check-ins are recorded against habits, not
    // macro goals). Filter to habits only (goalId set).
    let ownedHabits = goals.values().filter(func(g) {
      g.owner == caller and g.goalId != null
    }).toArray();
    let allCheckIns = checkIns.values().filter(func(c) { c.owner == caller }).toArray();

    let habitAnalytics = ownedHabits.map(func(g) {
      let gPublic = GoalLib.toHabitPublic(g);
      let goalCheckIns = allCheckIns.filter(func(c) { c.goalId == g.id });
      computeHabitAnalytics(gPublic, goalCheckIns);
    });

    let overallIfThen = computeIfThenEffectiveness(allCheckIns);
    let dayOfWeek = computeDayOfWeek(allCheckIns, timezoneOffsetMinutes);
    let categoryBreakdown = computeCategoryBreakdown(ownedHabits, allCheckIns);

    {
      habits = habitAnalytics;
      overallIfThenEffectiveness = overallIfThen;
      dayOfWeek;
      bestDayOfWeek = bestDay(dayOfWeek);
      worstDayOfWeek = worstDay(dayOfWeek);
      categoryBreakdown;
    };
  };
};
