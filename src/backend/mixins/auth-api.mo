import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import AuthTypes "../types/auth";
import AuthLib "../lib/auth";

mixin (
  profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
) {
  public shared ({ caller }) func register(username : Text) : async AuthTypes.UserProfilePublic {
    if (username == "") { Runtime.trap("Username cannot be empty") };
    if (not AuthLib.isUsernameAvailable(profiles, username)) {
      Runtime.trap("Username already taken");
    };
    let profile = AuthLib.getOrCreateProfile(profiles, caller);
    profile.username := username;
    profile.displayName := username;
    AuthLib.toPublic(profile);
  };

  public shared ({ caller }) func updateMyProfile(
    displayName : ?Text,
    avatarShape : AuthTypes.AvatarShape,
    avatarColor : AuthTypes.AvatarColor,
    avatarColorMode : ?AuthTypes.AvatarColorMode,
    bio : ?Text,
    email : ?Text,
    timezoneOffsetMinutes : ?Int,
  ) : async { #ok : AuthTypes.UserProfilePublic; #err : Text } {
    AuthLib.updateProfile(
      profiles,
      caller,
      displayName,
      avatarShape,
      avatarColor,
      avatarColorMode,
      bio,
      email,
      timezoneOffsetMinutes,
    );
  };

  public shared query ({ caller }) func isUsernameAvailable(username : Text) : async Bool {
    AuthLib.isUsernameAvailableForCaller(profiles, username, caller);
  };

  public shared query ({ caller }) func getMyProfile() : async AuthTypes.UserProfilePublic {
    AuthLib.toPublic(AuthLib.ensureRegistered(profiles, caller));
  };

  public shared query ({ caller }) func getUserProfile(target : Common.UserId) : async ?AuthTypes.UserProfilePublic {
    AuthLib.getUserProfilePublic(profiles, target);
  };

  public shared ({ caller }) func setTimezone(tz : Text) : async () {
    AuthLib.setTimezone(profiles, caller, tz);
  };

  public shared query ({ caller }) func listAllUsers() : async [AuthTypes.UserProfilePublic] {
    AuthLib.listAllUsers(profiles);
  };
};
