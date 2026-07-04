import Common "common";

module {
  public type UserProfile = {
    id : Common.UserId;
    var username : Text;
    var displayName : Text;
    var avatarArchetype : Text;
    var timezone : Text;
    var bio : ?Text;
    var email : ?Text;
    var timezoneOffsetMinutes : Int;
    var role : Common.UserRole;
    var createdAt : Common.Timestamp;
  };

  public type UserProfilePublic = {
    id : Common.UserId;
    username : Text;
    displayName : Text;
    avatarArchetype : Text;
    timezone : Text;
    bio : ?Text;
    email : ?Text;
    timezoneOffsetMinutes : Int;
    role : Common.UserRole;
  };

  public let validArchetypes : [Text] = [
    "Oak",
    "River",
    "Wolf",
    "Owl",
    "Mountain",
    "Fire",
    "Bamboo",
    "Honeycomb",
    "Wind",
    "Tide",
  ];

  public func isValidArchetype(value : Text) : Bool {
    for (a in validArchetypes.values()) {
      if (a == value) return true;
    };
    false;
  };
};
