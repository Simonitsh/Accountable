import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import AuthTypes "../types/auth";
import AuthLib "../lib/auth";

mixin (
  profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
) {
  public shared ({ caller }) func register(username : Text) : async AuthTypes.UserProfilePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous callers cannot register");
    // Enforce username uniqueness (excluding the caller's own principal in case of re-registration)
    if (not AuthLib.isUsernameAvailableForCaller(profiles, username, caller)) {
      Runtime.trap("Username is already taken. Please choose a different username.");
    };
    let profile = AuthLib.getOrCreateProfile(profiles, caller);
    profile.username := username;
    AuthLib.toPublic(profile);
  };

  public shared ({ caller }) func updateMyProfile(displayName : ?Text, avatarEmoji : ?Text) : async AuthTypes.UserProfilePublic {
    AuthLib.updateProfile(profiles, caller, displayName, avatarEmoji);
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
