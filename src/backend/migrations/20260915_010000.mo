import Map "mo:core/Map";
import List "mo:core/List";

// Re-introduce an optional free-text `note` on CheckIn records.
//
// The previous migration (20260915_000000.mo) removed the `customObstacleNote`
// free-text field from every CheckIn. This migration adds back an optional
// `note : ?Text` field on the CheckIn type. The note is purely personal
// context attached to that one check-in — it is NOT an obstacle category, is
// never counted or grouped in analytics, and does not reopen any custom
// obstacle-template storage. Existing check-ins get `note = null`.
//
// OldActor matches the NewActor of 20260915_000000.mo (the previous
// migration). NewActor adds the optional `note` field to CheckIn. Types are
// inlined — no project imports.

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

  // Old CheckIn — no note field (as left by 20260915_000000.mo).
  type OldCheckIn = {
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

  // New CheckIn — adds the optional free-text `note` field.
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
    note : ?Text;
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
    nextGoalId : [var Nat];
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
    // Rebuild check-ins, adding the optional `note` field (null for existing).
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
        note = null;
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
