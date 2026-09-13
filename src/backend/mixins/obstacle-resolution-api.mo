import List "mo:core/List";
import Runtime "mo:core/Runtime";
import GoalTypes "../types/goals";
import ObstacleResolution "../lib/obstacle-resolution";

/// Obstacle Resolution API Mixin — public canister interface for resolving a
/// built-in obstacle label to a real, reusable obstacle template for the
/// calling user (find-or-create).
///
/// The mixin receives the shared `obstacleTemplates` List and the
/// `nextObstacleTemplateId` counter from main.mo. It delegates to the
/// obstacle-resolution lib for the find-or-create logic and increments the
/// counter only when a genuinely new template is created.
mixin (
  obstacleTemplates : List.List<GoalTypes.ObstacleTemplate>,
  nextObstacleTemplateId : [var Nat],
) {
  /// Resolves a built-in obstacle label to a reusable obstacle template owned
  /// by the caller. Searches the caller's existing templates for one whose
  /// title matches `request.labelText` case-insensitively and returns it; if
  /// none exists, creates a new ObstacleTemplate for that label (owner =
  /// caller) and returns it. The first pick creates a record; every later pick
  /// of the same label reuses the same one. Owner-scoped — only the caller's
  /// own templates are searched or created. Never modifies or repairs
  /// previously saved habits or check-ins.
  public shared ({ caller }) func resolveObstacleLabel(request : ObstacleResolution.ResolveObstacleRequest) : async GoalTypes.ObstacleTemplate {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot resolve obstacle labels");
    let template = ObstacleResolution.resolveObstacleLabel(obstacleTemplates, nextObstacleTemplateId[0], caller, request);
    // A newly created template is assigned the current counter value; an
    // existing (reused) template has a smaller id. Increment only on creation.
    if (template.id == nextObstacleTemplateId[0]) {
      nextObstacleTemplateId[0] += 1;
    };
    template;
  };
};
