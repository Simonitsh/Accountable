import Common "common";

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
  };

  public type AnalyticsSummary = {
    goals : [GoalAnalytics];
    dailySuccessRate30Days : [Float];
  };
};
