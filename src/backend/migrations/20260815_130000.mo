import Map "mo:core/Map";
import List "mo:core/List";

// Remove-#abandoned + hard-delete-readiness migration.
//
// This migration does two things:
//   1. Narrows `GoalState` from { #active; #paused; #completed; #abandoned }
//      to { #active; #paused; #completed }. The #abandoned tag is removed
//      entirely — the soft-delete flow it represented is replaced by the new
//      hard-delete `deleteGoal` operation.
//   2. Purges every goal (macro goal or habit) whose state is #abandoned, plus
//      every check-in and feed interaction linked to those goals, so the
//      system starts clean with no records referencing a state that no longer
//      exists. Existing abandoned goals from the old soft-delete flow are
//      gone for good — the user accepts analytics data loss as a trade-off of
//      hard-deleting goals.
//
// The purge is transitive: deleting an abandoned macro goal also deletes its
// child habits (goalId pointing at it), and deleting any goal deletes the
// check-ins linked to it and the interactions linked to those check-ins.
//
// OldActor matches the NewActor of 20260815_120000.mo (the previous
// migration). NewActor narrows GoalState. Types are inlined — no project
// imports.

module {
  type UserRole = { #user; #admin };
  type CheckInType = { #success; #skip; #inProgress; #missedCheckIn; #missedCheckOut };
  type ConnectionStatus = { #pending; #accepted; #rejected };
  type InteractionType = { #highFive };
  type OldGoalState = { #active; #paused; #completed; #abandoned };
  type NewGoalState = { #active; #paused; #completed };
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

  // Old Goal — state is OldGoalState (includes #abandoned).
  type OldGoal = {
    id : Nat;
    owner : Principal;
    var goalId : ?Nat;
    var wish : Text;
    var wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Nat;
    var ifThenPlan : Text;
    var state : OldGoalState;
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

  // New Goal — state is NewGoalState (no #abandoned). All other fields
  // identical in shape and mutability.
  type NewGoal = {
    id : Nat;
    owner : Principal;
    var goalId : ?Nat;
    var wish : Text;
    var wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Nat;
    var ifThenPlan : Text;
    var state : NewGoalState;
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

  // Convert an OldGoalState to a NewGoalState. #abandoned is unreachable
  // here because abandoned goals are purged before this is called; the
  // branch exists only to satisfy the exhaustiveness requirement over the
  // old variant.
  func toNewState(s : OldGoalState) : NewGoalState {
    switch (s) {
      case (#active) #active;
      case (#paused) #paused;
      case (#completed) #completed;
      case (#abandoned) #active;
    };
  };

  public func migration(old : OldActor) : NewActor {
    let oldGoalsSnapshot = old.goals.toArray();

    // ── 1. Identify the set of goal ids to purge ─────────────────────────
    // An abandoned macro goal pulls in itself + all its child habits.
    // An abandoned habit pulls in itself. We also cascade: any habit whose
    // parent macro goal is being purged is purged too (even if the habit
    // itself is not #abandoned), so no dangling habits survive.
    let purgeIds = Map.empty<Nat, Bool>();
    // First pass: directly abandoned goals (macro goals and habits).
    for (g in oldGoalsSnapshot.values()) {
      if (g.state == #abandoned) {
        purgeIds.add(g.id, true);
      };
    };
    // Second pass: habits whose parent macro goal is being purged.
    for (g in oldGoalsSnapshot.values()) {
      switch (g.goalId) {
        case null {};
        case (?parentId) {
          if (purgeIds.get(parentId) != null) {
            purgeIds.add(g.id, true);
          };
        };
      };
    };

    // ── 2. Rebuild goals, dropping purged ones and converting state ──────
    let newGoals = List.empty<NewGoal>();
    for (og in oldGoalsSnapshot.values()) {
      if (purgeIds.get(og.id) != null) {
        // Purged — skip.
        continue;
      };
      let ng : NewGoal = {
        id = og.id;
        owner = og.owner;
        var goalId = og.goalId;
        var wish = og.wish;
        var wishDescription = og.wishDescription;
        outcome = og.outcome;
        obstacleTemplateId = og.obstacleTemplateId;
        var ifThenPlan = og.ifThenPlan;
        var state = toNewState(og.state);
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
      newGoals.add(ng);
    };

    // ── 3. Rebuild check-ins, dropping those linked to purged goals ──────
    let oldCheckInsSnapshot = old.checkIns.toArray();
    let newCheckIns = List.empty<CheckIn>();
    for (c in oldCheckInsSnapshot.values()) {
      if (purgeIds.get(c.goalId) == null) {
        newCheckIns.add(c);
      };
    };

    // ── 4. Rebuild interactions, dropping those linked to purged check-ins ─
    // Build the set of surviving check-in ids so we can filter interactions.
    let survivingCheckInIds = Map.empty<Nat, Bool>();
    for (c in newCheckIns.toArray().values()) {
      survivingCheckInIds.add(c.id, true);
    };
    let oldInteractionsSnapshot = old.interactions.toArray();
    let newInteractions = List.empty<Interaction>();
    for (i in oldInteractionsSnapshot.values()) {
      if (survivingCheckInIds.get(i.checkInId) != null) {
        newInteractions.add(i);
      };
    };

    {
      profiles = old.profiles;
      goals = newGoals;
      obstacleTemplates = old.obstacleTemplates;
      nextGoalId = old.nextGoalId;
      nextObstacleTemplateId = old.nextObstacleTemplateId;
      checkIns = newCheckIns;
      nextCheckInId = old.nextCheckInId;
      connections = old.connections;
      nextConnectionId = old.nextConnectionId;
      interactions = newInteractions;
      nextInteractionId = old.nextInteractionId;
    };
  };
};
