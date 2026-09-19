import Map "mo:core/Map";
import List "mo:core/List";

// Record the follow-up question's declined answer on the check-in itself.
//
// A check-in previously carried only `executedIfThen : Bool` — the "used my
// plan" answer. It now also carries `followUpDeclined : Bool`, which records
// that the question was asked and the user dismissed it without answering.
// The two flags are mutually exclusive, so a check-in is in exactly one of
// three states: used the plan, asked-and-declined, or unanswered.
//
// Existing check-ins have not been answered either way, so they carry forward
// as unanswered: `followUpDeclined = false` and `executedIfThen` unchanged.
// No prior answer is guessed.
//
// OldActor matches the NewActor of 20260918_120000.mo (the previous
// migration). Types are inlined — no project imports.

module {
  type UserRole = { #user; #admin };
  type CheckInType = { #success; #skip; #missed; #inProgress; #missedCheckIn; #missedCheckOut };
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
    obstacleTemplateIds : [Nat];
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
    checkInType : CheckInType;
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
    checkInType : CheckInType;
    obstacleTemplateId : ?Nat;
    timestamp : Int;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
    followUpDeclined : Bool;
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
    // Every existing check-in carries forward as unanswered: the new flag is
    // false and executedIfThen is preserved exactly as it was.
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
        followUpDeclined = false;
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
