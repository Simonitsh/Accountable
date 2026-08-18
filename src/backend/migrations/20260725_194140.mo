import Map "mo:core/Map";
import List "mo:core/List";

// First migration: introduces stable state for the first time.
// OldActor = {} (fresh install); NewActor enumerates every stable field
// declared in main.mo and supplies its initial value. The actor body has
// no inline initializers under enhanced migration — values come from here.

module {
  // Previous deployed actor already declared these 11 stable fields with
  // the same names and types (see .old/src/backend/dist/backend.most). The
  // migration consumes them all and re-emits them unchanged so no prior
  // state is discarded (M0169). Types are inlined — no project imports.
  type OldActor = {
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

  // New actor stable fields — same shape as OldActor (this migration only
  // moves initializers out of the actor body into the migration chain; no
  // state-shape change). The ID counters stay [var Nat] so the Goals module
  // can mutate them by reference.
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
