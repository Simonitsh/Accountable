import Map "mo:core/Map";
import List "mo:core/List";

// Persist the timezone offset each check-in was recorded with.
//
// Check-ins previously carried no timezone information, so day-of-week
// bucketing had to use a single offset supplied by the caller. That is wrong
// across DST changes and travel: a check-in recorded at UTC+2 in summer and
// one recorded at UTC+1 in winter cannot both be bucketed with today's offset.
// Each check-in now carries `tzOffsetMinutes : ?Int` — the offset in effect
// when it was recorded.
//
// Existing check-ins predate the field and their true offset is unknown, so
// they carry forward as `null`. Analytics falls back to the caller-supplied
// offset for null records. No historical check-in is rewritten or deleted.
//
// OldActor matches the NewActor of 20260919_120000.mo (the previous
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
    followUpDeclined : Bool;
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
    tzOffsetMinutes : ?Int;
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
    // Every existing check-in carries forward unchanged, with an unknown
    // recorded offset (null). Nothing is rewritten or deleted.
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
        followUpDeclined = c.followUpDeclined;
        tzOffsetMinutes = null;
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
