import List "mo:core/List";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import AuthTypes "../types/auth";
import GoalTypes "../types/goals";
import CheckInTypes "../types/checkins";
import ConnectionTypes "../types/connections";
import PartnerHabitTypes "../types/partner-habits";
import PartnerHabitLib "../lib/partner-habits";

/// Partner-habits API — public query endpoints for viewing partners' habits.
///
/// Authorization is enforced in the lib: only accepted, mutual partners
/// receive any habit data. Anonymous callers are rejected at the API layer.
mixin (
  connections : List.List<ConnectionTypes.Connection>,
  goals : List.List<GoalTypes.Goal>,
  checkIns : List.List<CheckInTypes.CheckIn>,
  profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
) {
  /// Returns the full habit detail for a single partner. Returns #notPartner
  /// for any non-partner, pending-only, or unconnected caller — no habit data
  /// leaks.
  public shared query ({ caller }) func getPartnerHabits(
    target : Principal,
  ) : async { #ok : PartnerHabitTypes.PartnerHabitDetail; #err : PartnerHabitTypes.PartnerHabitError } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot view partner habits");
    PartnerHabitLib.getPartnerHabitDetail(connections, profiles, goals, caller, target);
  };

  /// Returns an overview row for every accepted, mutual partner of the
  /// caller. Each row has the partner's profile, active habit count, and
  /// current streak. Pending requests and non-partners are never included.
  public shared query ({ caller }) func listPartnerOverviews() : async [PartnerHabitTypes.PartnerOverview] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot view partner overviews");
    PartnerHabitLib.listPartnerOverviews(connections, profiles, goals, checkIns, caller);
  };
};
