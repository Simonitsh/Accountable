import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "types/common";
import GoalTypes "types/goals";
import CheckInTypes "types/checkins";
import ConnectionTypes "types/connections";
import FeedTypes "types/feed";
import AuthTypes "types/auth";

module {
  // Old Goal type — before habitMinutes, emailNotifications, intentTime, reminderOffset were added
  type OldGoal = {
    id : Common.GoalId;
    owner : Common.UserId;
    var wish : Text;
    var wishDescription : Text;
    var outcome : Text;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    var ifThenPlan : Text;
    var state : Common.GoalState;
    createdAt : Common.Timestamp;
    var updatedAt : Common.Timestamp;
    var iconName : ?Text;
    var themeColor : ?Text;
    var isLockIn : Bool;
    var startTime : ?Text;
    var endTime : ?Text;
    var lastEditedAt : ?Common.Timestamp;
  };

  type OldActor = {
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>;
    goals : List.List<OldGoal>;
    obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>;
    nextGoalId : [var Nat];
    nextObstacleTemplateId : [var Nat];
    checkIns : List.List<CheckInTypes.CheckIn>;
    nextCheckInId : [var Nat];
    connections : List.List<ConnectionTypes.Connection>;
    nextConnectionId : [var Nat];
    interactions : List.List<FeedTypes.Interaction>;
    nextInteractionId : [var Nat];
  };

  type NewActor = {
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>;
    goals : List.List<GoalTypes.Goal>;
    obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>;
    nextGoalId : [var Nat];
    nextObstacleTemplateId : [var Nat];
    checkIns : List.List<CheckInTypes.CheckIn>;
    nextCheckInId : [var Nat];
    connections : List.List<ConnectionTypes.Connection>;
    nextConnectionId : [var Nat];
    interactions : List.List<FeedTypes.Interaction>;
    nextInteractionId : [var Nat];
  };

  public func run(old : OldActor) : NewActor {
    {
      profiles = old.profiles;
      goals = List.map(
        old.goals,
        func(g : OldGoal) : GoalTypes.Goal {
          {
            id = g.id;
            owner = g.owner;
            var wish = g.wish;
            var wishDescription = g.wishDescription;
            var outcome = g.outcome;
            obstacleTemplateId = g.obstacleTemplateId;
            var ifThenPlan = g.ifThenPlan;
            var state = g.state;
            createdAt = g.createdAt;
            var updatedAt = g.updatedAt;
            var iconName = g.iconName;
            var themeColor = g.themeColor;
            var isLockIn = g.isLockIn;
            var startTime = g.startTime;
            var endTime = g.endTime;
            var lastEditedAt = g.lastEditedAt;
            var emailNotifications = false;
            var intentTime = null;
            var reminderOffset = null;
            var habitMinutes = 0;
          }
        }
      );
      obstacleTemplates = old.obstacleTemplates;
      nextGoalId = old.nextGoalId;
      nextObstacleTemplateId = old.nextObstacleTemplateId;
      checkIns = old.checkIns;
      nextCheckInId = old.nextCheckInId;
      connections = old.connections;
      nextConnectionId = old.nextConnectionId;
      interactions = old.interactions;
      nextInteractionId = old.nextInteractionId;
    }
  };
}
