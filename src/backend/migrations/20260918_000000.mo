import Map "mo:core/Map";
import List "mo:core/List";

// Introduce a dedicated `#missed` check-in status, distinct from a deliberate
// `#skip`.
//
// A deliberate skip always carries an obstacle (recordCheckIn traps without
// one); a day that passed with no interaction was previously written as a
// `#skip` with no obstacle by the overnight auto-fail process. This migration
// converts every stored `#skip` that has no obstacle into `#missed`, so the
// distinction lives in stored data rather than being inferred at display time.
// A `#skip` that carries an obstacle stays a deliberate skip.
//
// OldActor matches the NewActor of 20260916_000000.mo (the previous
// migration). NewActor widens CheckInType with `#missed`. Types are inlined —
// no project imports.

module {
  type UserRole = { #user; #admin };
  type OldCheckInType = { #success; #skip; #inProgress; #missedCheckIn; #missedCheckOut };
  type NewCheckInType = { #success; #skip; #missed; #inProgress; #missedCheckIn; #missedCheckOut };
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

  type OldCheckIn = {
    id : Nat;
    goalId : Nat;
    owner : Principal;
    checkInType : OldCheckInType;
    obstacleTemplateId : ?Nat;
    timestamp : Int;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
    note : ?Text;
  };

  type NewCheckIn = {
    id : Nat;
    goalId : Nat;
    owner : Principal;
    checkInType : NewCheckInType;
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
    // Rebuild check-ins, converting obstacle-less skips into missed days.
    let newCheckIns = List.empty<NewCheckIn>();
    for (c in old.checkIns.toArray().values()) {
      let newType : NewCheckInType = switch (c.checkInType) {
        case (#skip) {
          switch (c.obstacleTemplateId) {
            case null #missed;
            case (?_) #skip;
          };
        };
        case (#success) #success;
        case (#inProgress) #inProgress;
        case (#missedCheckIn) #missedCheckIn;
        case (#missedCheckOut) #missedCheckOut;
      };
      let nc : NewCheckIn = {
        id = c.id;
        goalId = c.goalId;
        owner = c.owner;
        checkInType = newType;
        obstacleTemplateId = c.obstacleTemplateId;
        timestamp = c.timestamp;
        lockInStartedAt = c.lockInStartedAt;
        lockInEndedAt = c.lockInEndedAt;
        executedIfThen = c.executedIfThen;
        note = c.note;
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
