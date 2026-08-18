import Map "mo:core/Map";
import List "mo:core/List";

// Category-sync migration: ensures every habit (goalId set) mirrors its
// parent macro goal's `category`.
//
// After the 20260813_104705 backfill migration, habits carry a `goalId`
// pointing at their canonical parent, but their `category` field still
// holds whatever value they had before dedupe. The new domain semantics
// make `category` a goal-level (macro-goal) attribute: a habit inherits
// its category from its parent and is not independently editable.
//
// This migration walks every habit (goalId set), looks up its parent
// macro goal (goalId null) by id, and syncs the habit's `category` to
// the parent's. Habits whose parent cannot be found (orphaned) keep
// their existing category — they remain queryable. Macro goals are
// untouched.
//
// The state SHAPE does not change — OldActor and NewActor are
// structurally identical. The migration exists solely to transform
// existing data. Types are inlined — no project imports.
//
// OldActor matches the NewActor of 20260813_104705.mo (the previous
// migration). NewActor is the same shape.

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

  // Goal shape — identical in OldActor and NewActor (no type change).
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
    // Build a lookup of macro goals (goalId null) by id so we can find
    // each habit's parent in O(log n).
    let snapshot = old.goals.toArray();
    let parentById = Map.empty<Nat, Goal>();
    for (g in snapshot.values()) {
      if (g.goalId == null) {
        parentById.add(g.id, g);
      };
    };

    // Sync each habit's category to its parent macro goal's category.
    // Habits whose parent is missing (orphaned) keep their existing
    // category — they remain queryable.
    for (g in snapshot.values()) {
      switch (g.goalId) {
        case null { /* macro goal — skip */ };
        case (?parentId) {
          switch (parentById.get(parentId)) {
            case (?parent) { g.category := parent.category };
            case null { /* orphaned habit — keep existing category */ };
          };
        };
      };
    };

    // State shape is unchanged — carry every field through as-is.
    {
      profiles = old.profiles;
      goals = old.goals;
      obstacleTemplates = old.obstacleTemplates;
      nextGoalId = old.nextGoalId;
      nextObstacleTemplateId = old.nextObstacleTemplateId;
      checkIns = old.checkIns;
      nextCheckInId = old.nextCheckInId;
      connections = old.connections;
      nextConnectionId = old.nextConnectionId;
      interactions = old.interactions;
      nextInteractionId = old.nextInteractionId;
    };
  };
};
