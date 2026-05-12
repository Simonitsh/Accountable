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

  // ─────────────────────────────────────────────────────────────────────────
  // GOAL & OBSTACLE STORAGE — READ THIS BEFORE EDITING
  // ─────────────────────────────────────────────────────────────────────────
  // `goals` and `obstacleTemplates` use List (mutable growable arrays).
  // List.add() mutates in place — the binding itself never needs reassignment.
  //
  // `nextGoalId` and `nextObstacleTemplateId` are single-element mutable
  // arrays ([var Nat]) so the Goals module can increment them by reference.
  // They MUST remain [var Nat] — never [Nat].
  // ─────────────────────────────────────────────────────────────────────────
  let goals = List.empty<GoalTypes.Goal>();
  let obstacleTemplates = List.empty<GoalTypes.ObstacleTemplate>();
  let nextGoalId : [var Nat] = [var 0];               // ⚠️ MUST be [var Nat]
  let nextObstacleTemplateId : [var Nat] = [var 0];   // ⚠️ MUST be [var Nat]

  // Check-in state
  let checkIns = List.empty<CheckInTypes.CheckIn>();
  let nextCheckInId : [var Nat] = [var 0];

  // Connection state
  let connections = List.empty<ConnectionTypes.Connection>();
  let nextConnectionId : [var Nat] = [var 0];

  // Feed & interaction state
  let interactions = List.empty<FeedTypes.Interaction>();
  let nextInteractionId : [var Nat] = [var 0];

  // Mixins
  include AuthApi(profiles);
  include GoalsApi(goals, obstacleTemplates, nextGoalId, nextObstacleTemplateId);
  include CheckInsApi(checkIns, goals, nextCheckInId);
  include ConnectionsApi(connections, nextConnectionId);
  include FeedApi(checkIns, goals, profiles, connections, interactions, nextInteractionId);
  include AnalyticsApi(goals, checkIns);

  // ─────────────────────────────────────────────────────────────────────────
  // DEV-ONLY: Full data reset — wipes all canister state so the app behaves
  // as if no user has ever onboarded. NOT a production feature.
  // ─────────────────────────────────────────────────────────────────────────
  public func devReset() : async () {
    profiles.clear();
    goals.clear();
    obstacleTemplates.clear();
    nextGoalId[0] := 0;
    nextObstacleTemplateId[0] := 0;
    checkIns.clear();
    nextCheckInId[0] := 0;
    connections.clear();
    nextConnectionId[0] := 0;
    interactions.clear();
    nextInteractionId[0] := 0;
  };
};
