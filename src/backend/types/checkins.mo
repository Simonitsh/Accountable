import Common "common";

module {
  public type CheckIn = {
    id : Common.CheckInId;
    goalId : Common.GoalId;
    owner : Common.UserId;
    checkInType : Common.CheckInType;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    customObstacleNote : ?Text;
    timestamp : Common.Timestamp;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
  };

  public type RecordCheckInRequest = {
    goalId : Common.GoalId;
    checkInType : Common.CheckInType;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    customObstacleNote : ?Text;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
    timezoneOffsetMinutes : Int;
  };
};
