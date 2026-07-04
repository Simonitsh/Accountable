import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import AuthTypes "../types/auth";
import AuthLib "../lib/auth";

mixin (
  profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
) {
  public shared ({ caller }) func register(username : Text, avatarArchetype : Text) : async AuthTypes.UserProfilePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot register");
    if (not AuthTypes.isValidArchetype(avatarArchetype)) {
      Runtime.trap("Invalid avatarArchetype. Must be one of: Oak, River, Wolf, Owl, Mountain, Fire, Bamboo, Honeycomb, Wind, Tide");
    };
    // Enforce username uniqueness (excluding the caller's own principal in case of re-registration)
    if (not AuthLib.isUsernameAvailableForCaller(profiles, username, caller)) {
      Runtime.trap("Username is already taken. Please choose a different username.");
    };
    let profile = AuthLib.getOrCreateProfile(profiles, caller);
    profile.username := username;
    profile.avatarArchetype := avatarArchetype;
    AuthLib.toPublic(profile);
  };

  public shared ({ caller }) func updateMyProfile(
    displayName : ?Text,
    avatarArchetype : ?Text,
    bio : ?Text,
    email : ?Text,
    timezoneOffsetMinutes : ?Int,
  ) : async { #ok : AuthTypes.UserProfilePublic; #err : Text } {
    AuthLib.updateProfile(profiles, caller, displayName, avatarArchetype, bio, email, timezoneOffsetMinutes);
  };

  public shared query ({ caller }) func isUsernameAvailable(username : Text) : async Bool {
    AuthLib.isUsernameAvailable(profiles, username);
  };

  public shared query ({ caller }) func getMyProfile() : async AuthTypes.UserProfilePublic {
    let profile = AuthLib.ensureRegistered(profiles, caller);
    AuthLib.toPublic(profile);
  };

  public shared query ({ caller }) func getUserProfile(target : Common.UserId) : async ?AuthTypes.UserProfilePublic {
    // Admin can look up any profile; regular users can only look up their own
    if (AuthLib.isAdmin(profiles, caller) or caller == target) {
      AuthLib.getUserProfilePublic(profiles, target);
    } else {
      null;
    };
  };

  public shared ({ caller }) func setTimezone(tz : Text) : async () {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot set timezone");
    AuthLib.setTimezone(profiles, caller, tz);
  };

  public shared query ({ caller }) func listAllUsers() : async [AuthTypes.UserProfilePublic] {
    if (not AuthLib.isAdmin(profiles, caller)) Runtime.trap("Unauthorized: admin only");
    AuthLib.listAllUsers(profiles);
  };
};
