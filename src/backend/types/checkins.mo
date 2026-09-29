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
    // True when the follow-up question was asked and the user dismissed it
    // without answering. A distinct fact from `executedIfThen`: a check-in is
    // in exactly one of three states — used the plan (executedIfThen = true),
    // asked-and-declined (followUpDeclined = true), or unanswered (both false).
    // The two flags are mutually exclusive; declining never counts as using
    // the plan.
    followUpDeclined : Bool;
    // The timezone offset (minutes east of UTC) in effect when this check-in
    // was recorded. Persisted per record so historical day bucketing stays
    // correct across DST changes and travel. null on legacy records written
    // before this field existed; analytics falls back to the caller-supplied
    // offset for those.
    tzOffsetMinutes : ?Int;
    note : ?Text;
  };

  public type RecordCheckInRequest = {
    goalId : Common.GoalId;
    checkInType : Common.CheckInType;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    lockInStartedAt : ?Int;
    lockInEndedAt : ?Int;
    executedIfThen : Bool;
    timezoneOffsetMinutes : Int;
    note : ?Text;
  };
};
