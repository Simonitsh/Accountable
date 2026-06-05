import Common "common";

import Debug "mo:core/Debug";
module {
  /// Default scheduled days — every day of the week.
  public let DEFAULT_SCHEDULED_DAYS : [Text] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
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
    var iconName : ?Text;
    var themeColor : ?Text;
    var isLockIn : Bool;
    var startTime : ?Text;
    var endTime : ?Text;
    var lastEditedAt : ?Common.Timestamp;
    var emailNotifications : Bool;
    var intentTime : ?Text;
    var reminderOffset : ?Int;
    var lastEmailSentAt : Int;
    var lockInDurationMinutes : Nat;
    var startTimeMinutes : Nat;
    var endTimeMinutes : Nat;
    var intentTimeMinutes : Nat;
    var scheduledDays : [Text];
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
    iconName : ?Text;
    themeColor : ?Text;
    isLockIn : Bool;
    startTime : ?Text;
    endTime : ?Text;
    lastEditedAt : ?Common.Timestamp;
    emailNotifications : Bool;
    intentTime : ?Text;
    reminderOffset : ?Int;
    lastEmailSentAt : Int;
    lockInDurationMinutes : Nat;
    startTimeMinutes : Nat;
    endTimeMinutes : Nat;
    intentTimeMinutes : Nat;
    scheduledDays : [Text];
  };

  public type CreateGoalRequest = {
    wish : Text;
    wishDescription : Text;
    outcome : Text;
    obstacleTemplateId : ?Common.ObstacleTemplateId;
    ifThenPlan : Text;
    iconName : ?Text;
    themeColor : ?Text;
    isLockIn : Bool;
    startTime : ?Text;
    endTime : ?Text;
    emailNotifications : ?Bool;
    intentTime : ?Text;
    reminderOffset : ?Int;
    lockInDurationMinutes : ?Nat;
    startTimeMinutes : ?Nat;
    endTimeMinutes : ?Nat;
    intentTimeMinutes : ?Nat;
    scheduledDays : ?[Text];
  };

  public type CreateObstacleRequest = {
    title : Text;
    description : Text;
  };

  public type UpdateGoalRequest = {
    wish : ?Text;
    wishDescription : ?Text;
    outcome : ?Text;
    ifThenPlan : ?Text;
    iconName : ?Text;
    themeColor : ?Text;
    isLockIn : ?Bool;
    startTime : ?Text;
    endTime : ?Text;
    emailNotifications : ?Bool;
    intentTime : ?Text;
    reminderOffset : ?Int;
    timezoneOffsetMinutes : Int;
    lockInDurationMinutes : ?Nat;
    startTimeMinutes : ?Nat;
    endTimeMinutes : ?Nat;
    intentTimeMinutes : ?Nat;
    scheduledDays : ?[Text];
  };

  /// Typed error variants for goal operations.
  /// Using a variant here keeps call-sites exhaustive and eliminates magic strings.
  public type GoalError = {
    #goalNotFound;
    #notOwner;
    #goalNotEditable;
    #invalidInput;
    #lockInOverlap : Text;
    #strictLockActive;
    #dailyEditLockout;
    #immutableType;
  };
};
