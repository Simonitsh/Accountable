import Common "common";

module {
  public type CheckIn = {
    id : Common.CheckInId;
    goalId : Common.GoalId;
    owner : Common.UserId;
    checkInType : Common.CheckInType;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    timestamp : Common.Timestamp;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
    customObstacleNote : ?Text;
  };

  public type RecordCheckInRequest = {
    goalId : Common.GoalId;
    checkInType : Common.CheckInType;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
    customObstacleNote : ?Text;
    timezoneOffsetMinutes : Int;
  };
};
