import Common "common";
import AuthTypes "auth";
import GoalTypes "goals";

module {
  /// Typed error variants for partner-habit lookups.
  public type PartnerHabitError = {
    #notPartner;
    #profileNotFound;
  };

  /// Full habit detail for a single partner — profile plus their active habits.
  public type PartnerHabitDetail = {
    profile : AuthTypes.UserProfilePublic;
    habits : [GoalTypes.HabitPublic];
  };

  /// Summary row for the partner-overview list — profile plus aggregate counts.
  public type PartnerOverview = {
    profile : AuthTypes.UserProfilePublic;
    activeHabitCount : Nat;
    currentStreak : Nat;
  };
};
