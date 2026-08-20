import List "mo:core/List";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Common "../types/common";
import AuthTypes "../types/auth";
import GoalTypes "../types/goals";
import CheckInTypes "../types/checkins";
import ConnectionTypes "../types/connections";
import PartnerHabitTypes "../types/partner-habits";
import ConnectionLib "connections";
import AuthLib "auth";
import GoalLib "goals";

/// Partner-habits — pure domain logic module.
///
/// All functions are stateless: they receive the relevant stores from the
/// caller. Authorization is enforced here — non-partners never receive habit
/// data. Reuses ConnectionLib.getAcceptedPartnerIds so the partner set is
/// always the accepted, mutual partner set.
module {
  // 86400 seconds in nanoseconds
  let DAY_NS : Int = 86_400_000_000_000;

  /// Returns true iff `target` is an accepted, mutual partner of `caller`.
  /// Reuses ConnectionLib.getAcceptedPartnerIds — no leaking to pending or
  /// non-partners.
  public func isAcceptedPartner(
    connections : List.List<ConnectionTypes.Connection>,
    caller : Common.UserId,
    target : Common.UserId,
  ) : Bool {
    let partnerIds = ConnectionLib.getAcceptedPartnerIds(connections, caller);
    partnerIds.find(func(p) { p == target }) != null;
  };

  /// Returns the public profile of `target` if it exists, else null.
  /// Uses the email-stripping safe variant so accepted partners never
  /// receive each other's email via the partner exposure paths
  /// (getPartnerHabitDetail, listPartnerOverviews).
  public func getPublicProfile(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    target : Common.UserId,
  ) : ?AuthTypes.UserProfilePublic {
    AuthLib.getUserProfilePublicSafe(profiles, target);
  };

  /// Returns all active habits owned by `target`, mapped to HabitPublic.
  /// Only habits (goalId set) are returned — macro goals (goalId null) are
  /// containers and are not surfaced as partner habits.
  public func listActiveHabits(
    goals : List.List<GoalTypes.Goal>,
    target : Common.UserId,
  ) : [GoalTypes.HabitPublic] {
    goals.values().filter(func(g) {
      g.owner == target and g.state == #active and g.goalId != null
    }).map(func(g) { GoalLib.toHabitPublic(g) }).toArray();
  };

  /// Derives the day-of-week abbreviation ("mon".."sun") from a nanosecond
  /// timestamp in UTC. Unix epoch (1970-01-01) was a Thursday (index 4).
  /// Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  func dayOfWeekAbbrUtc(timestampNs : Int) : Text {
    let daysSinceEpoch : Int = timestampNs / DAY_NS;
    let raw : Int = Int.rem(4 + daysSinceEpoch, 7);
    let idx : Int = if (raw < 0) { raw + 7 } else { raw };
    switch (idx) {
      case 0 "sun";
      case 1 "mon";
      case 2 "tue";
      case 3 "wed";
      case 4 "thu";
      case 5 "fri";
      case 6 "sat";
      case _ "mon"; // unreachable
    };
  };

  /// Returns true iff `dayAbbr` is in `scheduledDays`.
  func isScheduledDay(dayAbbr : Text, scheduledDays : [Text]) : Bool {
    scheduledDays.find(func(d) { d == dayAbbr }) != null;
  };

  /// Computes the current streak for `target` across all their active goals.
  ///
  /// Walks backward in UTC days from today. For each day:
  ///   - if the day is NOT scheduled for any of the target's active goals,
  ///     skip it (rest day — does not break the streak);
  ///   - if the day IS scheduled, it counts toward the streak only if at
  ///     least one of the target's active goals has a #success check-in on
  ///     that UTC day. The first scheduled day without a success breaks the
  ///     streak.
  /// Streak is capped at 365 days to bound the walk.
  public func computeCurrentStreak(
    checkIns : List.List<CheckInTypes.CheckIn>,
    goals : List.List<GoalTypes.Goal>,
    target : Common.UserId,
  ) : Nat {
    let activeGoals = goals.values().filter(func(g) {
      g.owner == target and g.state == #active
    }).toArray();
    // No active goals → no streak.
    if (activeGoals.size() == 0) return 0;
    // Pre-extract the goal IDs and scheduled-day sets for fast lookup.
    let goalIds : [Common.GoalId] = activeGoals.map(
      func(g) { g.id },
    );
    let scheduledDaysPerGoal : [[Text]] = activeGoals.map(
      func(g) { g.scheduledDays },
    );
    // Pre-filter check-ins to #success records owned by target for any active goal.
    let successCheckIns : [CheckInTypes.CheckIn] = checkIns.values().filter(func(c) {
      c.owner == target and c.checkInType == #success and
      goalIds.find(func(id) { id == c.goalId }) != null
    }).toArray();

    let nowNs : Int = Time.now();
    let todayStartNs : Int = (nowNs / DAY_NS) * DAY_NS;
    var streak : Nat = 0;
    var dayOffset : Int = 0;
    label walk while (dayOffset < 365) {
      let dayStartNs : Int = todayStartNs - (dayOffset * DAY_NS);
      let dayEndNs : Int = dayStartNs + DAY_NS;
      let dayAbbr : Text = dayOfWeekAbbrUtc(dayStartNs);
      // Is this day scheduled for ANY of the target's active goals?
      var dayScheduled : Bool = false;
      for (days in scheduledDaysPerGoal.vals()) {
        if (not dayScheduled) {
          if (isScheduledDay(dayAbbr, days)) { dayScheduled := true };
        };
      };
      if (dayScheduled) {
        // Need at least one #success check-in on this UTC day.
        let hadSuccess : Bool = successCheckIns.find(func(c) {
          c.timestamp >= dayStartNs and c.timestamp < dayEndNs
        }) != null;
        if (hadSuccess) {
          streak += 1;
          dayOffset += 1;
        } else {
          // Scheduled day with no success → streak broken.
          break walk;
        };
      } else {
        // Rest day — skip without breaking the streak.
        dayOffset += 1;
      };
    };
    streak;
  };

  /// Auth-gated partner habit detail. Returns #notPartner if `caller` and
  /// `target` are not accepted mutual partners. Returns #profileNotFound if
  /// the partner has no profile. Otherwise returns the partner's profile plus
  /// their active habits.
  public func getPartnerHabitDetail(
    connections : List.List<ConnectionTypes.Connection>,
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    goals : List.List<GoalTypes.Goal>,
    caller : Common.UserId,
    target : Common.UserId,
  ) : { #ok : PartnerHabitTypes.PartnerHabitDetail; #err : PartnerHabitTypes.PartnerHabitError } {
    if (not isAcceptedPartner(connections, caller, target)) {
      return #err(#notPartner);
    };
    switch (getPublicProfile(profiles, target)) {
      case null { return #err(#profileNotFound) };
      case (?profile) {
        let habits = listActiveHabits(goals, target);
        #ok({ profile; habits });
      };
    };
  };

  /// Returns an overview row for every accepted, mutual partner of `caller`.
  /// Each row includes the partner's public profile, their active habit
  /// count, and their current streak. Pending requests and non-partners are
  /// never included.
  public func listPartnerOverviews(
    connections : List.List<ConnectionTypes.Connection>,
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    goals : List.List<GoalTypes.Goal>,
    checkIns : List.List<CheckInTypes.CheckIn>,
    caller : Common.UserId,
  ) : [PartnerHabitTypes.PartnerOverview] {
    let partnerIds = ConnectionLib.getAcceptedPartnerIds(connections, caller);
    let out = List.empty<PartnerHabitTypes.PartnerOverview>();
    for (partnerId in partnerIds.vals()) {
      switch (getPublicProfile(profiles, partnerId)) {
        case (?profile) {
          let habits = listActiveHabits(goals, partnerId);
          let activeHabitCount : Nat = habits.size();
          let currentStreak : Nat = computeCurrentStreak(checkIns, goals, partnerId);
          out.add({ profile; activeHabitCount; currentStreak });
        };
        case null {
          // Partner without a profile — skip silently. No overview row.
        };
      };
    };
    out.toArray();
  };
};
