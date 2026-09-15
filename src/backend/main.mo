
import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Timer "mo:core/Timer";
import Time "mo:core/Time";
import Common "types/common";
import AuthTypes "types/auth";
import GoalTypes "types/goals";
import CheckInTypes "types/checkins";
import ConnectionTypes "types/connections";
import FeedTypes "types/feed";
import AuthApi "mixins/auth-api";
import GoalsApi "mixins/goals-api";
import CheckInsApi "mixins/checkins-api";
import ConnectionsApi "mixins/connections-api";
import FeedApi "mixins/feed-api";
import AnalyticsApi "mixins/analytics-api";
import ObstacleResolutionApi "mixins/obstacle-resolution-api";
import ApiDocMixin "mixins/api-doc";
import PartnerHabitsApi "mixins/partner-habits-api";
import CheckInsLib "lib/checkins";

import Expose "mo:caffeineai-oql/Expose";
import OqlEntity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import ListEntity "mo:caffeineai-oql/ListEntity";
import OQL "mo:caffeineai-oql";

// OQL Value-conversion modules — top-level imports so the .payload() resolver
// can find the implicit `_toRow : <T> -> OQL.Value` for each primitive type
// used in the entity declarations below.
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import TextValue "mo:caffeineai-oql/TextValue";
import IntValue "mo:caffeineai-oql/IntValue";
import NatValue "mo:caffeineai-oql/NatValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import RecordValue "mo:caffeineai-oql/RecordValue";












