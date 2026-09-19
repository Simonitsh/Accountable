import Common "common";
import GoalTypes "goals";

module {
  /// Follow-through rate: the fraction of check-ins that were actual
  /// successes. `total` counts every check-in (success, skip, and missed);
  /// `rate` is `successes / total`, or `0.0` when `total == 0`.
  public type FollowThroughRate = {
    successes : Nat;
    total : Nat;
    rate : Float;
  };

  /// If-then plan effectiveness: follow-through on days the if-then plan was
  /// used (`executedIfThen = true` on the check-in) versus days it was not.
  /// The two rates are directly comparable — a future insight can express a
  /// likelihood ratio such as "twice as likely to follow through when using
  /// your plan".
  public type IfThenEffectiveness = {
    usedPlan : FollowThroughRate;
    notUsedPlan : FollowThroughRate;
  };

  /// Follow-through for a single day of the week.
  /// `dayOfWeek` is 0 = Sunday ... 6 = Saturday (matching the app's
  /// day-of-week convention used elsewhere in the backend).
  public type DayOfWeekStat = {
    dayOfWeek : Nat;
    dayName : Text;
    successes : Nat;
    total : Nat;
    rate : Float;
  };

  /// Follow-through rolled up for a single habit category.
  public type CategoryStat = {
    category : GoalTypes.GoalCategory;
    successes : Nat;
    total : Nat;
    rate : Float;
  };

  /// An obstacle and how often it was recorded on check-ins.
  /// `obstacleTemplateId` references one of the seven built-in obstacles;
  /// `obstacleName` is that built-in's title.
  public type ObstacleStat = {
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    obstacleName : Text;
    count : Nat;
  };

  /// Per-habit analytics.
  public type HabitAnalytics = {
    habitId : Common.GoalId;
    habitName : Text;
    category : GoalTypes.GoalCategory;
    /// Days actually shown up — counts only genuine successes. Skips and
    /// auto-filled forgotten days (recorded as skips) are excluded so the
    /// number reflects real effort, not grading. Kept per habit so it can be
    /// rolled up into an overall number later without losing detail.
    shownUpDays : Nat;
    ifThenEffectiveness : IfThenEffectiveness;
    /// The obstacles the user predicted for this habit (saved permanently,
    /// non-editable). Each entry's `count` is the number of habits that
    /// predicted that obstacle — the predicted pool is shared across the
    /// caller's habits, so a habit contributes all of its predicted obstacles
    /// and each carries a genuine count.
    predictedObstacles : [ObstacleStat];
    /// Obstacles actually recorded on this habit's check-ins, sorted by how
    /// often they came up (most frequent first).
    actualObstacles : [ObstacleStat];
  };

  public type AnalyticsSummary = {
    habits : [HabitAnalytics];
    overallIfThenEffectiveness : IfThenEffectiveness;
    dayOfWeek : [DayOfWeekStat];
    /// Day-of-week index (0 = Sunday ... 6 = Saturday) with the highest
    /// follow-through rate among days that have check-ins. null when there is
    /// no data.
    bestDayOfWeek : ?Nat;
    /// Day-of-week index with the lowest follow-through rate among days that
    /// have check-ins. null when there is no data.
    worstDayOfWeek : ?Nat;
    categoryBreakdown : [CategoryStat];
  };
};
