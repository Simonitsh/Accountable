import Common "common";

module {
  public type UserProfile = {
    id : Common.UserId;
    var username : Text;
    var displayName : Text;
    var avatarEmoji : Text;
    var timezone : Text;
    var bio : ?Text;
    var email : ?Text;
    var role : Common.UserRole;
    var createdAt : Common.Timestamp;
  };

  public type UserProfilePublic = {
    id : Common.UserId;
    username : Text;
    displayName : Text;
    avatarEmoji : Text;
    timezone : Text;
    bio : ?Text;
    email : ?Text;
    role : Common.UserRole;
  };

};
