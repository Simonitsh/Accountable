import Common "common";
import GoalTypes "goals";

module {
  /// Request to resolve a built-in obstacle label to a real, reusable obstacle
  /// template for the calling user (find-or-create).
  ///
  /// The label is the built-in obstacle text the user picked (e.g. "Low
  /// Energy"). It is matched against the caller's saved obstacle template
  /// titles case-insensitively. This method does NOT change the six built-in
  /// labels or add new ones — it operates on the label text passed in.
  public type ResolveObstacleRequest = {
    labelText : Text;
  };
};
