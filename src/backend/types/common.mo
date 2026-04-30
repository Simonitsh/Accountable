module {
  public type UserId = Principal;
  public type Timestamp = Int;
  public type GoalId = Nat;
  public type CheckInId = Nat;
  public type ConnectionId = Nat;
  public type InteractionId = Nat;
  public type ObstacleTemplateId = Nat;

  public type UserRole = { #user; #admin };
  public type SubscriptionTier = { #tier1; #tier2; #tier3 };

  public type CheckInType = { #success; #skip };
  public type ConnectionStatus = { #pending; #accepted; #rejected };
  public type InteractionType = { #highFive };
  public type GoalState = { #active; #paused; #completed; #abandoned };
};
