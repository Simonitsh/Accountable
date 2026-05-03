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
      displayName = profile.displayName;
      avatarEmoji = profile.avatarEmoji;
      timezone = profile.timezone;
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
          var displayName = "";
          var avatarEmoji = "";
          var timezone = "";
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

  /// Check username availability (case-insensitive, min 2 chars).
  /// Returns true if the username is free to use.
  public func isUsernameAvailable(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    username : Text,
  ) : Bool {
    if (username.size() < 2) return false;
    let lower = username.toLower();
    for (profile in profiles.values()) {
      if (profile.username.toLower() == lower) return false;
    };
    true;
  };

  /// Check username availability excluding a specific principal (for re-registration).
  public func isUsernameAvailableForCaller(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    username : Text,
    excludeId : Common.UserId,
  ) : Bool {
    if (username.size() < 2) return false;
    let lower = username.toLower();
    for ((id, profile) in profiles.entries()) {
      if (id != excludeId and profile.username.toLower() == lower) return false;
    };
    true;
  };

  public func updateProfile(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
    displayName : ?Text,
    avatarEmoji : ?Text,
  ) : AuthTypes.UserProfilePublic {
    let profile = getOrCreateProfile(profiles, caller);
    switch (displayName) {
      case (?dn) { profile.displayName := dn };
      case null {};
    };
    switch (avatarEmoji) {
      case (?ae) { profile.avatarEmoji := ae };
      case null {};
    };
    toPublic(profile);
  };

  public func setTimezone(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
    tz : Text,
  ) : () {
    let profile = ensureRegistered(profiles, caller);
    profile.timezone := tz;
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
