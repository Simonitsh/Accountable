import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import AuthTypes "../types/auth";

module {
  public func toPublic(profile : AuthTypes.UserProfile) : AuthTypes.UserProfilePublic {
    {
      id = profile.id;
      username = profile.username;
      displayName = profile.displayName;
      avatarEmoji = profile.avatarEmoji;
      timezone = profile.timezone;
      bio = profile.bio;
      email = profile.email;
      role = profile.role;
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
          var bio = null;
          var email = null;
          var role = #user;
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
    bio : ?Text,
    email : ?Text,
  ) : { #ok : AuthTypes.UserProfilePublic; #err : Text } {
    let profile = getOrCreateProfile(profiles, caller);
    switch (displayName) {
      case (?dn) { profile.displayName := dn };
      case null {};
    };
    switch (avatarEmoji) {
      case (?ae) { profile.avatarEmoji := ae };
      case null {};
    };
    switch (bio) {
      case (?b) {
        if (b.size() > 160) return #err("Bio cannot exceed 160 characters");
        profile.bio := ?b;
      };
      case null {};
    };
    switch (email) {
      case (?e) {
        if (e.size() > 254) return #err("Email cannot exceed 254 characters");
        profile.email := ?e;
      };
      case null {};
    };
    #ok(toPublic(profile));
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
