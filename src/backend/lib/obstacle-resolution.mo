import Runtime "mo:core/Runtime";
import GoalTypes "../types/goals";

/// Obstacle resolution — pure domain logic module.
///
/// Resolves a built-in obstacle label (e.g. "Low Energy", "Time Crunch") to
/// one of the seven fixed built-in obstacles. Obstacles are locked down to
/// exactly those seven values — this function NEVER creates a new obstacle for
/// arbitrary text. It matches the label case-insensitively against the fixed
/// built-in list and returns the matching built-in, or traps if the label is
/// not one of the seven.
module {
  /// Request to resolve an obstacle label to a built-in obstacle.
  public type ResolveObstacleRequest = {
    labelText : Text;
  };

  /// Resolves `request.labelText` to one of the seven built-in obstacles.
  /// The match is case-insensitive on the built-in title. If the label is not
  /// one of the seven built-ins, the call traps — a custom obstacle can never
  /// be created. Returns the matching built-in `ObstacleTemplate` with its
  /// stable id.
  public func resolveObstacleLabel(
    request : ResolveObstacleRequest,
  ) : GoalTypes.ObstacleTemplate {
    let labelLower = request.labelText.toLower();
    switch (GoalTypes.builtinObstacles().find(func(t : GoalTypes.ObstacleTemplate) : Bool {
      t.title.toLower() == labelLower;
    })) {
      case (?builtin) builtin;
      case null Runtime.trap("Unknown obstacle label: \"" # request.labelText # "\" — only the seven built-in obstacles are allowed");
    };
  };
};
