import List "mo:core/List";
import Common "../types/common";
import GoalTypes "../types/goals";

/// Obstacle resolution — pure domain logic module.
///
/// Resolves a built-in obstacle label (e.g. "Low Energy", "Time Crunch") to a
/// real, reusable obstacle template owned by the calling user. This is the
/// find-or-create pattern: the first time a user picks a given label it becomes
/// a saved ObstacleTemplate record for them; every later pick of the same label
/// reuses that same record instead of creating a duplicate.
///
/// The match is case-insensitive on the template title, so picking "low energy"
/// reuses a previously saved "Low Energy" template. The six built-in labels are
/// never changed or extended here — the function operates purely on the label
/// text passed in. It never modifies or repairs previously saved habits or
/// check-ins.
module {
  /// Request to resolve an obstacle label to a reusable template.
  public type ResolveObstacleRequest = {
    labelText : Text;
  };

  /// Finds the caller's existing obstacle template whose title matches
  /// `request.labelText` case-insensitively and returns it. If none exists,
  /// creates a new ObstacleTemplate for that label (owner = caller) and returns
  /// it.
  ///
  /// `nextId` is the current value of the caller's obstacle-template id counter;
  /// a newly created template is assigned this id. The caller (mixin) is
  /// responsible for incrementing the counter only when a new template was
  /// actually created.
  public func resolveObstacleLabel(
    templates : List.List<GoalTypes.ObstacleTemplate>,
    nextId : Common.ObstacleTemplateId,
    caller : Common.UserId,
    request : ResolveObstacleRequest,
  ) : GoalTypes.ObstacleTemplate {
    let labelLower = request.labelText.toLower();
    switch (templates.find(func(t : GoalTypes.ObstacleTemplate) : Bool {
      t.owner == caller and t.title.toLower() == labelLower;
    })) {
      case (?existing) existing;
      case null {
        let template : GoalTypes.ObstacleTemplate = {
          id = nextId;
          owner = caller;
          title = request.labelText;
          description = "";
        };
        templates.add(template);
        template;
      };
    };
  };
};