actor {
  // Auth & user state
  let profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>;

  // ─────────────────────────────────────────────────────────────────────────
  // GOAL STORAGE — READ THIS BEFORE EDITING
  // ─────────────────────────────────────────────────────────────────────────
  // `goals` uses List (mutable growable arrays). List.add() mutates in place —
  // the binding itself never needs reassignment.
  //
  // `nextGoalId` is a single-element mutable array ([var Nat]) so the Goals
  // module can increment it by reference. It MUST remain [var Nat] — never
  // [Nat].
  // ─────────────────────────────────────────────────────────────────────────
  let goals : List.List<GoalTypes.Goal>;
  let nextGoalId : [var Nat];               // ⚠️ MUST be [var Nat]

  // Check-in state
  let checkIns : List.List<CheckInTypes.CheckIn>;
  let nextCheckInId : [var Nat];

  // Connection state
  let connections : List.List<ConnectionTypes.Connection>;
  let nextConnectionId : [var Nat];

  // Feed & interaction state
  let interactions : List.List<FeedTypes.Interaction>;
  let nextInteractionId : [var Nat];

  // Mixins
  include AuthApi(profiles);
  include GoalsApi(goals, nextGoalId, checkIns, interactions);
  include CheckInsApi(checkIns, goals, nextCheckInId);
  include ConnectionsApi(connections, nextConnectionId);
  include FeedApi(checkIns, goals, profiles, connections, interactions, nextInteractionId);
  include AnalyticsApi(goals, checkIns);
  include ObstacleResolutionApi();
  include PartnerHabitsApi(connections, goals, checkIns, profiles);
  include ApiDocMixin();

  // ─────────────────────────────────────────────────────────────────────────
  // RECURRING AUTO-FAIL TIMER — armed in the actor body so it is re-armed on
  // every install AND every upgrade (enhanced orthogonal persistence runs the
  // actor body on both paths). Fires hourly and auto-fails missed goals for
  // the previous day. Calls the checkins lib directly — no mixin routing.
  // ─────────────────────────────────────────────────────────────────────────
  ignore Timer.recurringTimer<system>(
    #seconds(3600), // every hour
    func() : async () {
      ignore CheckInsLib.autoFailMissedGoals(checkIns, goals, nextCheckInId, profiles, Time.now());
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // OQL SCHEMA REGISTRATION — purely additive.
  // Registers every persisted (non-transient) entity so schema() returns them
  // for read-only analysis by the Data Intelligence agent. No existing
  // endpoints, types, or data are touched.
  //
  // Per-entity authorization:
  //   • UserProfile, Goal, CheckIn — #controllerOrScoped:
  //     the agent (controller) reads all rows for aggregate analysis; a signed-
  //     in user reads only their own rows (owner column). UserProfile hides the
  //     private `email` column.
  //   • Connection, Interaction — #controllerOnly: partner-relationship data
  //     is never exposed to non-controller callers (users keep using the
  //     existing feed/connection endpoints); the agent reads all for fan-out
  //     and concurrency analysis.
  // ─────────────────────────────────────────────────────────────────────────
  transient let anyP : Principal = Principal.fromText("aaaaa-aa");

  include Expose({
    entities = [
      // UserProfile — keyed by Principal in `profiles` Map. Mutable record →
      // manual mode. Owner = id (the user's own principal). `email` is hidden
      // (private); all other fields are public-profile-safe.
      profiles.toEntityManual("userProfile", "UserProfile", "id")
        .sample({
          id = anyP;
          var username = "";
          var displayName = "";
          var avatarShape = null : AuthTypes.AvatarShape;
          var avatarColor = null : AuthTypes.AvatarColor;
          var avatarColorMode = #Fill : AuthTypes.AvatarColorMode;
          var timezone = "";
          var bio = null : ?Text;
          var email = null : ?Text;
          var timezoneOffsetMinutes = 0 : Int;
          var role = #user : Common.UserRole;
          var createdAt = 0 : Common.Timestamp;
        })
        .payload("id", func (u : AuthTypes.UserProfile) : Principal = u.id)
        .payload("username", func (u : AuthTypes.UserProfile) : Text = u.username)
        .payload("displayName", func (u : AuthTypes.UserProfile) : Text = u.displayName)
        .payload("avatarShape", func (u : AuthTypes.UserProfile) : Text = switch (u.avatarShape) { case null ""; case (?s) switch (s) { case (#Triangle) "Triangle"; case (#Square) "Square"; case (#Pentagon) "Pentagon"; case (#Hexagon) "Hexagon"; case (#Star) "Star" } })
        .payload("avatarColor", func (u : AuthTypes.UserProfile) : Text = switch (u.avatarColor) { case null ""; case (?c) c })
        .payload("avatarColorMode", func (u : AuthTypes.UserProfile) : Text = switch (u.avatarColorMode) { case (#Fill) "Fill"; case (#BorderOnly) "BorderOnly" })
        .payload("timezone", func (u : AuthTypes.UserProfile) : Text = u.timezone)
        .payload("bio", func (u : AuthTypes.UserProfile) : Text = switch (u.bio) { case null ""; case (?b) b })
        .payload("timezoneOffsetMinutes", func (u : AuthTypes.UserProfile) : Int = u.timezoneOffsetMinutes)
        .payload("role", func (u : AuthTypes.UserProfile) : Text = switch (u.role) { case (#user) "user"; case (#admin) "admin" })
        .payload("createdAt", func (u : AuthTypes.UserProfile) : Int = u.createdAt)
        .hidden("email")
        .ownedBy("id")
        .controllerOrScoped()
        .build(),

      // Goal — unified storage record for both macro goals (goalId = null)
      // and habits (goalId set to parent macro goal id). Mutable record →
      // manual mode. Owner = owner. goalId is a self-referential edge: on a
      // habit it points to its parent macro goal; on a macro goal it is null.
      // obstacleTemplateId references one of the seven built-in obstacles.
      // scheduledDays is a [Text] collection → exposed as its size.
      // category is goal-level: on a macro goal it is the canonical value;
      // on a habit it mirrors the parent (synced by migration 20260815_120000).
      goals.toEntityManual("goal", "Goal", "id")
        .sample({
          id = 0;
          owner = anyP;
          var goalId = null : ?Common.GoalId;
          var wish = "";
          var wishDescription = "";
          outcome = "";
          obstacleTemplateId = null : ?Common.ObstacleTemplateId;
          var ifThenPlan = "";
          var state = #active : Common.GoalState;
          createdAt = 0 : Common.Timestamp;
          var updatedAt = 0 : Common.Timestamp;
          var iconName = null : ?Text;
          var themeColor = null : ?Text;
          var isLockIn = false;
          var startTime = null : ?Text;
          var endTime = null : ?Text;
          var lastEditedAt = null : ?Common.Timestamp;
          var lockInDurationMinutes = 0;
          var startTimeMinutes = 0;
          var endTimeMinutes = 0;
          var scheduledDays = [] : [Text];
          var category = #Health : GoalTypes.GoalCategory;
        })
        .payload("id", func (g : GoalTypes.Goal) : Nat = g.id)
        .payload("owner", func (g : GoalTypes.Goal) : Principal = g.owner)
        .payload("goalId", func (g : GoalTypes.Goal) : Nat = switch (g.goalId) { case null 0; case (?n) n })
        .edge("goalId", "goal")
        .payload("wish", func (g : GoalTypes.Goal) : Text = g.wish)
        .payload("wishDescription", func (g : GoalTypes.Goal) : Text = g.wishDescription)
        .payload("outcome", func (g : GoalTypes.Goal) : Text = g.outcome)
        .payload("obstacleTemplateId", func (g : GoalTypes.Goal) : Nat = switch (g.obstacleTemplateId) { case null 0; case (?n) n })
        .payload("ifThenPlan", func (g : GoalTypes.Goal) : Text = g.ifThenPlan)
        .payload("state", func (g : GoalTypes.Goal) : Text = switch (g.state) { case (#active) "active"; case (#paused) "paused"; case (#completed) "completed" })
        .payload("createdAt", func (g : GoalTypes.Goal) : Int = g.createdAt)
        .payload("updatedAt", func (g : GoalTypes.Goal) : Int = g.updatedAt)
        .payload("iconName", func (g : GoalTypes.Goal) : Text = switch (g.iconName) { case null ""; case (?n) n })
        .payload("themeColor", func (g : GoalTypes.Goal) : Text = switch (g.themeColor) { case null ""; case (?c) c })
        .payload("isLockIn", func (g : GoalTypes.Goal) : Bool = g.isLockIn)
        .payload("startTime", func (g : GoalTypes.Goal) : Text = switch (g.startTime) { case null ""; case (?t) t })
        .payload("endTime", func (g : GoalTypes.Goal) : Text = switch (g.endTime) { case null ""; case (?t) t })
        .payload("lastEditedAt", func (g : GoalTypes.Goal) : Int = switch (g.lastEditedAt) { case null 0; case (?t) t })
        .payload("lockInDurationMinutes", func (g : GoalTypes.Goal) : Nat = g.lockInDurationMinutes)
        .payload("startTimeMinutes", func (g : GoalTypes.Goal) : Nat = g.startTimeMinutes)
        .payload("endTimeMinutes", func (g : GoalTypes.Goal) : Nat = g.endTimeMinutes)
        .payload("scheduledDaysCount", func (g : GoalTypes.Goal) : Nat = g.scheduledDays.size())
        .payload("category", func (g : GoalTypes.Goal) : Text = switch (g.category) { case (#Health) "Health"; case (#Learning) "Learning"; case (#Social) "Social"; case (#Productivity) "Productivity"; case (#Leisure) "Leisure" })
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),

      // CheckIn — has a variant field (checkInType) and option fields → manual
      // mode. Owner = owner. goalId edges to goal; obstacleTemplateId
      // references one of the seven built-in obstacles.
      checkIns.toEntityManual("checkIn", "CheckIn", "id")
        .sample({
          id = 0;
          goalId = 0;
          owner = anyP;
          checkInType = #success : Common.CheckInType;
          obstacleTemplateId = null : ?Common.ObstacleTemplateId;
          timestamp = 0 : Common.Timestamp;
          lockInStartedAt = null : ?Int;
          lockInEndedAt = null : ?Int;
          executedIfThen = false;
        })
        .payload("id", func (c : CheckInTypes.CheckIn) : Nat = c.id)
        .payload("goalId", func (c : CheckInTypes.CheckIn) : Nat = c.goalId)
        .edge("goalId", "goal")
        .payload("owner", func (c : CheckInTypes.CheckIn) : Principal = c.owner)
        .payload("checkInType", func (c : CheckInTypes.CheckIn) : Text = switch (c.checkInType) { case (#success) "success"; case (#skip) "skip"; case (#inProgress) "inProgress"; case (#missedCheckIn) "missedCheckIn"; case (#missedCheckOut) "missedCheckOut" })
        .payload("obstacleTemplateId", func (c : CheckInTypes.CheckIn) : Nat = switch (c.obstacleTemplateId) { case null 0; case (?n) n })
        .payload("timestamp", func (c : CheckInTypes.CheckIn) : Int = c.timestamp)
        .payload("lockInStartedAt", func (c : CheckInTypes.CheckIn) : Int = switch (c.lockInStartedAt) { case null 0; case (?t) t })
        .payload("lockInEndedAt", func (c : CheckInTypes.CheckIn) : Int = switch (c.lockInEndedAt) { case null 0; case (?t) t })
        .payload("executedIfThen", func (c : CheckInTypes.CheckIn) : Bool = c.executedIfThen)
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),

      // Connection — partner-relationship data. Mutable record (var status) →
      // manual mode. #controllerOnly: never exposed to non-controller callers
      // (users keep using the existing connection endpoints); the agent reads
      // all for partner-feed fan-out analysis.
      connections.toEntityManual("connection", "Connection", "id")
        .sample({
          id = 0;
          fromPrincipal = anyP;
          toPrincipal = anyP;
          var status = #pending : Common.ConnectionStatus;
          createdAt = 0 : Common.Timestamp;
        })
        .payload("id", func (c : ConnectionTypes.Connection) : Nat = c.id)
        .payload("fromPrincipal", func (c : ConnectionTypes.Connection) : Principal = c.fromPrincipal)
        .payload("toPrincipal", func (c : ConnectionTypes.Connection) : Principal = c.toPrincipal)
        .payload("status", func (c : ConnectionTypes.Connection) : Text = switch (c.status) { case (#pending) "pending"; case (#accepted) "accepted"; case (#rejected) "rejected" })
        .payload("createdAt", func (c : ConnectionTypes.Connection) : Int = c.createdAt)
        .controllerOnly()
        .build(),

      // Interaction — feed high-fives. Has a variant field (interactionType)
      // → manual mode. #controllerOnly: partner-relationship data not exposed
      // to non-controller callers; the agent reads all for concurrency and
      // fan-out analysis. checkInId edges to checkIn.
      interactions.toEntityManual("interaction", "Interaction", "id")
        .sample({
          id = 0;
          checkInId = 0;
          fromPrincipal = anyP;
          interactionType = #highFive : Common.InteractionType;
          timestamp = 0 : Common.Timestamp;
        })
        .payload("id", func (i : FeedTypes.Interaction) : Nat = i.id)
        .payload("checkInId", func (i : FeedTypes.Interaction) : Nat = i.checkInId)
        .edge("checkInId", "checkIn")
        .payload("fromPrincipal", func (i : FeedTypes.Interaction) : Principal = i.fromPrincipal)
        .payload("interactionType", func (i : FeedTypes.Interaction) : Text = switch (i.interactionType) { case (#highFive) "highFive" })
        .payload("timestamp", func (i : FeedTypes.Interaction) : Int = i.timestamp)
        .controllerOnly()
        .build(),
    ] : [OqlEntity.Decl]
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEV-ONLY: Full data reset — wipes all canister state so the app behaves
  // as if no user has ever onboarded. NOT a production feature.
  // ─────────────────────────────────────────────────────────────────────────
  public func devReset() : async () {
    profiles.clear();
    goals.clear();
    nextGoalId[0] := 0;
    checkIns.clear();
    nextCheckInId[0] := 0;
    connections.clear();
    nextConnectionId[0] := 0;
    interactions.clear();
    nextInteractionId[0] := 0;
  };
};
