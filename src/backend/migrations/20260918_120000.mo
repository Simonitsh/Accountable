import Map "mo:core/Map";
import List "mo:core/List";

// Convert a habit's single predicted obstacle into a list of predicted
// obstacles.
//
// A habit previously stored exactly one predicted obstacle in
// `obstacleTemplateId : ?Nat`. It now stores ALL predicted obstacles in
// `obstacleTemplateIds : [Nat]`, restricted to the seven built-ins and never
// empty. This migration carries the existing single obstacle forward as the
// habit's only predicted obstacle, and produces an empty list when it was
// null. No data is lost.
//
// Check-in state is untouched: `CheckIn.obstacleTemplateId` remains a single
// optional id (the obstacle that actually got in the way that day).
//
// OldActor matches the NewActor of 20260918_000000.mo (the previous
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

  type OldGoal = {
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

  type NewGoal = {
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

  type CheckIn = {
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
    goals : List.List<OldGoal>;
    nextGoalId : [var Nat];
    checkIns : List.List<CheckIn>;
    nextCheckInId : [var Nat];
    connections : List.List<Connection>;
    nextConnectionId : [var Nat];
    interactions : List.List<Interaction>;
    nextInteractionId : [var Nat];
  };

  type NewActor = {
    profiles : Map.Map<Principal, UserProfile>;
    goals : List.List<NewGoal>;
    nextGoalId : [var Nat];
    checkIns : List.List<CheckIn>;
    nextCheckInId : [var Nat];
    connections : List.List<Connection>;
    nextConnectionId : [var Nat];
    interactions : List.List<Interaction>;
    nextInteractionId : [var Nat];
  };

  public func migration(old : OldActor) : NewActor {
    // Rebuild goals, widening the single predicted obstacle into a list.
    let newGoals = List.empty<NewGoal>();
    for (g in old.goals.toArray().values()) {
      let ids : [Nat] = switch (g.obstacleTemplateId) {
        case null [] : [Nat];
        case (?id) [id];
      };
      let ng : NewGoal = {
        id = g.id;
        owner = g.owner;
        var goalId = g.goalId;
        var wish = g.wish;
        var wishDescription = g.wishDescription;
        outcome = g.outcome;
        obstacleTemplateIds = ids;
        var ifThenPlan = g.ifThenPlan;
        var state = g.state;
        createdAt = g.createdAt;
        var updatedAt = g.updatedAt;
        var themeColor = g.themeColor;
        var isLockIn = g.isLockIn;
        var startTime = g.startTime;
        var endTime = g.endTime;
        var lastEditedAt = g.lastEditedAt;
        var lockInDurationMinutes = g.lockInDurationMinutes;
        var startTimeMinutes = g.startTimeMinutes;
        var endTimeMinutes = g.endTimeMinutes;
        var scheduledDays = g.scheduledDays;
        var category = g.category;
      };
      newGoals.add(ng);
    };

    {
      profiles = old.profiles;
      goals = newGoals;
      nextGoalId = old.nextGoalId;
      checkIns = old.checkIns;
      nextCheckInId = old.nextCheckInId;
      connections = old.connections;
      nextConnectionId = old.nextConnectionId;
      interactions = old.interactions;
      nextInteractionId = old.nextInteractionId;
    };
  };
};
