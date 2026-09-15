import Runtime "mo:core/Runtime";
import GoalTypes "../types/goals";
import ObstacleResolution "../lib/obstacle-resolution";

/// Obstacle Resolution API Mixin — public canister interface for resolving a
/// built-in obstacle label to one of the seven fixed built-in obstacles.
///
/// Obstacles are locked down to exactly seven built-in values. This endpoint
/// never creates a new obstacle — it validates the label against the fixed
/// built-in list and returns the matching built-in, or traps if the label is
/// not one of the seven.
mixin () {
  /// Resolves a built-in obstacle label to one of the seven fixed built-in
  /// obstacles. The match is case-insensitive on the built-in title. If the
  /// label is not one of the seven built-ins, the call traps — a custom
  /// obstacle can never be created. Returns the matching built-in
  /// `ObstacleTemplate` with its stable id.
  public shared ({ caller }) func resolveObstacleLabel(request : ObstacleResolution.ResolveObstacleRequest) : async GoalTypes.ObstacleTemplate {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot resolve obstacle labels");
    ObstacleResolution.resolveObstacleLabel(request);
  };
};
