import Map "mo:core/Map";
import List "mo:core/List";
import Common "./types/common";
import AuthTypes "./types/auth";
import GoalTypes "./types/goals";
import CheckInTypes "./types/checkins";
import ConnectionTypes "./types/connections";
import FeedTypes "./types/feed";

module {
  // Old types defined inline (copied from .old/src/backend/types/)
  type OldUserId = Principal;
  type OldTimestamp = Int;

  type OldUserProfile = {
    id : OldUserId;
    var username : Text;
    var displayName : Text;
    var avatarEmoji : Text;
    var timezone : Text;
    var bio : ?Text;
    var email : ?Text;
    var timezoneOffsetMinutes : Int;
    var role : { #user; #admin };
    var createdAt : OldTimestamp;
  };

  type OldGoalId = Nat;
  type OldObstacleTemplateId = Nat;
  type OldCheckInId = Nat;
  type OldConnectionId = Nat;
  type OldInteractionId = Nat;

  type OldGoalCategory = { #Health; #Learning; #Social; #Productivity; #Leisure };

  type OldGoal = {
    id : OldGoalId;
    owner : OldUserId;
    var wish : Text;
    var wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?OldObstacleTemplateId;
    var ifThenPlan : Text;
    var state : { #active; #paused; #completed; #abandoned };
    createdAt : OldTimestamp;
    var updatedAt : OldTimestamp;
    var iconName : ?Text;
    var themeColor : ?Text;
    var isLockIn : Bool;
    var startTime : ?Text;
    var endTime : ?Text;
    var lastEditedAt : ?OldTimestamp;
    var emailNotifications : Bool;
    var intentTime : ?Text;
    var reminderOffset : ?Int;
    var lastEmailSentAt : Int;
    var lockInDurationMinutes : Nat;
    var startTimeMinutes : Nat;
    var endTimeMinutes : Nat;
    var intentTimeMinutes : Nat;
    var scheduledDays : [Text];
    var category : OldGoalCategory;
  };

  type OldObstacleTemplate = {
    id : OldObstacleTemplateId;
    owner : OldUserId;
    title : Text;
    description : Text;
  };

  type OldCheckIn = {
    id : OldCheckInId;
    goalId : OldGoalId;
    owner : OldUserId;
    checkInType : { #success; #skip; #inProgress; #missedCheckIn; #missedCheckOut };
    obstacleTemplateId : ?OldObstacleTemplateId;
    customObstacleNote : ?Text;
    timestamp : OldTimestamp;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
  };

  type OldConnection = {
    id : OldConnectionId;
    fromPrincipal : OldUserId;
    toPrincipal : OldUserId;
    var status : { #pending; #accepted; #rejected };
    createdAt : OldTimestamp;
  };

  type OldInteraction = {
    id : OldInteractionId;
    checkInId : OldCheckInId;
    fromPrincipal : OldUserId;
    interactionType : { #highFive };
    timestamp : OldTimestamp;
  };

  type OldActor = {
    profiles : Map.Map<OldUserId, OldUserProfile>;
    goals : List.List<OldGoal>;
    obstacleTemplates : List.List<OldObstacleTemplate>;
    nextGoalId : [var Nat];
    nextObstacleTemplateId : [var Nat];
    checkIns : List.List<OldCheckIn>;
    nextCheckInId : [var Nat];
    connections : List.List<OldConnection>;
    nextConnectionId : [var Nat];
    interactions : List.List<OldInteraction>;
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
    // Migrate profiles: add avatarArchetype field with default "Oak"
    let profiles = old.profiles.map<OldUserId, OldUserProfile, AuthTypes.UserProfile>(
      func(_id, oldProfile) {
        {
          id = oldProfile.id;
          var username = oldProfile.username;
          var displayName = oldProfile.displayName;
          var avatarArchetype = "Oak";
          var timezone = oldProfile.timezone;
          var bio = oldProfile.bio;
          var email = oldProfile.email;
          var timezoneOffsetMinutes = oldProfile.timezoneOffsetMinutes;
          var role = oldProfile.role;
          var createdAt = oldProfile.createdAt;
        }
      }
    );

    // Goals, obstacleTemplates, checkIns, connections, interactions are structurally identical
    // Cast them to new types (old and new types have same shape)
    let goals = old.goals : List.List<GoalTypes.Goal>;
    let obstacleTemplates = old.obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>;
    let checkIns = old.checkIns : List.List<CheckInTypes.CheckIn>;
    let connections = old.connections : List.List<ConnectionTypes.Connection>;
    let interactions = old.interactions : List.List<FeedTypes.Interaction>;

    {
      profiles;
      goals;
      obstacleTemplates;
      nextGoalId = old.nextGoalId;
      nextObstacleTemplateId = old.nextObstacleTemplateId;
      checkIns;
      nextCheckInId = old.nextCheckInId;
      connections;
      nextConnectionId = old.nextConnectionId;
      interactions;
      nextInteractionId = old.nextInteractionId;
    }
  };
};
