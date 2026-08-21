import Map "mo:core/Map";
import List "mo:core/List";

// First step in the migration chain: bootstraps a genuinely fresh canister
// install (truly empty stable state) into the 11-field NewActor shape.
//
// OldActor is {} — this is the very first migration, so it runs on a fresh
// install where no stable state exists yet. Its migration() ignores the empty
// old actor and returns the full 11-field NewActor shape populated with empty
// defaults, so every subsequent migration in the chain (starting with
// 20260725_000000.mo) has the exact shape it expects.
//
// NewActor matches the OldActor/NewActor shape of 20260725_000000.mo and
// 20260725_194140.mo (Goal without goalId, GoalState including #abandoned).
// Types are inlined — no project imports.

module {
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

  // Inlined stable record types — must match the project's type definitions
  // structurally (only primitive/serializable fields). Variant tags and
  // option types are inlined here too; no project imports allowed.
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

  public func migration(_old : OldActor) : NewActor {
    {
      profiles = Map.empty<Principal, UserProfile>();
      goals = List.empty<Goal>();
      obstacleTemplates = List.empty<ObstacleTemplate>();
      nextGoalId = [var 0];
      nextObstacleTemplateId = [var 0];
      checkIns = List.empty<CheckIn>();
      nextCheckInId = [var 0];
      connections = List.empty<Connection>();
      nextConnectionId = [var 0];
      interactions = List.empty<Interaction>();
      nextInteractionId = [var 0];
    };
  };
};
