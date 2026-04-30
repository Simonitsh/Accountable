import Common "common";

module {
  public type ObstacleTemplate = {
    id : Common.ObstacleTemplateId;
    owner : Common.UserId;
    title : Text;
    description : Text;
  };

  public type Goal = {
    id : Common.GoalId;
    owner : Common.UserId;
    var wish : Text;
    var wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    var ifThenPlan : Text;
    var state : Common.GoalState;
    createdAt : Common.Timestamp;
    var updatedAt : Common.Timestamp;
  };

  public type GoalPublic = {
    id : Common.GoalId;
    owner : Common.UserId;
    wish : Text;
    wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    ifThenPlan : Text;
    state : Common.GoalState;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
  };

  public type CreateGoalRequest = {
    wish : Text;
    wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    ifThenPlan : Text;
  };

  public type CreateObstacleRequest = {
    title : Text;
    description : Text;
  };

  public type UpdateGoalRequest = {
    wish : ?Text;
    wishDescription : ?Text;
    ifThenPlan : ?Text;
  };

  /// Typed error variants for goal operations.
  /// Using a variant here keeps call-sites exhaustive and eliminates magic strings.
  public type GoalError = {
    #goalNotFound;
    #notOwner;
    #limitReached;
    #goalNotEditable;
    #invalidInput;
  };
};
