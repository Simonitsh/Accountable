import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Option "mo:core/Option";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Char "mo:core/Char";
import Int "mo:core/Int";
import Common "../types/common";
import AuthTypes "../types/auth";
import AdminConfig "admin";

module {
  /// Approved avatar base colors. A user-supplied color must fall within ±30
  /// per RGB channel of one of these seven anchors.
  let baseColors : [(Nat, Nat, Nat)] = [
    (0x10, 0xB9, 0x81), // #10B981 emerald
    (0x03, 0x69, 0xA1), // #0369A1 ocean
    (0xF5, 0x9E, 0x0B), // #F59E0B amber
    (0x8B, 0x5C, 0xF6), // #8B5CF6 violet
    (0xEC, 0x48, 0x99), // #EC4899 pink
    (0xEF, 0x44, 0x44), // #EF4444 red
    (0xEA, 0xB3, 0x08), // #EAB308 yellow
  ];

  /// Parse a single hex character to its 0–15 value. Returns -1 on invalid.
  func hexDigit(c : Char) : Int {
    let code : Nat = c.toNat32().toNat();
    if (code >= 0x30 and code <= 0x39) { code - 0x30 } // 0-9
    else if (code >= 0x41 and code <= 0x46) { code - 0x41 + 10 } // A-F
    else if (code >= 0x61 and code <= 0x66) { code - 0x61 + 10 } // a-f
    else { -1 };
  };

  /// Parse a 2-char hex byte. Returns -1 on invalid input.
  func hexByte(h : Char, l : Char) : Int {
    let hi = hexDigit(h);
    let lo = hexDigit(l);
    if (hi < 0 or lo < 0) { -1 } else { hi * 16 + lo };
  };

  /// Validate that `color` is a 6-digit hex code of the form "#RRGGBB".
  /// Returns the (r, g, b) triple on success, or null on failure.
  func parseHexColor(color : Text) : ?(Nat, Nat, Nat) {
    let cs : [Char] = Array.fromIter(Text.toIter(color));
    if (cs.size() != 7) { return null };
    if (cs[0] != '#') { return null };
    let r = hexByte(cs[1], cs[2]);
    let g = hexByte(cs[3], cs[4]);
    let b = hexByte(cs[5], cs[6]);
    if (r < 0 or g < 0 or b < 0) { return null };
    ?(Int.abs(r), Int.abs(g), Int.abs(b));
  };

  /// Returns true iff `color` is a valid hex code within ±30 per RGB channel
  /// of one of the five approved base colors.
  public func isValidAvatarColor(color : Text) : Bool {
    switch (parseHexColor(color)) {
      case null { false };
      case (?(r, g, b)) {
        var ok = false;
        for (base in baseColors.vals()) {
          if (not ok) {
            let (br, bg, bb) = base;
            let dr = if (r >= br) { r - br } else { br - r };
            let dg = if (g >= bg) { g - bg } else { bg - g };
            let db = if (b >= bb) { b - bb } else { bb - b };
            if (dr <= 30 and dg <= 30 and db <= 30) { ok := true };
          };
        };
        ok;
      };
    };
  };

  /// Returns true iff `shape` is one of the five approved shapes.
  public func isValidAvatarShape(shape : AuthTypes.AvatarShape) : Bool {
    switch (shape) {
      case null { true }; // null is always valid (default)
      case (?s) {
        switch (s) {
          case (#Triangle) { true };
          case (#Square) { true };
          case (#Pentagon) { true };
          case (#Hexagon) { true };
          case (#Star) { true };
        };
      };
    };
  };

  /// Returns true iff `mode` is one of the two approved color modes.
  public func isValidAvatarColorMode(mode : AuthTypes.AvatarColorMode) : Bool {
    switch (mode) {
      case (#Fill) { true };
      case (#BorderOnly) { true };
    };
  };

  public func toPublic(profile : AuthTypes.UserProfile) : AuthTypes.UserProfilePublic {
    {
      id = profile.id;
      username = profile.username;
      displayName = profile.displayName;
      avatarShape = profile.avatarShape;
      avatarColor = profile.avatarColor;
      avatarColorMode = profile.avatarColorMode;
      timezone = profile.timezone;
      bio = profile.bio;
      email = profile.email;
      timezoneOffsetMinutes = profile.timezoneOffsetMinutes;
      role = profile.role;
    };
  };

  /// Defense-in-depth variant of toPublic() that strips the email field.
  /// Use this for any endpoint that does not need to expose email. The
  /// existing toPublic() (with email) stays for the admin-only listAllUsers
  /// and the owner-or-admin getUserProfile paths.
  public func toPublicSafe(profile : AuthTypes.UserProfile) : AuthTypes.UserProfilePublic {
    {
      id = profile.id;
      username = profile.username;
      displayName = profile.displayName;
      avatarShape = profile.avatarShape;
      avatarColor = profile.avatarColor;
      avatarColorMode = profile.avatarColorMode;
      timezone = profile.timezone;
      bio = profile.bio;
      email = null;
      timezoneOffsetMinutes = profile.timezoneOffsetMinutes;
      role = profile.role;
    };
  };

  public func getOrCreateProfile(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
  ) : AuthTypes.UserProfile {
    switch (profiles.get(caller)) {
      case (?p) { p };
      case null {
        // Onboarding default: avatarShape = null, avatarColor = null,
        // avatarColorMode = #Fill.
        let profile : AuthTypes.UserProfile = {
          id = caller;
          var username = "";
          var displayName = "";
          var avatarShape = null;
          var avatarColor = null;
          var avatarColorMode = #Fill;
          var timezone = "UTC";
          var bio = null;
          var email = null;
          var timezoneOffsetMinutes = 0;
          var role = #user;
          var createdAt = Time.now();
        };
        profiles.add(caller, profile);
        profile;
      };
    };
  };

  public func isUsernameAvailable(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    username : Text,
  ) : Bool {
    if (username == "") { return false };
    let lower = Text.toLower(username);
    var available = true;
    for ((_, p) in profiles.entries()) {
      if (available and Text.toLower(p.username) == lower) { available := false };
    };
    available;
  };

  public func isUsernameAvailableForCaller(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    username : Text,
    excludeId : Common.UserId,
  ) : Bool {
    if (username == "") { return false };
    let lower = Text.toLower(username);
    var available = true;
    for ((id, p) in profiles.entries()) {
      if (available and id != excludeId and Text.toLower(p.username) == lower) {
        available := false;
      };
    };
    available;
  };

  public func updateProfile(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
    displayName : ?Text,
    avatarShape : AuthTypes.AvatarShape,
    avatarColor : AuthTypes.AvatarColor,
    avatarColorMode : ?AuthTypes.AvatarColorMode,
    bio : ?Text,
    email : ?Text,
    timezoneOffsetMinutes : ?Int,
  ) : { #ok : AuthTypes.UserProfilePublic; #err : Text } {
    // Validate avatar shape.
    if (not isValidAvatarShape(avatarShape)) {
      return #err("Invalid avatar shape");
    };
    // Validate avatar color: a non-null color must be an approved base color.
    switch (avatarColor) {
      case null { /* no color selected — valid */ };
      case (?c) {
        if (not isValidAvatarColor(c)) {
          return #err("Invalid avatar color");
        };
      };
    };
    // Validate avatar color mode when supplied.
    switch (avatarColorMode) {
      case null { /* keep existing mode */ };
      case (?m) {
        if (not isValidAvatarColorMode(m)) {
          return #err("Invalid avatar color mode");
        };
      };
    };
    // Look up the caller's profile.
    switch (profiles.get(caller)) {
      case null { return #err("Profile not found — register first") };
      case (?p) {
        // Apply displayName.
        switch (displayName) {
          case null { /* keep existing */ };
          case (?n) { p.displayName := n };
        };
        // Apply avatar fields.
        p.avatarShape := avatarShape;
        p.avatarColor := avatarColor;
        switch (avatarColorMode) {
          case null { /* keep existing mode */ };
          case (?m) { p.avatarColorMode := m };
        };
        // Apply bio, email, timezoneOffsetMinutes.
        p.bio := bio;
        p.email := email;
        switch (timezoneOffsetMinutes) {
          case null { /* keep existing */ };
          case (?o) { p.timezoneOffsetMinutes := o };
        };
        #ok(toPublic(p));
      };
    };
  };

  public func setTimezone(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
    tz : Text,
  ) : () {
    switch (profiles.get(caller)) {
      case (?p) { p.timezone := tz };
      case null { Runtime.trap("Profile not found") };
    };
  };

  public func ensureRegistered(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
  ) : AuthTypes.UserProfile {
    switch (profiles.get(caller)) {
      case (?p) { p };
      case null { Runtime.trap("Profile not found — register first") };
    };
  };

  /// Promotes the caller to `#admin` if their Principal is in the hardcoded
  /// admin list (see `lib/admin.mo`) and their stored role is not already
  /// `#admin`. Idempotent: a no-op for non-admin Principals and for users
  /// who are already admins. Called from both `register()` (after
  /// `getOrCreateProfile`) and `getMyProfile()` (after `ensureRegistered`)
  /// so existing users get re-promoted on every sign-in without a migration.
  /// This is what makes admin promotion work in both draft and live.
  public func ensureAdminRole(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
  ) : () {
    if (not AdminConfig.isAdminPrincipal(caller)) { return };
    switch (profiles.get(caller)) {
      case (?p) {
        if (p.role != #admin) { p.role := #admin };
      };
      case null { /* no profile yet — nothing to promote */ };
    };
  };

  public func isAdmin(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    caller : Common.UserId,
  ) : Bool {
    switch (profiles.get(caller)) {
      case (?p) { p.role == #admin };
      case null { false };
    };
  };

  public func getUserProfilePublic(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    target : Common.UserId,
  ) : ?AuthTypes.UserProfilePublic {
    switch (profiles.get(target)) {
      case (?p) { ?(toPublic(p)) };
      case null { null };
    };
  };

  /// Defense-in-depth variant of getUserProfilePublic() that strips the
  /// email field via toPublicSafe(). Use this for partner/peer exposure
  /// paths where the caller is not the profile owner and not an admin.
  /// The original getUserProfilePublic() (with email) stays for the gated
  /// owner-or-admin getUserProfile path in auth-api.mo.
  public func getUserProfilePublicSafe(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
    target : Common.UserId,
  ) : ?AuthTypes.UserProfilePublic {
    switch (profiles.get(target)) {
      case (?p) { ?(toPublicSafe(p)) };
      case null { null };
    };
  };

  public func listAllUsers(
    profiles : Map.Map<Common.UserId, AuthTypes.UserProfile>,
  ) : [AuthTypes.UserProfilePublic] {
    let out = List.empty<AuthTypes.UserProfilePublic>();
    for ((_, p) in profiles.entries()) {
      out.add(toPublic(p));
    };
    out.toArray();
  };
};
