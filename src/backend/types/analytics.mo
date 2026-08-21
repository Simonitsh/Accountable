import Common "common";
import GoalTypes "goals";

module {
  public type GoalAnalytics = {
    goalId : Common.GoalId;
    goalName : Text;
    currentStreak : Nat;
    longestStreak : Nat;
    totalSuccesses : Nat;
    totalSkips : Nat;
    totalMissed : Nat;
    completionRate : Float;
    daysShownUp : Nat;
    daysInWindow : Nat;
  };

  public type CategoryStat = {
    category : GoalTypes.GoalCategory;
    totalSuccesses : Nat;
    totalSkips : Nat;
    completionRate : Float;
    activeHabits : Nat;
  };

  public type ObstacleStat = {
    id : Common.ObstacleTemplateId;
    title : Text;
  };

  public type AnalyticsSummary = {
    goals : [GoalAnalytics];
    dailySuccessRate30Days : [Float];
    successRateWithPlan : Float;
    successRateWithoutPlan : Float;
    checkInsWithPlan : Nat;
    checkInsWithoutPlan : Nat;
    successRateByWeekday : [Float];
    categoryStats : [CategoryStat];
    plannedObstacle : ?ObstacleStat;
    actualObstacle : ?ObstacleStat;
    plannedMatchesActual : Bool;
    daysShownUp : Nat;
    daysInWindow : Nat;
  };
};
