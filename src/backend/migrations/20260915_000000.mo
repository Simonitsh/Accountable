import Map "mo:core/Map";
import List "mo:core/List";

// Lock obstacles to the seven built-in values + remove custom-obstacle
// capability.
//
// This migration does two things:
//   1. Removes the `obstacleTemplates` storage and the `nextObstacleTemplateId`
//      counter. Obstacles are now locked to exactly seven fixed built-in
//      values (defined as a constant in types/goals.mo) — no per-user custom
//      obstacle templates can ever be created or stored again.
//   2. Removes the `customObstacleNote` free-text field from every stored
//      CheckIn. A habit's obstacle is now always one of the seven built-ins,
//      so free-text custom obstacle notes no longer exist.
//
// OldActor matches the NewActor of 20260815_130000.mo (the previous
// migration). NewActor drops the obstacle-template state and the check-in
// custom note. Types are inlined — no project imports.

module {
  type UserRole = { #user; #admin };
  type CheckInType = { #success; #skip; #inProgress; #missedCheckIn; #missedCheckOut };
  type ConnectionStatus = { #pending; #accepted; #rejected };
  type InteractionType = { #highFive };
  type GoalState = { #active; #paused; #completed };
  type GoalCategory = { #Health; #Learning; #Social; #Productivity; #Leisure };
  type AvatarShape = ?{ #Triangle; #Square; #Pentagon; #Hexagon; #Star };
  type AvatarColor = ?Text;
  type AvatarColorMode = { #Fill; #BorderOnly };

  type UserProfile = {
    id : Principal;
    var username : Text;
    var displayName : Text;
    var avatarShape : AvatarShape;
    var avatarColor : AvatarColor;
    var avatarColorMode : AvatarColorMode;
    var timezone : Text;
    var bio : ?Text;
    var email : ?Text;
    var timezoneOffsetMinutes : Int;
    var role : UserRole;
    var createdAt : Int;
  };

  type Goal = {
    id : Nat;
    owner : Principal;
    var goalId : ?Nat;
    var wish : Text;
    var wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Nat;
    var ifThenPlan : Text;
    var state : GoalState;
    createdAt : Int;
    var updatedAt : Int;
    var iconName : ?Text;
    var themeColor : ?Text;
    var isLockIn : Bool;
    var startTime : ?Text;
    var endTime : ?Text;
    var lastEditedAt : ?Int;
    var lockInDurationMinutes : Nat;
    var startTimeMinutes : Nat;
    var endTimeMinutes : Nat;
    var scheduledDays : [Text];
    var category : GoalCategory;
  };

  type ObstacleTemplate = {
    id : Nat;
    owner : Principal;
    title : Text;
    description : Text;
  };

  // Old CheckIn — carries the customObstacleNote free-text field.
  type OldCheckIn = {
    id : Nat;
    goalId : Nat;
    owner : Principal;
    checkInType : CheckInType;
    obstacleTemplateId : ?Nat;
    customObstacleNote : ?Text;
    timestamp : Int;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
  };

  // New CheckIn — customObstacleNote removed.
  type NewCheckIn = {
    id : Nat;
    goalId : Nat;
    owner : Principal;
    checkInType : CheckInType;
    obstacleTemplateId : ?Nat;
    timestamp : Int;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
  };

  type Connection = {
    id : Nat;
    fromPrincipal : Principal;
    toPrincipal : Principal;
    var status : ConnectionStatus;
    createdAt : Int;
  };

  type Interaction = {
    id : Nat;
    checkInId : Nat;
    fromPrincipal : Principal;
    interactionType : InteractionType;
    timestamp : Int;
  };

  type OldActor = {
    profiles : Map.Map<Principal, UserProfile>;
    goals : List.List<Goal>;
    obstacleTemplates : List.List<ObstacleTemplate>;
    nextGoalId : [var Nat];
    nextObstacleTemplateId : [var Nat];
    checkIns : List.List<OldCheckIn>;
    nextCheckInId : [var Nat];
    connections : List.List<Connection>;
    nextConnectionId : [var Nat];
    interactions : List.List<Interaction>;
    nextInteractionId : [var Nat];
  };

  type NewActor = {
    profiles : Map.Map<Principal, UserProfile>;
    goals : List.List<Goal>;
    nextGoalId : [var Nat];
    checkIns : List.List<NewCheckIn>;
    nextCheckInId : [var Nat];
    connections : List.List<Connection>;
    nextConnectionId : [var Nat];
    interactions : List.List<Interaction>;
    nextInteractionId : [var Nat];
  };

  public func migration(old : OldActor) : NewActor {
    // Rebuild check-ins, dropping the customObstacleNote free-text field.
    let newCheckIns = List.empty<NewCheckIn>();
    for (c in old.checkIns.toArray().values()) {
      let nc : NewCheckIn = {
        id = c.id;
        goalId = c.goalId;
        owner = c.owner;
        checkInType = c.checkInType;
        obstacleTemplateId = c.obstacleTemplateId;
        timestamp = c.timestamp;
        lockInStartedAt = c.lockInStartedAt;
        lockInEndedAt = c.lockInEndedAt;
        executedIfThen = c.executedIfThen;
      };
      newCheckIns.add(nc);
    };

    {
      profiles = old.profiles;
      goals = old.goals;
      nextGoalId = old.nextGoalId;
      checkIns = newCheckIns;
      nextCheckInId = old.nextCheckInId;
      connections = old.connections;
      nextConnectionId = old.nextConnectionId;
      interactions = old.interactions;
      nextInteractionId = old.nextInteractionId;
    };
  };
};
