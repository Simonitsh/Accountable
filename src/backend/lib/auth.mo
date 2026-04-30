import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import AuthTypes "../types/auth";

module {
  public func tierGoalLimit(tier : Common.SubscriptionTier) : Nat {
    switch tier {
      case (#tier1) 3;
      case (#tier2) 10;
      case (#tier3) 25;
    };
  };

  public func getGoalLimit(profile : AuthTypes.UserProfile) : Nat {
    switch (profile.customGoalLimit) {
      case (?custom) custom;
      case null tierGoalLimit(profile.tier);
    };
  };

  public func toPublic(profile : AuthTypes.UserProfile) : AuthTypes.UserProfilePublic {
    {
      id = profile.id;
      username = profile.username;
      role = profile.role;
      tier = profile.tier;
      goalLimit = getGoalLimit(profile);
    };
  };

  public func getOrCreateProfile(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
  ) : AuthTypes.UserProfile {
    switch (profiles.get(caller)) {
      case (?existing) existing;
      case null {
        let newProfile : AuthTypes.UserProfile = {
          id = caller;
          var username = caller.toText();
          var role = #user;
          var tier = #tier1;
          var customGoalLimit = null;
          var createdAt = Time.now();
        };
        profiles.add(caller, newProfile);
        newProfile;
      };
    };
  };

  public func ensureRegistered(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
  ) : AuthTypes.UserProfile {
    switch (profiles.get(caller)) {
      case (?p) p;
      case null Runtime.trap("Not registered");
    };
  };

  public func isAdmin(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
  ) : Bool {
    switch (profiles.get(caller)) {
      case (?p) p.role == #admin;
      case null false;
    };
  };

  public func setUserGoalLimit(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    auditLog : List.List<AuthTypes.AdminAuditEntry>,
    caller : Common.UserId,
    target : Common.UserId,
    limit : Nat,
  ) : () {
    if (not isAdmin(profiles, caller)) {
      Runtime.trap("Unauthorized: admin only");
    };
    let profile = switch (profiles.get(target)) {
      case (?p) p;
      case null Runtime.trap("Target user not found");
    };
    profile.customGoalLimit := ?limit;
    auditLog.add({
      targetPrincipal = target;
      setBy = caller;
      limit = limit;
      timestamp = Time.now();
    });
  };

  public func getUserProfilePublic(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    target : Common.UserId,
  ) : ?AuthTypes.UserProfilePublic {
    switch (profiles.get(target)) {
      case (?p) ?toPublic(p);
      case null null;
    };
  };

  public func listAllUsers(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
  ) : [AuthTypes.UserProfilePublic] {
    profiles.values().map<AuthTypes.UserProfile, AuthTypes.UserProfilePublic>(
      func(p) { toPublic(p) }
    ).toArray();
  };
};
