import Common "common";

module {
  public type UserProfile = {
    id : Common.UserId;
    var username : Text;
    var role : Common.UserRole;
    var tier : Common.SubscriptionTier;
    var customGoalLimit : ?Nat;
    var createdAt : Common.Timestamp;
  };

  public type UserProfilePublic = {
    id : Common.UserId;
    username : Text;
    role : Common.UserRole;
    tier : Common.SubscriptionTier;
    goalLimit : Nat;
  };

  public type AdminAuditEntry = {
    targetPrincipal : Common.UserId;
    setBy : Common.UserId;
    limit : Nat;
    timestamp : Common.Timestamp;
  };
};
