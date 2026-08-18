import Map "mo:core/Map";
import List "mo:core/List";

// Backfill migration: introduces the `goalId` field on Goal and dedupes
// existing habits into reusable goal objects.
//
// For each existing habit, this migration:
//   - adds `var goalId : ?Nat` (initialized to null);
//   - then, per owner, dedupes habits by exact wish text match: one habit per
//     (owner, wish) group becomes the canonical reusable goal (goalId stays
//     null — it is the source of the wish text), and every other habit in the
//     same group gets goalId set to the canonical habit's id.
//
// Idempotent and safe on a fresh install: when there are no existing habits,
// the dedupe loop is a no-op and every goalId stays null.
//
// OldActor matches the NewActor of 20260725_194140.mo (the previous migration).
// NewActor adds `var goalId : ?Nat` to Goal. All other stable fields are
// carried through unchanged. Types are inlined — no project imports.

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

  // Old Goal — exactly as in 20260725_194140.mo (no goalId field).
  type OldGoal = {
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

  // New Goal — adds `var goalId : ?Nat`.
  type NewGoal = {
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
    goals : List.List<OldGoal>;
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
    goals : List.List<NewGoal>;
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
    // Snapshot the old goals and rebuild the new list with goalId added.
    // We preserve the original Goal objects' identity where possible by
    // reusing their mutable fields; only goalId is new.
    let snapshot = old.goals.toArray();
    let newGoals = List.empty<NewGoal>();

    // First pass: build NewGoal records with goalId = null, keyed by id, so
    // we can look them up by id when assigning deduped references.
    // We also collect (owner, wish) -> canonical id for dedupe.
    let dedupe = Map.empty<Principal, Map.Map<Text, Nat>>();
    // Track which new goal corresponds to each old id (for the second pass).
    let byId = Map.empty<Nat, NewGoal>();

    for (og in snapshot.values()) {
      let ng : NewGoal = {
        id = og.id;
        owner = og.owner;
        var goalId = null : ?Nat;
        var wish = og.wish;
        var wishDescription = og.wishDescription;
        outcome = og.outcome;
        obstacleTemplateId = og.obstacleTemplateId;
        var ifThenPlan = og.ifThenPlan;
        var state = og.state;
        createdAt = og.createdAt;
        var updatedAt = og.updatedAt;
        var iconName = og.iconName;
        var themeColor = og.themeColor;
        var isLockIn = og.isLockIn;
        var startTime = og.startTime;
        var endTime = og.endTime;
        var lastEditedAt = og.lastEditedAt;
        var lockInDurationMinutes = og.lockInDurationMinutes;
        var startTimeMinutes = og.startTimeMinutes;
        var endTimeMinutes = og.endTimeMinutes;
        var scheduledDays = og.scheduledDays;
        var category = og.category;
      };
      byId.add(ng.id, ng);
      newGoals.add(ng);

      // Dedupe by (owner, wish): first habit seen for a given (owner, wish)
      // becomes the canonical reusable goal.
      switch (dedupe.get(og.owner)) {
        case (?ownerMap) {
          switch (ownerMap.get(og.wish)) {
            case (?_) {
              // Already have a canonical goal for this (owner, wish) —
              // point this habit at it.
              ng.goalId := ownerMap.get(og.wish);
            };
            case null {
              ownerMap.add(og.wish, og.id);
            };
          };
        };
        case null {
          let ownerMap = Map.empty<Text, Nat>();
          ownerMap.add(og.wish, og.id);
          dedupe.add(og.owner, ownerMap);
        };
      };
    };

    {
      profiles = old.profiles;
      goals = newGoals;
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
