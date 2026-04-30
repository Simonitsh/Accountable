import Map "mo:core/Map";
import List "mo:core/List";
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



actor {
  // Auth & user state
  let profiles = Map.empty<Common.UserId, AuthTypes.UserProfile>();
  var auditLog = List.empty<AuthTypes.AdminAuditEntry>();

  // ─────────────────────────────────────────────────────────────────────────
  // GOAL & OBSTACLE STORAGE — READ THIS BEFORE EDITING
  // ─────────────────────────────────────────────────────────────────────────
  // `goals` and `obstacleTemplates` MUST stay as `var`.
  // Changing them to `let` will silently discard every goal on each call.
  // This bug has occurred twice — do not remove this warning.
  //
  // `nextGoalId` and `nextObstacleTemplateId` are single-element mutable
  // arrays ([var Nat]) so the Goals module can increment them by reference.
  // They MUST remain [var Nat] — never [Nat].
  // ─────────────────────────────────────────────────────────────────────────
  var goals = List.empty<GoalTypes.Goal>();            // ⚠️ MUST be `var`
  var obstacleTemplates = List.empty<GoalTypes.ObstacleTemplate>(); // ⚠️ MUST be `var`
  let nextGoalId : [var Nat] = [var 0];               // ⚠️ MUST be [var Nat]
  let nextObstacleTemplateId : [var Nat] = [var 0];   // ⚠️ MUST be [var Nat]

  // Check-in state
  var checkIns = List.empty<CheckInTypes.CheckIn>();
  let nextCheckInId : [var Nat] = [var 0];

  // Connection state
  var connections = List.empty<ConnectionTypes.Connection>();
  let nextConnectionId : [var Nat] = [var 0];

  // Feed & interaction state
  var interactions = List.empty<FeedTypes.Interaction>();
  let nextInteractionId : [var Nat] = [var 0];

  // Mixins
  include AuthApi(profiles, auditLog);
  include GoalsApi(goals, obstacleTemplates, profiles, nextGoalId, nextObstacleTemplateId);
  include CheckInsApi(checkIns, goals, nextCheckInId);
  include ConnectionsApi(connections, nextConnectionId);
  include FeedApi(checkIns, goals, profiles, connections, interactions, nextInteractionId);
  include AnalyticsApi(goals, checkIns);
};
