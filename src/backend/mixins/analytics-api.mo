import List "mo:core/List";
import Common "../types/common";
import AnalyticsTypes "../types/analytics";
import CheckInTypes "../types/checkins";
import GoalTypes "../types/goals";
import AnalyticsLib "../lib/analytics";

mixin (
  goals : List.List<GoalTypes.Goal>,
  checkIns : List.List<CheckInTypes.CheckIn>,
  obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
) {
  public shared query ({ caller }) func getAnalytics() : async AnalyticsTypes.AnalyticsSummary {
    AnalyticsLib.getAnalytics(goals, checkIns, obstacleTemplates, caller);
  };
};
