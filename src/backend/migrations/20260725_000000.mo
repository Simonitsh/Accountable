import Map "mo:core/Map";
import List "mo:core/List";

// Bootstrap migration: fixes the fresh-install failure.
//
// The frozen migration 20260725_194140.mo declares a NON-empty OldActor
// (all 11 stable fields, including `checkIns`). On a fresh install the
// migration chain starts from an empty state `{}`, so replaying
// 20260725_194140.mo first traps with "field `checkIns` expected but not
// found in state". That file is read-only and cannot be edited.
//
// This bootstrap sorts BEFORE 20260725_194140.mo. Its OldActor is the empty
// state `{}` (the true fresh-install starting point) and its NewActor
// produces the full 11-field state shape that 20260725_194140.mo's OldActor
// expects. On a fresh install the chain now replays:
//   bootstrap ({} -> full state)
//   -> 20260725_194140 (consumes the full state without trapping)
//   -> 20260813_104705 -> 20260815_120000 -> 20260815_130000
// so the frozen migration no longer traps. On an upgrade of an already
// deployed canister this bootstrap is older than the deployed tail and does
// not run, so existing state is untouched.
//
// NewActor matches the OldActor of 20260725_194140.mo exactly: Goal has no
// `goalId` field yet, and GoalState still includes #abandoned (both are
// introduced/removed by later migrations in the chain). Types are inlined —
// no project imports.

module {
  type UserRole = { #user; #admin };
  type CheckInType = { #success; #skip; #inProgress; #missedCheckIn; #missedCheckOut };
  type ConnectionStatus = { #pending; #accepted; #rejected };
  type InteractionType = { #highFive };
  type GoalState = { #active; #paused; #completed; #abandoned };
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

  type CheckIn = {
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

  type OldActor = {};

  type NewActor = {
    profiles : Map.Map<Principal, UserProfile>;
    goals : List.List<Goal>;
    obstacleTemplates : List.List<ObstacleTemplate>;
    nextGoalId : [var Nat];
    nextObstacleTemplateId : [var Nat];
    checkIns : List.List<CheckIn>;
    nextCheckInId : [var Nat];
    connections : List.List<Connection>;
    nextConnectionId : [var Nat];
    interactions : List.List<Interaction>;
    nextInteractionId : [var Nat];
  };

  public func migration(old : OldActor) : NewActor {
    ignore old;
    {
      profiles = Map.empty();
      goals = List.empty();
      obstacleTemplates = List.empty();
      nextGoalId = [var 0];
      nextObstacleTemplateId = [var 0];
      checkIns = List.empty();
      nextCheckInId = [var 0];
      connections = List.empty();
      nextConnectionId = [var 0];
      interactions = List.empty();
      nextInteractionId = [var 0];
    };
  };
};
