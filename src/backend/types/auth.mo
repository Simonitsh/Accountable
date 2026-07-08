import Common "common";

module {
  /// Avatar shape — exactly one of five approved geometric shapes.
  /// null means "no shape selected yet" (default during onboarding).
  public type AvatarShape = ?{
    #Triangle;
    #Square;
    #Pentagon;
    #Hexagon;
    #Star;
  };

  /// Avatar color — a 6-digit hex code string (e.g. "#10B981").
  /// null means "no color selected yet" (default during onboarding).
  public type AvatarColor = ?Text;

  /// Avatar color mode — controls how the chosen color is applied to the
  /// avatar. `#Fill` applies the color to both the border ring and the inner
  /// shape. `#BorderOnly` applies the color to the circular border ring only,
  /// leaving the inner shape in a neutral color.
  public type AvatarColorMode = {
    #Fill;
    #BorderOnly;
  };

  public type UserProfile = {
    id : Common.UserId;
    var username : Text;
    var displayName : Text;
    var avatarShape : AvatarShape;
    var avatarColor : AvatarColor;
    var avatarColorMode : AvatarColorMode;
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
    avatarShape : AvatarShape;
    avatarColor : AvatarColor;
    avatarColorMode : AvatarColorMode;
    timezone : Text;
    bio : ?Text;
    email : ?Text;
    timezoneOffsetMinutes : Int;
    role : Common.UserRole;
  };
};
